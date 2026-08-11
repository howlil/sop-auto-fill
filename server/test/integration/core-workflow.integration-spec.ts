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
import {
  BagianSOP,
  HasilEvaluasi,
  JenisDokumenTte,
  JenisLangkahProsedur,
  JenisPengajuanEvaluasi,
  PeranPengguna,
  SatuanWaktu,
  StatusTindakLanjut,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../src/generated/prisma';
import { createMinimalPdfBuffer } from './helpers/integration-pdf.util';

const describeIntegration = isIntegrationEnabled() ? describe : describe.skip;
const API = '/api/v1';
const PASSWORD = 'Integration123!';
const PIN_TTE = '123456';

type WorkflowState = {
  opdAId: string;
  opdBId: string;
  peraturanId: string;
  pelaksanaId: string;
  detailSopId: string;
  relatedDetailSopId: string;
  pengajuanId: string;
};

async function seedUser(
  prisma: PrismaService,
  params: {
    email: string;
    nama: string;
    nip: string;
    opdId: string;
    peran: PeranPengguna;
  },
): Promise<void> {
  await prisma.pengguna.create({
    data: {
      email: params.email,
      nama: params.nama,
      nip: params.nip,
      opdId: params.opdId,
      peran: params.peran,
      kataSandi: await bcrypt.hash(PASSWORD, 10),
      jabatan: params.peran,
      pangkat: 'Pembina',
      nohp: '081234567890',
      riwayatOpd: {
        create: {
          opdId: params.opdId,
          isAktif: true,
        },
      },
    },
  });
}

async function seedBaseData(prisma: PrismaService): Promise<{ opdAId: string; opdBId: string }> {
  const opdA = await prisma.oPD.create({ data: { nama: 'OPD Integration A' } });
  const opdB = await prisma.oPD.create({ data: { nama: 'OPD Integration B' } });

  await seedUser(prisma, {
    email: 'pj-evaluator.integration@example.test',
    nama: 'PJ Evaluator Integration',
    nip: 'INT-PJE-001',
    opdId: opdA.opdId,
    peran: PeranPengguna.PJ_EVALUATOR,
  });
  await seedUser(prisma, {
    email: 'evaluator.integration@example.test',
    nama: 'Evaluator Integration',
    nip: 'INT-EV-001',
    opdId: opdA.opdId,
    peran: PeranPengguna.EVALUATOR,
  });
  await seedUser(prisma, {
    email: 'pj-penyusun.integration@example.test',
    nama: 'PJ Penyusun Integration',
    nip: 'INT-PJP-001',
    opdId: opdA.opdId,
    peran: PeranPengguna.PJ_PENYUSUN,
  });
  await seedUser(prisma, {
    email: 'penyusun.integration@example.test',
    nama: 'Penyusun Integration',
    nip: 'INT-PEN-001',
    opdId: opdA.opdId,
    peran: PeranPengguna.PENYUSUN,
  });
  await seedUser(prisma, {
    email: 'kepala.integration@example.test',
    nama: 'Kepala OPD Integration',
    nip: 'INT-KA-001',
    opdId: opdA.opdId,
    peran: PeranPengguna.KEPALA_OPD,
  });
  await seedUser(prisma, {
    email: 'kepala-lain.integration@example.test',
    nama: 'Kepala OPD Lain Integration',
    nip: 'INT-KB-001',
    opdId: opdB.opdId,
    peran: PeranPengguna.KEPALA_OPD,
  });

  return { opdAId: opdA.opdId, opdBId: opdB.opdId };
}

async function loginAgent(app: INestApplication, email: string): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  const response = await agent
    .post(`${API}/auth/login`)
    .send({ email, password: PASSWORD })
    .expect(201);
  const setCookie = response.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  if (cookies.length > 0) {
    agent.set('Cookie', cookies.map((cookie) => cookie.split(';')[0]).join('; '));
  }
  return agent;
}

function expectRejected(status: number): void {
  expect([400, 401, 403, 404, 409]).toContain(status);
}

