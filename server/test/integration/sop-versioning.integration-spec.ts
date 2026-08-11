/**
 * Integration Test: SOP Versioning
 *
 * Menguji siklus hidup versi SOP secara menyeluruh:
 *  - Buat versi baru dari BERLAKU, hapus draft, cabut SOP BERLAKU
 *  - False cases: versi dari non-BERLAKU, cabut yang bukan BERLAKU
 *  - Worst cases: buat versi saat revisi aktif, cabut saat revisi berjalan
 *  - Edge cases: akses workbench via sopId (bukan detailSopId), filter tanggal
 */
import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request, { type Agent } from 'supertest';
import * as bcrypt from 'bcrypt';
import { createDefaultValidationPipe } from '../../src/common';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import {
  assertSafeIntegrationDatabase,
  pingIntegrationDatabase,
  resetIntegrationDatabase,
} from './helpers/integration-database.util';
import { isIntegrationEnabled } from './helpers/integration-runtime.util';
import { createMinimalPdfBuffer } from './helpers/integration-pdf.util';
import {
  HasilEvaluasi,
  JenisLangkahProsedur,
  JenisPengajuanEvaluasi,
  PeranPengguna,
  SatuanWaktu,
  StatusSOP,
} from '../../src/generated/prisma';

const describeIntegration = isIntegrationEnabled() ? describe : describe.skip;
const API = '/api/v1';
const PASSWORD = 'VersionTest123!';
const PIN_TTE = '654321';

async function seedUser(
  prisma: PrismaService,
  params: { email: string; nama: string; nip: string; peran: PeranPengguna; opdId: string },
): Promise<string> {
  const u = await prisma.pengguna.create({
    data: {
      email: params.email,
      nama: params.nama,
      nip: params.nip,
      opdId: params.opdId,
      peran: params.peran,
      kataSandi: await bcrypt.hash(PASSWORD, 10),
      jabatan: 'Staf',
      pangkat: 'Pembina',
      nohp: '085555555555',
      riwayatOpd: { create: { opdId: params.opdId, isAktif: true } },
    },
  });
  return u.penggunaId;
}

async function loginAgent(app: INestApplication, email: string): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post(`${API}/auth/login`).send({ email, password: PASSWORD }).expect(201);
  const raw = res.headers['set-cookie'];
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (arr.length > 0) agent.set('Cookie', arr.map((c: string) => c.split(';')[0]).join('; '));
  return agent;
}