describeIntegration('Core workflow integration test', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let penyusunAgent: Agent;
  let pjPenyusunAgent: Agent;
  let evaluatorAgent: Agent;
  let pjEvaluatorAgent: Agent;
  let kepalaAgent: Agent;
  let kepalaLainAgent: Agent;
  let state: WorkflowState;

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
    const seeded = await seedBaseData(prisma);

    penyusunAgent = await loginAgent(app, 'penyusun.integration@example.test');
    pjPenyusunAgent = await loginAgent(app, 'pj-penyusun.integration@example.test');
    evaluatorAgent = await loginAgent(app, 'evaluator.integration@example.test');
    pjEvaluatorAgent = await loginAgent(app, 'pj-evaluator.integration@example.test');
    kepalaAgent = await loginAgent(app, 'kepala.integration@example.test');
    kepalaLainAgent = await loginAgent(app, 'kepala-lain.integration@example.test');

    state = {
      opdAId: seeded.opdAId,
      opdBId: seeded.opdBId,
      peraturanId: '',
      pelaksanaId: '',
      detailSopId: '',
      relatedDetailSopId: '',
      pengajuanId: '',
    };
  });

  afterAll(async () => {
    try {
      if (prisma !== undefined) {
        await resetIntegrationDatabase(prisma);
      }
    } finally {
      if (app !== undefined) {
        await app.close();
      }
    }
  });

  it('menolak akses tanpa login dan role tidak sesuai', async () => {
    await request(app.getHttpServer()).get(`${API}/sop`).expect(401);

    const response = await penyusunAgent.post(`${API}/evaluasi`).send({
      jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
      sopDetailIds: ['00000000-0000-4000-8000-000000000001'],
    });
    expectRejected(response.status);
    await expect(prisma.pengajuanEvaluasi.count()).resolves.toBe(0);
  });

  it('menyusun SOP lengkap melalui API dan menyimpan relasi lintas tabel', async () => {
    const createMain = await penyusunAgent
      .post(`${API}/sop`)
      .send({
        judul: 'SOP Integration Utama',
        nomorSop: 'INT-SOP-001',
        namaLembaga: 'OPD Integration A',
      })
      .expect(201);
    state.detailSopId = createMain.body.data.detailSopId;

    const createRelated = await penyusunAgent
      .post(`${API}/sop`)
      .send({
        judul: 'SOP Integration Terkait',
        nomorSop: 'INT-SOP-002',
        namaLembaga: 'OPD Integration A',
      })
      .expect(201);
    state.relatedDetailSopId = createRelated.body.data.detailSopId;

    const peraturan = await penyusunAgent
      .post(`${API}/peraturan`)
      .send({
        namaPeraturan: 'Peraturan Integration',
        nomor: 'INT-001',
        tahun: 2026,
        tentang: 'Pengujian integration workflow SOP',
      })
      .expect(201);
    state.peraturanId = peraturan.body.data.id;

    const pelaksana = await penyusunAgent
      .post(`${API}/pelaksana`)
      .send({ namaPelaksana: 'Pelaksana Integration' })
      .expect(201);
    state.pelaksanaId = pelaksana.body.data.id;

    await penyusunAgent
      .patch(`${API}/sop/header/${state.detailSopId}`)
      .send({
        judul: 'SOP Integration Utama Revisi Header',
        namaLembaga: 'OPD Integration A',
        dasarHukumPeraturanIds: [state.peraturanId],
        sopTerkaitDetailIds: [state.relatedDetailSopId],
        lampiran: {
          peringatan: ['Pastikan dokumen lengkap.'],
          kualifikasiPelaksanaan: ['Pelaksana memahami proses.'],
          peralatanPerlengkapan: ['Komputer dan jaringan.'],
          pencatatanPendataan: ['Dicatat dalam sistem.'],
        },
      })
      .expect(200);

    await penyusunAgent
      .patch(`${API}/sop/langkah/${state.detailSopId}`)
      .send({
        pelaksana: [{ pelaksanaId: state.pelaksanaId }],
        langkah: [
          {
            tempId: 'step-1',
            jenis: JenisLangkahProsedur.AWAL_AKHIR,
            kegiatan: 'Memproses dokumen SOP',
            kelengkapan: 'Dokumen permohonan',
            keluaran: 'Dokumen tervalidasi',
            waktu: 1,
            satuanWaktu: SatuanWaktu.d,
            keterangan: 'Diproses sesuai ketentuan',
            pelaksanaId: state.pelaksanaId,
          },
        ],
      })
      .expect(200);

    await penyusunAgent
      .patch(`${API}/sop/diagram/${state.detailSopId}`)
      .send({ jenis: 'FLOWCHART', layoutSeed: 1, pathOverrides: { edges: {}, labels: {} } })
      .expect(200);

    const detail = await prisma.detailSOP.findUniqueOrThrow({
      where: { detailSopId: state.detailSopId },
      include: {
        dasarHukum: true,
        lampiranPeringatan: true,
        langkahSOP: true,
        konfigurasiDiagram: true,
      },
    });
    expect(detail.status).toBe(StatusSOP.DRAFT);
    expect(detail.dasarHukum).toHaveLength(1);
    expect(detail.lampiranPeringatan).toHaveLength(1);
    expect(detail.langkahSOP).toHaveLength(1);
    expect(detail.konfigurasiDiagram).toHaveLength(1);
  });

  it('menolak constraint header dan prosedur yang melanggar aturan bisnis', async () => {
    const duplicateNomor = await penyusunAgent.post(`${API}/sop`).send({
      judul: 'SOP Integration Nomor Duplikat',
      nomorSop: 'INT-SOP-002',
      namaLembaga: 'OPD Integration A',
    });
    expectRejected(duplicateNomor.status);

    const invalidBranch = await penyusunAgent
      .patch(`${API}/sop/langkah/${state.detailSopId}`)
      .send({
        pelaksana: [{ pelaksanaId: state.pelaksanaId }],
        langkah: [
          {
            tempId: 'step-1',
            jenis: JenisLangkahProsedur.KEPUTUSAN,
            kegiatan: 'Cek dokumen',
            kelengkapan: 'Dokumen',
            keluaran: 'Keputusan',
            waktu: 1,
            satuanWaktu: SatuanWaktu.d,
            keterangan: 'Cabang invalid',
            pelaksanaId: state.pelaksanaId,
            langkahSelanjutnyaYaTempId: 'missing-step',
          },
        ],
      });
    expectRejected(invalidBranch.status);
  });

  it('mengubah SOP lengkap menjadi siap evaluasi dan membuat pengajuan evaluasi', async () => {
    await penyusunAgent
      .patch(`${API}/sop/status/${state.detailSopId}`)
      .send({ status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI })
      .expect(200);

    const penyusunSubmit = await penyusunAgent
      .patch(`${API}/sop/status/${state.detailSopId}`)
      .send({ status: StatusSOP.DIAJUKAN_EVALUASI });
    expectRejected(penyusunSubmit.status);

    await pjPenyusunAgent
      .post(`${API}/evaluasi`)
      .send({
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
        sopDetailIds: [state.detailSopId],
      })
      .expect(201);

    const pengajuan = await prisma.pengajuanEvaluasi.findFirstOrThrow({
      where: { opdId: state.opdAId },
      include: { nilaiEvaluasi: true },
      orderBy: { createdAt: 'desc' },
    });
    state.pengajuanId = pengajuan.pengajuanEvaluasiId;
    expect(pengajuan.status).toBe(StatusPengajuanEvaluasi.SEDANG_DIEVALUASI);
    expect(pengajuan.nilaiEvaluasi).toHaveLength(1);

    const duplicate = await pjPenyusunAgent.post(`${API}/evaluasi`).send({
      jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
      sopDetailIds: [state.detailSopId],
    });
    expectRejected(duplicate.status);
  });

  it('menjalankan loop evaluasi perlu perbaikan, umpan balik, revisi, dan kirim ulang', async () => {
    const missingCatatan = await evaluatorAgent
      .patch(`${API}/evaluasi/${state.pengajuanId}/nilai/${state.detailSopId}`)
      .send({ hasil: HasilEvaluasi.PERLU_PERBAIKAN });
    expectRejected(missingCatatan.status);

    await evaluatorAgent
      .patch(`${API}/evaluasi/${state.pengajuanId}/nilai/${state.detailSopId}`)
      .send({
        hasil: HasilEvaluasi.PERLU_PERBAIKAN,
        catatan: 'Tambahkan detail keluaran pada langkah SOP.',
      })
      .expect(200);

    let nilai = await prisma.nilaiEvaluasi.findUniqueOrThrow({
      where: {
        pengajuanEvaluasiId_detailSopId: {
          pengajuanEvaluasiId: state.pengajuanId,
          detailSopId: state.detailSopId,
        },
      },
    });
    expect(nilai.hasil).toBe(HasilEvaluasi.PERLU_PERBAIKAN);
    expect(nilai.statusTindakLanjut).toBe(StatusTindakLanjut.TERBUKA);

    const feedback = await penyusunAgent
      .get(`${API}/evaluasi/umpan-balik/detail/${state.detailSopId}`)
      .expect(200);
    expect(feedback.body.data.catatan).toContain('Tambahkan detail');

    await pjPenyusunAgent
      .post(`${API}/sop/penyusun-workbench/${state.detailSopId}/kirim-ulang-evaluasi`)
      .expect(200);

    nilai = await prisma.nilaiEvaluasi.findUniqueOrThrow({
      where: {
        pengajuanEvaluasiId_detailSopId: {
          pengajuanEvaluasiId: state.pengajuanId,
          detailSopId: state.detailSopId,
        },
      },
    });
    expect(nilai.statusTindakLanjut).toBe(StatusTindakLanjut.SELESAI);
  });

  it('menolak penilaian di luar pengajuan dan menyelesaikan evaluasi hanya saat sesuai', async () => {
    const outsideDetail = await evaluatorAgent
      .patch(`${API}/evaluasi/${state.pengajuanId}/nilai/${state.relatedDetailSopId}`)
      .send({ hasil: HasilEvaluasi.SESUAI });
    expectRejected(outsideDetail.status);

    const staleVersion = await evaluatorAgent
      .patch(`${API}/evaluasi/${state.pengajuanId}/nilai/${state.detailSopId}`)
      .send({ hasil: HasilEvaluasi.SESUAI, version: 999 });
    expectRejected(staleVersion.status);

    const nilaiSaatIni = await prisma.nilaiEvaluasi.findUniqueOrThrow({
      where: {
        pengajuanEvaluasiId_detailSopId: {
          pengajuanEvaluasiId: state.pengajuanId,
          detailSopId: state.detailSopId,
        },
      },
    });

    await evaluatorAgent
      .patch(`${API}/evaluasi/${state.pengajuanId}/nilai/${state.detailSopId}`)
      .send({ hasil: HasilEvaluasi.SESUAI, version: nilaiSaatIni.version })
      .expect(200);

    const requestOpdWithScore = await evaluatorAgent
      .patch(`${API}/evaluasi/${state.pengajuanId}/selesai`)
      .send({ nomorBA: 'BA-EVAL-INT-001', nilaiOPD: 5 });
    expectRejected(requestOpdWithScore.status);

    await evaluatorAgent
      .patch(`${API}/evaluasi/${state.pengajuanId}/selesai`)
      .send({ nomorBA: 'BA-EVAL-INT-001' })
      .expect(200);

    const pengajuan = await prisma.pengajuanEvaluasi.findUniqueOrThrow({
      where: { pengajuanEvaluasiId: state.pengajuanId },
    });
    expect(pengajuan.status).toBe(StatusPengajuanEvaluasi.SELESAI_DIEVALUASI);
    expect(pengajuan.nilaiOPD).toBeNull();

    const detail = await prisma.detailSOP.findUniqueOrThrow({
      where: { detailSopId: state.detailSopId },
    });
    expect(detail.status).toBe(StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR);
  });

  it('menjalankan TTE BA, menolak duplikasi tanda tangan, dan mengesahkan SOP oleh Kepala OPD', async () => {
    await pjEvaluatorAgent.post(`${API}/tte/profil`).send({ pin: PIN_TTE }).expect(201);
    await pjPenyusunAgent.post(`${API}/tte/profil`).send({ pin: PIN_TTE }).expect(201);
    await kepalaAgent.post(`${API}/tte/profil/setup/generate`).send({ pin: PIN_TTE }).expect(201);
    await kepalaLainAgent.post(`${API}/tte/profil`).send({ pin: PIN_TTE }).expect(201);

    await pjEvaluatorAgent
      .post(`${API}/tte/tanda-tangani/ba/${state.pengajuanId}`)
      .send({ pin: PIN_TTE, nomorDokumen: 'BA-INT-001', judulDokumen: 'Berita Acara Integration' })
      .expect(201);

    let pengajuan = await prisma.pengajuanEvaluasi.findUniqueOrThrow({
      where: { pengajuanEvaluasiId: state.pengajuanId },
    });
    expect(pengajuan.status).toBe(StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR);

    const duplicatePjEvaluator = await pjEvaluatorAgent
      .post(`${API}/tte/tanda-tangani/ba/${state.pengajuanId}`)
      .send({ pin: PIN_TTE, nomorDokumen: 'BA-INT-001', judulDokumen: 'Berita Acara Integration' });
    expectRejected(duplicatePjEvaluator.status);

    await pjPenyusunAgent
      .post(`${API}/tte/tanda-tangani/ba/${state.pengajuanId}`)
      .send({ pin: PIN_TTE, nomorDokumen: 'BA-INT-001', judulDokumen: 'Berita Acara Integration' })
      .expect(201);

    pengajuan = await prisma.pengajuanEvaluasi.findUniqueOrThrow({
      where: { pengajuanEvaluasiId: state.pengajuanId },
    });
    expect(pengajuan.status).toBe(StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN);

    const sopPdfBase64 = (await createMinimalPdfBuffer('SOP Integration Utama')).toString('base64');
    const sopPdfs = [{ detailSopId: state.detailSopId, pdfBase64: sopPdfBase64 }];
    const wrongKepala = await kepalaLainAgent
      .post(`${API}/tte/tanda-tangani/pengajuan/${state.pengajuanId}/sop-semua`)
      .send({
        pin: PIN_TTE,
        nomorDokumen: 'SOP-SIGN-INT-001',
        judulDokumen: 'Pengesahan SOP Integration',
        sopPdfs,
      });
    expectRejected(wrongKepala.status);

    await kepalaAgent
      .post(`${API}/tte/tanda-tangani/pengajuan/${state.pengajuanId}/sop-semua`)
      .send({
        pin: PIN_TTE,
        nomorDokumen: 'SOP-SIGN-INT-001',
        judulDokumen: 'Pengesahan SOP Integration',
        sopPdfs,
      })
      .expect(201);

    const detail = await prisma.detailSOP.findUniqueOrThrow({
      where: { detailSopId: state.detailSopId },
      include: { dokumenTte: { include: { riwayatTandaTangan: true } } },
    });
    const dokumenTte = detail.dokumenTte[0];
    expect(detail.status).toBe(StatusSOP.BERLAKU);
    expect(dokumenTte?.jenisDokumen).toBe(JenisDokumenTte.SOP_BERLAKU);
    expect(dokumenTte?.riwayatTandaTangan).toHaveLength(1);
  });

  it('menampilkan SOP berlaku di arsip publik tanpa data internal', async () => {
    const list = await request(app.getHttpServer()).get(`${API}/sop/public/sop`).expect(200);
    expect(JSON.stringify(list.body.data)).toContain('SOP Integration Utama');

    const detail = await request(app.getHttpServer())
      .get(`${API}/sop/public/dokumen/${state.detailSopId}`)
      .expect(200);
    expect(JSON.stringify(detail.body.data)).not.toContain('LogEdit');
    expect(JSON.stringify(detail.body.data)).not.toContain('Tambahkan detail keluaran');
  });

  it('menguji versi baru, penggantian versi berlaku, pencabutan SOP, dan endpoint read-only', async () => {
    const beforeRead = await prisma.detailSOP.findUniqueOrThrow({
      where: { detailSopId: state.detailSopId },
    });
    await pjPenyusunAgent.get(`${API}/evaluasi`).expect(200);
    await penyusunAgent.get(`${API}/sop`).expect(200);
    const afterRead = await prisma.detailSOP.findUniqueOrThrow({
      where: { detailSopId: state.detailSopId },
    });
    expect(afterRead.status).toBe(beforeRead.status);
    expect(afterRead.updatedAt.toISOString()).toBe(beforeRead.updatedAt.toISOString());

    const draftVersion = await penyusunAgent
      .post(`${API}/sop/${state.detailSopId}/buat-versi-baru`)
      .expect(201);
    const newDetailSopId = draftVersion.body.data.detail.id;

    await prisma.detailSOP.update({
      where: { detailSopId: state.detailSopId },
      data: { status: StatusSOP.DIGANTIKAN },
    });
    await prisma.detailSOP.update({
      where: { detailSopId: newDetailSopId },
      data: { status: StatusSOP.BERLAKU },
    });

    await kepalaAgent.post(`${API}/sop/cabut/${newDetailSopId}`).expect(200);

    const revoked = await prisma.detailSOP.findUniqueOrThrow({
      where: { detailSopId: newDetailSopId },
    });
    expect(revoked.status).toBe(StatusSOP.DICABUT);

    const statusLogs = await prisma.logEditSOP.findMany({
      where: { detailSopId: state.detailSopId, bagian: BagianSOP.STATUS },
    });
    expect(statusLogs.length).toBeGreaterThan(0);
  });
});