async function buildAndPromoteSopToBerlaku(
  prisma: PrismaService,
  penyusunAgent: Agent,
  pjPenyusunAgent: Agent,
  evaluatorAgent: Agent,
  pjEvaluatorAgent: Agent,
  kepalaAgent: Agent,
  opts: {
    judul: string;
    nomorSop: string;
    namaLembaga: string;
    opdId: string;
    pelaksanaId: string;
    peraturanId: string;
    sopRelatedId: string;
  },
): Promise<{ detailSopId: string; sopId: string }> {
  const sopRes = await penyusunAgent
    .post(`${API}/sop`)
    .send({ judul: opts.judul, nomorSop: opts.nomorSop, namaLembaga: opts.namaLembaga })
    .expect(201);
  const detailSopId: string = sopRes.body.data.detailSopId;
  // sopId tidak selalu ada di response body — ambil dari database
  const detailRow = await prisma.detailSOP.findUniqueOrThrow({ where: { detailSopId } });
  const sopId: string = detailRow.sopId;

  await penyusunAgent
    .patch(`${API}/sop/header/${detailSopId}`)
    .send({
      judul: opts.judul,
      namaLembaga: opts.namaLembaga,
      dasarHukumPeraturanIds: [opts.peraturanId],
      sopTerkaitDetailIds: [opts.sopRelatedId],
      lampiran: {
        peringatan: ['Test.'],
        kualifikasiPelaksanaan: ['Test.'],
        peralatanPerlengkapan: ['Test.'],
        pencatatanPendataan: ['Test.'],
      },
    })
    .expect(200);

  await penyusunAgent
    .patch(`${API}/sop/langkah/${detailSopId}`)
    .send({
      pelaksana: [{ pelaksanaId: opts.pelaksanaId }],
      langkah: [
        {
          tempId: 'step-1',
          jenis: JenisLangkahProsedur.AWAL_AKHIR,
          kegiatan: 'Kegiatan',
          kelengkapan: 'Dokumen',
          keluaran: 'Hasil',
          waktu: 1,
          satuanWaktu: SatuanWaktu.d,
          keterangan: 'Test',
          pelaksanaId: opts.pelaksanaId,
        },
      ],
    })
    .expect(200);

  await penyusunAgent
    .patch(`${API}/sop/diagram/${detailSopId}`)
    .send({ jenis: 'FLOWCHART', layoutSeed: 1, pathOverrides: { edges: {}, labels: {} } })
    .expect(200);

  await penyusunAgent
    .patch(`${API}/sop/status/${detailSopId}`)
    .send({ status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI })
    .expect(200);
  await pjPenyusunAgent
    .post(`${API}/evaluasi`)
    .send({ jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD, sopDetailIds: [detailSopId] })
    .expect(201);

  const pengajuan = await prisma.pengajuanEvaluasi.findFirstOrThrow({
    where: { opdId: opts.opdId },
    orderBy: { createdAt: 'desc' },
  });
  const nilai = await prisma.nilaiEvaluasi.findUniqueOrThrow({
    where: {
      pengajuanEvaluasiId_detailSopId: {
        pengajuanEvaluasiId: pengajuan.pengajuanEvaluasiId,
        detailSopId,
      },
    },
  });

  await evaluatorAgent
    .patch(`${API}/evaluasi/${pengajuan.pengajuanEvaluasiId}/nilai/${detailSopId}`)
    .send({ hasil: HasilEvaluasi.SESUAI, version: nilai.version })
    .expect(200);
  await evaluatorAgent
    .patch(`${API}/evaluasi/${pengajuan.pengajuanEvaluasiId}/selesai`)
    .send({ nomorBA: `BA-EVAL-${opts.nomorSop}` })
    .expect(200);

  await pjEvaluatorAgent.post(`${API}/tte/profil`).send({ pin: PIN_TTE });
  await pjPenyusunAgent.post(`${API}/tte/profil`).send({ pin: PIN_TTE });
  await kepalaAgent.post(`${API}/tte/profil/setup/generate`).send({ pin: PIN_TTE });

  await pjEvaluatorAgent
    .post(`${API}/tte/tanda-tangani/ba/${pengajuan.pengajuanEvaluasiId}`)
    .send({
      pin: PIN_TTE,
      nomorDokumen: `BA-VR-${opts.nomorSop}`,
      judulDokumen: `BA ${opts.judul}`,
    })
    .expect(201);
  await pjPenyusunAgent
    .post(`${API}/tte/tanda-tangani/ba/${pengajuan.pengajuanEvaluasiId}`)
    .send({
      pin: PIN_TTE,
      nomorDokumen: `BA-VR-${opts.nomorSop}`,
      judulDokumen: `BA ${opts.judul}`,
    })
    .expect(201);
  const sopPdfBase64 = (await createMinimalPdfBuffer(opts.judul)).toString('base64');
  await kepalaAgent
    .post(`${API}/tte/tanda-tangani/pengajuan/${pengajuan.pengajuanEvaluasiId}/sop-semua`)
    .send({
      pin: PIN_TTE,
      nomorDokumen: `SOP-VR-${opts.nomorSop}`,
      judulDokumen: opts.judul,
      sopPdfs: [{ detailSopId, pdfBase64: sopPdfBase64 }],
    })
    .expect(201);

  const updated = await prisma.detailSOP.findUniqueOrThrow({ where: { detailSopId } });
  expect(updated.status).toBe(StatusSOP.BERLAKU);

  return { detailSopId, sopId };
}

describeIntegration('SOP Versioning — siklus hidup versi SOP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let opdId: string;
  let opdBId: string;

  let penyusunAgent: Agent;
  let pjPenyusunAgent: Agent;
  let evaluatorAgent: Agent;
  let pjEvaluatorAgent: Agent;
  let kepalaAgent: Agent;
  let kepalaLainAgent: Agent;

  let pelaksanaId: string;
  let peraturanId: string;
  let sopRelatedId: string;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    const { AppModule } = await import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(createDefaultValidationPipe());
    await app.init();

    prisma = app.get(PrismaService);
    await pingIntegrationDatabase(prisma);
    await resetIntegrationDatabase(prisma);

    const opd = await prisma.oPD.create({ data: { nama: 'OPD Versioning A' } });
    const opdB = await prisma.oPD.create({ data: { nama: 'OPD Versioning B' } });
    opdId = opd.opdId;
    opdBId = opdB.opdId;

    await seedUser(prisma, {
      email: 'pje.ver@example.test',
      nama: 'PJ Eval Versioning',
      nip: 'VR-PJE-001',
      peran: PeranPengguna.PJ_EVALUATOR,
      opdId,
    });
    await seedUser(prisma, {
      email: 'ev.ver@example.test',
      nama: 'Eval Versioning',
      nip: 'VR-EV-001',
      peran: PeranPengguna.EVALUATOR,
      opdId,
    });
    await seedUser(prisma, {
      email: 'pjp.ver@example.test',
      nama: 'PJ Penyusun Versioning',
      nip: 'VR-PJP-001',
      peran: PeranPengguna.PJ_PENYUSUN,
      opdId,
    });
    await seedUser(prisma, {
      email: 'pen.ver@example.test',
      nama: 'Penyusun Versioning',
      nip: 'VR-PEN-001',
      peran: PeranPengguna.PENYUSUN,
      opdId,
    });
    await seedUser(prisma, {
      email: 'kepala.ver@example.test',
      nama: 'Kepala Versioning A',
      nip: 'VR-KA-001',
      peran: PeranPengguna.KEPALA_OPD,
      opdId,
    });
    await seedUser(prisma, {
      email: 'kepala-b.ver@example.test',
      nama: 'Kepala Versioning B',
      nip: 'VR-KB-001',
      peran: PeranPengguna.KEPALA_OPD,
      opdId: opdBId,
    });

    pjEvaluatorAgent = await loginAgent(app, 'pje.ver@example.test');
    evaluatorAgent = await loginAgent(app, 'ev.ver@example.test');
    pjPenyusunAgent = await loginAgent(app, 'pjp.ver@example.test');
    penyusunAgent = await loginAgent(app, 'pen.ver@example.test');
    kepalaAgent = await loginAgent(app, 'kepala.ver@example.test');
    kepalaLainAgent = await loginAgent(app, 'kepala-b.ver@example.test');

    const pelaksana = await penyusunAgent
      .post(`${API}/pelaksana`)
      .send({ namaPelaksana: 'Pelaksana Versioning' })
      .expect(201);
    pelaksanaId = pelaksana.body.data.id;

    const peraturan = await penyusunAgent
      .post(`${API}/peraturan`)
      .send({
        namaPeraturan: 'Peraturan Versioning',
        nomor: 'VR-001',
        tahun: 2026,
        tentang: 'Test versioning',
      })
      .expect(201);
    peraturanId = peraturan.body.data.id;

    const sopRelated = await penyusunAgent
      .post(`${API}/sop`)
      .send({
        judul: 'SOP Terkait Versioning',
        nomorSop: 'VR-SOP-000',
        namaLembaga: 'OPD Versioning A',
      })
      .expect(201);
    sopRelatedId = sopRelated.body.data.detailSopId;
  });

  afterAll(async () => {
    try {
      if (prisma) await resetIntegrationDatabase(prisma);
    } finally {
      if (app) await app.close();
    }
  });

  // ============================
  // FILTER & QUERY EDGE CASES
  // ============================

  describe('GET /sop — filter dan query parameter', () => {
    it('GET /sop tanpa filter → 200 berhasil (Success Case)', async () => {
      await penyusunAgent.get(`${API}/sop`).expect(200);
    });

    it('GET /sop dengan status=all → 200 (Success Case)', async () => {
      await penyusunAgent.get(`${API}/sop?status=all`).expect(200);
    });

    it('GET /sop dengan tanggalDari dan tanggalSampai valid → 200 (Edge Case)', async () => {
      await penyusunAgent
        .get(`${API}/sop?tanggalDari=2026-01-01&tanggalSampai=2026-12-31`)
        .expect(200);
    });

    it('GET /sop dengan tanggalDari > tanggalSampai → 400 (Edge Case)', async () => {
      const res = await penyusunAgent.get(
        `${API}/sop?tanggalDari=2026-12-31&tanggalSampai=2026-01-01`,
      );
      expect([400]).toContain(res.status);
    });
  });

  // ============================
  // HAPUS SOP DRAFT AWAL
  // ============================

  describe('DELETE /sop/:detailSopId/draft — hapus SOP draft awal', () => {
    it('menghapus header SOP beserta detail draft awal (Success Case)', async () => {
      const sopRes = await penyusunAgent
        .post(`${API}/sop`)
        .send({
          judul: 'SOP Draft Akan Dihapus',
          nomorSop: 'VR-SOP-DEL-001',
          namaLembaga: 'OPD Versioning A',
        })
        .expect(201);
      const detailSopId: string = sopRes.body.data.detailSopId;
      const beforeDelete = await prisma.detailSOP.findUniqueOrThrow({ where: { detailSopId } });

      const listRes = await penyusunAgent.get(`${API}/sop`).expect(200);
      const listRow = listRes.body.data.find(
        (row: { detailSopId?: string }) => row.detailSopId === detailSopId,
      );
      expect(listRow?.canHapusSopDraft).toBe(true);

      await penyusunAgent.delete(`${API}/sop/${detailSopId}/draft`).expect(200);

      expect(await prisma.detailSOP.findUnique({ where: { detailSopId } })).toBeNull();
      expect(await prisma.sOP.findUnique({ where: { sopId: beforeDelete.sopId } })).toBeNull();
    });

    it('menolak penghapusan ketika SOP sudah bukan DRAFT (False Case)', async () => {
      const sopRes = await penyusunAgent
        .post(`${API}/sop`)
        .send({
          judul: 'SOP Draft Sudah Masuk Proses',
          nomorSop: 'VR-SOP-DEL-002',
          namaLembaga: 'OPD Versioning A',
        })
        .expect(201);
      const detailSopId: string = sopRes.body.data.detailSopId;
      await prisma.detailSOP.update({
        where: { detailSopId },
        data: { status: StatusSOP.SEDANG_DISUSUN },
      });

      await penyusunAgent.delete(`${API}/sop/${detailSopId}/draft`).expect(409);
      expect(await prisma.detailSOP.findUnique({ where: { detailSopId } })).not.toBeNull();
    });
  });

  // ============================
  // SOP VERSIONING WORKFLOW
  // ============================

  describe('SOP Multi-Versi — buat, hapus draft, buat versi baru dari BERLAKU', () => {
    let berlakuDetailSopId: string;
    let berlakuSopId: string;

    it('workflow lengkap: buat SOP → evaluasi → TTE → BERLAKU (Setup)', async () => {
      const result = await buildAndPromoteSopToBerlaku(
        prisma,
        penyusunAgent,
        pjPenyusunAgent,
        evaluatorAgent,
        pjEvaluatorAgent,
        kepalaAgent,
        {
          judul: 'SOP Versioning Berlaku',
          nomorSop: 'VR-SOP-001',
          namaLembaga: 'OPD Versioning A',
          opdId,
          pelaksanaId,
          peraturanId,
          sopRelatedId,
        },
      );
      berlakuDetailSopId = result.detailSopId;
      berlakuSopId = result.sopId;

      const detail = await prisma.detailSOP.findUniqueOrThrow({
        where: { detailSopId: berlakuDetailSopId },
      });
      expect(detail.status).toBe(StatusSOP.BERLAKU);
    });

    it('GET /sop/:sopId/riwayat-versi — menampilkan riwayat versi (Success Case)', async () => {
      const res = await penyusunAgent.get(`${API}/sop/${berlakuSopId}/riwayat-versi`).expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET penyusun-workbench via sopId (bukan detailSopId) → resolve versi terbaru (Edge Case)', async () => {
      const res = await penyusunAgent
        .get(`${API}/sop/penyusun-workbench/${berlakuSopId}`)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.detail).toBeDefined();
    });

    it('POST /sop/:detailSopId/buat-versi-baru — berhasil buat versi baru dari BERLAKU (Success Case)', async () => {
      const res = await penyusunAgent
        .post(`${API}/sop/${berlakuDetailSopId}/buat-versi-baru`)
        .expect(201);
      expect(res.body.success).toBe(true);
      const newDetailSopId = res.body.data.detail.id;
      expect(newDetailSopId).not.toBe(berlakuDetailSopId);

      const newDetail = await prisma.detailSOP.findUniqueOrThrow({
        where: { detailSopId: newDetailSopId },
      });
      expect(newDetail.status).toBe(StatusSOP.DRAFT);
    });

    it('POST /sop/:detailSopId/buat-versi-baru saat revisi sudah aktif → 409 (Worst Case)', async () => {
      // Draft revisi sudah ada dari test sebelumnya
      const res = await penyusunAgent.post(`${API}/sop/${berlakuDetailSopId}/buat-versi-baru`);
      expect([409, 400]).toContain(res.status);
    });

    it('DELETE /sop/:detailSopId/versi-draft — hapus versi DRAFT yang belum dievaluasi (Success Case)', async () => {
      // Cari versi DRAFT yang baru dibuat
      const draftDetail = await prisma.detailSOP.findFirst({
        where: { sopId: berlakuSopId, status: StatusSOP.DRAFT },
        orderBy: { createdAt: 'desc' },
      });
      expect(draftDetail).not.toBeNull();

      await penyusunAgent.delete(`${API}/sop/${draftDetail!.detailSopId}/versi-draft`).expect(200);

      const deleted = await prisma.detailSOP.findUnique({
        where: { detailSopId: draftDetail!.detailSopId },
      });
      expect(deleted).toBeNull();
    });

    it('POST dari versi DIGANTIKAN membuat nomor berikutnya dan menyalin snapshot sumber', async () => {
      const v2Response = await penyusunAgent
        .post(`${API}/sop/${berlakuDetailSopId}/buat-versi-baru`)
        .expect(201);
      const v2DetailSopId: string = v2Response.body.data.detail.id;

      await penyusunAgent
        .patch(`${API}/sop/header/${v2DetailSopId}`)
        .send({ namaLembaga: 'Konten khusus versi dua' })
        .expect(200);

      await prisma.$transaction(async (tx) => {
        await tx.detailSOP.update({
          where: { detailSopId: berlakuDetailSopId },
          data: { status: StatusSOP.DIGANTIKAN },
        });
        await tx.detailSOP.update({
          where: { detailSopId: v2DetailSopId },
          data: { status: StatusSOP.BERLAKU },
        });
      });

      const v3Response = await penyusunAgent
        .post(`${API}/sop/${berlakuDetailSopId}/buat-versi-baru`)
        .expect(201);
      const v3DetailSopId: string = v3Response.body.data.detail.id;
      const v3 = await prisma.detailSOP.findUniqueOrThrow({
        where: { detailSopId: v3DetailSopId },
      });

      expect(v3.versi).toBe(3);
      expect(v3.status).toBe(StatusSOP.DRAFT);
      expect(v3.revisiDariDetailSopId).toBe(berlakuDetailSopId);
      expect(v3.namaLembaga).toBe('OPD Versioning A');

      const sourceV1 = await prisma.detailSOP.findUniqueOrThrow({
        where: { detailSopId: berlakuDetailSopId },
      });
      const activeV2 = await prisma.detailSOP.findUniqueOrThrow({
        where: { detailSopId: v2DetailSopId },
      });
      expect(sourceV1.status).toBe(StatusSOP.DIGANTIKAN);
      expect(activeV2.status).toBe(StatusSOP.BERLAKU);

      const audit = await prisma.logEditSOP.findFirst({
        where: { detailSopId: v3DetailSopId },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit?.keterangan).toBe('Versi 3 dibuat berdasarkan versi 1');
    });
  });

  // ============================
  // CABUT SOP BERLAKU
  // ============================

  describe('Cabut SOP BERLAKU — oleh Kepala OPD', () => {
    let sopCabutDetailId: string;

    beforeAll(async () => {
      const result = await buildAndPromoteSopToBerlaku(
        prisma,
        penyusunAgent,
        pjPenyusunAgent,
        evaluatorAgent,
        pjEvaluatorAgent,
        kepalaAgent,
        {
          judul: 'SOP Akan Dicabut',
          nomorSop: 'VR-SOP-002',
          namaLembaga: 'OPD Versioning A',
          opdId,
          pelaksanaId,
          peraturanId,
          sopRelatedId,
        },
      );
      sopCabutDetailId = result.detailSopId;
    });

    it('POST /sop/cabut/:detailOrSopId oleh Kepala OPD sendiri → 200 DICABUT (Success Case)', async () => {
      await kepalaAgent.post(`${API}/sop/cabut/${sopCabutDetailId}`).expect(200);

      const revoked = await prisma.detailSOP.findUniqueOrThrow({
        where: { detailSopId: sopCabutDetailId },
      });
      expect(revoked.status).toBe(StatusSOP.DICABUT);
    });

    it('POST /sop/cabut/:id SOP yang sudah DICABUT → 409 (False Case)', async () => {
      const res = await kepalaAgent.post(`${API}/sop/cabut/${sopCabutDetailId}`);
      expect([409, 400]).toContain(res.status);
    });

    it('POST /sop/cabut/:id oleh Kepala OPD lain → 403/404 (Worst Case)', async () => {
      // Buat SOP baru yang BERLAKU untuk dicoba cabut oleh OPD lain
      const result = await buildAndPromoteSopToBerlaku(
        prisma,
        penyusunAgent,
        pjPenyusunAgent,
        evaluatorAgent,
        pjEvaluatorAgent,
        kepalaAgent,
        {
          judul: 'SOP OPD A Cross Cabut',
          nomorSop: 'VR-SOP-003',
          namaLembaga: 'OPD Versioning A',
          opdId,
          pelaksanaId,
          peraturanId,
          sopRelatedId,
        },
      );
      const res = await kepalaLainAgent.post(`${API}/sop/cabut/${result.detailSopId}`);
      expect([403, 404]).toContain(res.status);
    });
  });

  // ============================
  // STATUS TRANSITION EDGE CASES
  // ============================

  describe('Status Transition — validasi transisi status SOP', () => {
    let draftSopId: string;

    beforeAll(async () => {
      // Buat SOP LENGKAP agar bisa transition ke MENUNGGU_PENGAJUAN_EVALUASI
      // (SOP bare tanpa langkah/header tidak bisa transition karena validasi kelengkapan)
      const sopRes = await penyusunAgent
        .post(`${API}/sop`)
        .send({ judul: 'SOP Status Edge', nomorSop: 'VR-SOP-004', namaLembaga: 'OPD Versioning A' })
        .expect(201);
      draftSopId = sopRes.body.data.detailSopId;

      await penyusunAgent
        .patch(`${API}/sop/header/${draftSopId}`)
        .send({
          judul: 'SOP Status Edge',
          namaLembaga: 'OPD Versioning A',
          dasarHukumPeraturanIds: [peraturanId],
          sopTerkaitDetailIds: [sopRelatedId],
          lampiran: {
            peringatan: ['Test.'],
            kualifikasiPelaksanaan: ['Test.'],
            peralatanPerlengkapan: ['Test.'],
            pencatatanPendataan: ['Test.'],
          },
        })
        .expect(200);

      await penyusunAgent
        .patch(`${API}/sop/langkah/${draftSopId}`)
        .send({
          pelaksana: [{ pelaksanaId }],
          langkah: [
            {
              tempId: 'step-1',
              jenis: JenisLangkahProsedur.AWAL_AKHIR,
              kegiatan: 'Kegiatan Status Test',
              kelengkapan: 'Dokumen',
              keluaran: 'Hasil',
              waktu: 1,
              satuanWaktu: SatuanWaktu.d,
              keterangan: 'Test',
              pelaksanaId,
            },
          ],
        })
        .expect(200);

      await penyusunAgent
        .patch(`${API}/sop/diagram/${draftSopId}`)
        .send({ jenis: 'FLOWCHART', layoutSeed: 1, pathOverrides: { edges: {}, labels: {} } })
        .expect(200);
    });

    it('PATCH /sop/status — transisi status yang sama → 409 (Edge Case)', async () => {
      // SOP baru memiliki status DRAFT, coba PATCH ke DRAFT lagi
      const res = await penyusunAgent
        .patch(`${API}/sop/status/${draftSopId}`)
        .send({ status: StatusSOP.DRAFT });
      expect([409, 400]).toContain(res.status);
    });

    it('PATCH /sop/status — transisi langsung dari DRAFT ke BERLAKU (lompat status) → 409/403 (False Case)', async () => {
      const res = await penyusunAgent
        .patch(`${API}/sop/status/${draftSopId}`)
        .send({ status: StatusSOP.BERLAKU });
      expect([409, 400, 403]).toContain(res.status);
    });

    it('PATCH /sop/status — PENYUSUN mencoba ubah status ke DIAJUKAN_EVALUASI (hanya PJ) → 403/409 (False Case)', async () => {
      // Pertama buat SOP siap evaluasi
      await penyusunAgent
        .patch(`${API}/sop/status/${draftSopId}`)
        .send({ status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI })
        .expect(200);

      const res = await penyusunAgent
        .patch(`${API}/sop/status/${draftSopId}`)
        .send({ status: StatusSOP.DIAJUKAN_EVALUASI });
      expect([403, 409]).toContain(res.status);
    });
  });

  // ============================
  // READ-ONLY TIDAK MENGUBAH UPDATEDDAT
  // ============================

  describe('Read-only endpoints — tidak mengubah state SOP', () => {
    it('GET /sop tidak mengubah updatedAt DetailSOP (Edge Case)', async () => {
      const sopRes = await penyusunAgent
        .post(`${API}/sop`)
        .send({
          judul: 'SOP Read Only Test',
          nomorSop: 'VR-SOP-005',
          namaLembaga: 'OPD Versioning A',
        })
        .expect(201);
      const id = sopRes.body.data.detailSopId;

      const before = await prisma.detailSOP.findUniqueOrThrow({ where: { detailSopId: id } });
      await penyusunAgent.get(`${API}/sop`).expect(200);
      await penyusunAgent.get(`${API}/sop/penyusun-workbench/${id}`).expect(200);
      const after = await prisma.detailSOP.findUniqueOrThrow({ where: { detailSopId: id } });

      expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());
    });
  });
});
