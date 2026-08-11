import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request, { type Agent } from 'supertest';
import * as bcrypt from 'bcrypt';
import { createDefaultValidationPipe } from '../../src/common';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import {
  HasilEvaluasi,
  JenisDokumenTte,
  JenisLangkahProsedur,
  JenisPengajuanEvaluasi,
  PeranPengguna,
  SatuanWaktu,
  StatusSOP,
} from '../../src/generated/prisma';
import {
  assertSafeIntegrationDatabase,
  pingIntegrationDatabase,
  resetIntegrationDatabase,
} from './helpers/integration-database.util';
import {
  applyTestPdfSigningEnv,
  buildValidasiPengesahanPath,
  buildValidasiPengesahanUrl,
  createMinimalPdfBuffer,
  PUBLIC_APP_ORIGIN,
} from './helpers/integration-pdf.util';
import { isIntegrationEnabled } from './helpers/integration-runtime.util';

const describeIntegration = isIntegrationEnabled() ? describe : describe.skip;
const API = '/api/v1';
const PASSWORD = 'Integration123!';
const PIN_TTE = '123456';

type TteVerifikasiState = {
  opdAId: string;
  detailSopId: string;
  pengajuanId: string;
  pjEvaluatorUserId: string;
  pjPenyusunUserId: string;
  kepalaUserId: string;
  baDokumenTteId: string;
  sopDokumenTteId: string;
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
): Promise<string> {
  const created = await prisma.pengguna.create({
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
  return created.penggunaId;
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

async function seedUsersForTtePdfTest(prisma: PrismaService): Promise<{
  opdAId: string;
  pjEvaluatorUserId: string;
  pjPenyusunUserId: string;
  kepalaUserId: string;
}> {
  const opdA = await prisma.oPD.create({ data: { nama: 'OPD TTE PDF Integration' } });
  const pjEvaluatorUserId = await seedUser(prisma, {
    email: 'pj-evaluator.pdf-int@example.test',
    nama: 'PJ Evaluator PDF Int',
    nip: 'INT-PJE-PDF-001',
    opdId: opdA.opdId,
    peran: PeranPengguna.PJ_EVALUATOR,
  });
  await seedUser(prisma, {
    email: 'evaluator.pdf-int@example.test',
    nama: 'Evaluator PDF Int',
    nip: 'INT-EV-PDF-001',
    opdId: opdA.opdId,
    peran: PeranPengguna.EVALUATOR,
  });
  const pjPenyusunUserId = await seedUser(prisma, {
    email: 'pj-penyusun.pdf-int@example.test',
    nama: 'PJ Penyusun PDF Int',
    nip: 'INT-PJP-PDF-001',
    opdId: opdA.opdId,
    peran: PeranPengguna.PJ_PENYUSUN,
  });
  await seedUser(prisma, {
    email: 'penyusun.pdf-int@example.test',
    nama: 'Penyusun PDF Int',
    nip: 'INT-PEN-PDF-001',
    opdId: opdA.opdId,
    peran: PeranPengguna.PENYUSUN,
  });
  const kepalaUserId = await seedUser(prisma, {
    email: 'kepala.pdf-int@example.test',
    nama: 'Kepala OPD PDF Int',
    nip: 'INT-KA-PDF-001',
    opdId: opdA.opdId,
    peran: PeranPengguna.KEPALA_OPD,
  });

  return { opdAId: opdA.opdId, pjEvaluatorUserId, pjPenyusunUserId, kepalaUserId };
}

async function runMinimalTteWorkflow(
  prisma: PrismaService,
  opdAId: string,
  userIds: { pjEvaluatorUserId: string; pjPenyusunUserId: string; kepalaUserId: string },
  penyusunAgent: Agent,
  pjPenyusunAgent: Agent,
  evaluatorAgent: Agent,
  pjEvaluatorAgent: Agent,
  kepalaAgent: Agent,
): Promise<TteVerifikasiState> {
  const createMain = await penyusunAgent
    .post(`${API}/sop`)
    .send({
      judul: 'SOP PDF TTE Integration',
      nomorSop: 'INT-PDF-SOP-001',
      namaLembaga: 'OPD TTE PDF Integration',
    })
    .expect(201);
  const detailSopId = createMain.body.data.detailSopId as string;

  const createRelated = await penyusunAgent
    .post(`${API}/sop`)
    .send({
      judul: 'SOP PDF TTE Terkait',
      nomorSop: 'INT-PDF-SOP-002',
      namaLembaga: 'OPD TTE PDF Integration',
    })
    .expect(201);
  const relatedDetailSopId = createRelated.body.data.detailSopId as string;

  const peraturan = await penyusunAgent
    .post(`${API}/peraturan`)
    .send({
      namaPeraturan: 'Peraturan PDF TTE Integration',
      nomor: 'INT-PDF-REG-001',
      tahun: 2026,
      tentang: 'Dasar hukum uji integration PDF TTE',
    })
    .expect(201);

  const pelaksana = await penyusunAgent
    .post(`${API}/pelaksana`)
    .send({ namaPelaksana: 'Pelaksana PDF Int' })
    .expect(201);

  await penyusunAgent
    .patch(`${API}/sop/header/${detailSopId}`)
    .send({
      judul: 'SOP PDF TTE Integration',
      namaLembaga: 'OPD TTE PDF Integration',
      dasarHukumPeraturanIds: [peraturan.body.data.id],
      sopTerkaitDetailIds: [relatedDetailSopId],
      lampiran: {
        peringatan: ['Uji.'],
        kualifikasiPelaksanaan: ['Uji.'],
        peralatanPerlengkapan: ['Uji.'],
        pencatatanPendataan: ['Uji.'],
      },
    })
    .expect(200);

  await penyusunAgent
    .patch(`${API}/sop/langkah/${detailSopId}`)
    .send({
      pelaksana: [{ pelaksanaId: pelaksana.body.data.id }],
      langkah: [
        {
          tempId: 'step-1',
          jenis: JenisLangkahProsedur.AWAL_AKHIR,
          kegiatan: 'Langkah uji PDF',
          kelengkapan: 'Dokumen',
          keluaran: 'Selesai',
          waktu: 1,
          satuanWaktu: SatuanWaktu.d,
          keterangan: 'Integration',
          pelaksanaId: pelaksana.body.data.id,
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
    where: { opdId: opdAId },
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
    .send({ nomorBA: 'BA-EVAL-PDF-INT-001' })
    .expect(200);

  await pjEvaluatorAgent.post(`${API}/tte/profil`).send({ pin: PIN_TTE }).expect(201);
  await pjPenyusunAgent.post(`${API}/tte/profil`).send({ pin: PIN_TTE }).expect(201);
  await kepalaAgent.post(`${API}/tte/profil/setup/generate`).send({ pin: PIN_TTE }).expect(201);

  await pjEvaluatorAgent
    .post(`${API}/tte/tanda-tangani/ba/${pengajuan.pengajuanEvaluasiId}`)
    .send({ pin: PIN_TTE, nomorDokumen: 'BA-PDF-INT-001', judulDokumen: 'BA PDF Integration' })
    .expect(201);

  await pjPenyusunAgent
    .post(`${API}/tte/tanda-tangani/ba/${pengajuan.pengajuanEvaluasiId}`)
    .send({ pin: PIN_TTE, nomorDokumen: 'BA-PDF-INT-001', judulDokumen: 'BA PDF Integration' })
    .expect(201);

  const sopPdfBase64 = (await createMinimalPdfBuffer('SOP PDF official integration')).toString(
    'base64',
  );
  await kepalaAgent
    .post(`${API}/tte/tanda-tangani/pengajuan/${pengajuan.pengajuanEvaluasiId}/sop-semua`)
    .send({
      pin: PIN_TTE,
      nomorDokumen: 'SOP-PDF-INT-001',
      judulDokumen: 'SOP PDF Integration',
      sopPdfs: [{ detailSopId, pdfBase64: sopPdfBase64 }],
    })
    .expect(201);

  const baDokumen = await prisma.dokumenTte.findFirstOrThrow({
    where: {
      pengajuanEvaluasiId: pengajuan.pengajuanEvaluasiId,
      jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
    },
  });

  const sopDokumen = await prisma.dokumenTte.findFirstOrThrow({
    where: {
      detailSopId,
      jenisDokumen: JenisDokumenTte.SOP_BERLAKU,
    },
  });

  return {
    opdAId,
    detailSopId,
    pengajuanId: pengajuan.pengajuanEvaluasiId,
    pjEvaluatorUserId: userIds.pjEvaluatorUserId,
    pjPenyusunUserId: userIds.pjPenyusunUserId,
    kepalaUserId: userIds.kepalaUserId,
    baDokumenTteId: baDokumen.dokumenTteId,
    sopDokumenTteId: sopDokumen.dokumenTteId,
  };
}

describeIntegration('TTE PDF unduhan — verifikasi QR dan CA (IT-76–IT-81)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let penyusunAgent: Agent;
  let pjPenyusunAgent: Agent;
  let evaluatorAgent: Agent;
  let pjEvaluatorAgent: Agent;
  let kepalaAgent: Agent;
  let state: TteVerifikasiState;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    applyTestPdfSigningEnv();

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

    const seededUsers = await seedUsersForTtePdfTest(prisma);

    penyusunAgent = await loginAgent(app, 'penyusun.pdf-int@example.test');
    pjPenyusunAgent = await loginAgent(app, 'pj-penyusun.pdf-int@example.test');
    evaluatorAgent = await loginAgent(app, 'evaluator.pdf-int@example.test');
    pjEvaluatorAgent = await loginAgent(app, 'pj-evaluator.pdf-int@example.test');
    kepalaAgent = await loginAgent(app, 'kepala.pdf-int@example.test');

    state = await runMinimalTteWorkflow(
      prisma,
      seededUsers.opdAId,
      seededUsers,
      penyusunAgent,
      pjPenyusunAgent,
      evaluatorAgent,
      pjEvaluatorAgent,
      kepalaAgent,
    );
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

  it('IT-76: URL QR BA PJ Evaluator mengarah ke API publik pengesahan dengan penandatangan valid', async () => {
    const qrUrl = buildValidasiPengesahanUrl(
      PUBLIC_APP_ORIGIN,
      state.baDokumenTteId,
      state.pjEvaluatorUserId,
    );
    expect(qrUrl).toContain(
      buildValidasiPengesahanPath(state.baDokumenTteId, state.pjEvaluatorUserId),
    );

    const response = await request(app.getHttpServer())
      .get(`${API}/tte/public/pengesahan/${state.baDokumenTteId}/${state.pjEvaluatorUserId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.dokumenTteId).toBe(state.baDokumenTteId);
    expect(response.body.data.userId).toBe(state.pjEvaluatorUserId);
    expect(response.body.data.peran).toBe('PJ_EVALUATOR');
    expect(response.body.data.penandatangan.nama).toBe('PJ Evaluator PDF Int');
    expect(response.body.data.penandatangan.nip).toBe('INT-PJE-PDF-001');
    expect(response.body.data.dokumen.jenisDokumen).toBe(JenisDokumenTte.BERITA_ACARA_EVALUASI);
  });

  it('IT-77: URL QR SOP Kepala OPD mengarah ke API publik pengesahan dengan peran KEPALA_OPD', async () => {
    const qrUrl = buildValidasiPengesahanUrl(
      PUBLIC_APP_ORIGIN,
      state.sopDokumenTteId,
      state.kepalaUserId,
    );
    expect(qrUrl).toContain(buildValidasiPengesahanPath(state.sopDokumenTteId, state.kepalaUserId));

    const response = await request(app.getHttpServer())
      .get(`${API}/tte/public/pengesahan/${state.sopDokumenTteId}/${state.kepalaUserId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.dokumenTteId).toBe(state.sopDokumenTteId);
    expect(response.body.data.userId).toBe(state.kepalaUserId);
    expect(response.body.data.peran).toBe('KEPALA_OPD');
    expect(response.body.data.penandatangan.nama).toBe('Kepala OPD PDF Int');
    expect(response.body.data.dokumen.jenisDokumen).toBe(JenisDokumenTte.SOP_BERLAKU);
  });

  it('IT-81: pengesahan publik ditolak ketika userId tidak cocok dengan dokumen TTE', async () => {
    await request(app.getHttpServer())
      .get(
        `${API}/tte/public/pengesahan/${state.baDokumenTteId}/00000000-0000-4000-8000-000000009999`,
      )
      .expect(404);
  });

  it('IT-78: PDF SOP ditandatangani PKCS#7 dan diverifikasi valid terhadap CA internal', async () => {
    const publishedPdf = await request(app.getHttpServer())
      .get(`${API}/sop/public/pdf/${state.detailSopId}`)
      .expect('Content-Type', /application\/pdf/)
      .expect(200);

    const verifyResponse = await request(app.getHttpServer())
      .post(`${API}/tte/public/pdf/verify`)
      .send({ pdfBase64: publishedPdf.body.toString('base64') })
      .expect(201);

    expect(verifyResponse.body.success).toBe(true);
    expect(verifyResponse.body.data.pdfSigningEnabled).toBe(true);
    expect(verifyResponse.body.data.hasSignatures).toBe(true);
    expect(verifyResponse.body.data.allValid).toBe(true);
    expect(verifyResponse.body.data.trustedCaSubject).toBeNull();
    expect(verifyResponse.body.data.signatures).toHaveLength(1);
    expect(verifyResponse.body.data.signatures[0].valid).toBe(true);
    expect(verifyResponse.body.data.signatures[0].checks.digestMatch).toBe(true);
    expect(verifyResponse.body.data.signatures[0].tteMatch.matched).toBe(true);
  });

  it('IT-79: PDF Berita Acara arsip tidak diinjeksi CA dan tetap tanpa signature PKCS#7', async () => {
    const unsignedPdf = await createMinimalPdfBuffer('BA arsip PDF integration unsigned');
    const pdfBase64 = unsignedPdf.toString('base64');

    const signResponse = await pjEvaluatorAgent
      .post(`${API}/tte/pdf/sign`)
      .send({
        pin: PIN_TTE,
        dokumenTteId: state.baDokumenTteId,
        userId: state.pjEvaluatorUserId,
        jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
        pdfBase64,
      })
      .expect(201);

    expect(signResponse.body.data.signed).toBe(false);
    expect(signResponse.body.data.signatureFormat).toBe('UNSIGNED_NOT_REQUIRED');
    expect(signResponse.body.data.certificate).toBeNull();
    expect(signResponse.body.data.signedPdfBase64).toBe(pdfBase64);

    const verifyResponse = await request(app.getHttpServer())
      .post(`${API}/tte/public/pdf/verify`)
      .send({ pdfBase64: signResponse.body.data.signedPdfBase64 })
      .expect(201);

    expect(verifyResponse.body.data.hasSignatures).toBe(false);
    expect(verifyResponse.body.data.allValid).toBe(false);
    expect(verifyResponse.body.data.signatures).toHaveLength(0);
  });

  it('IT-80: PDF tanpa tanda tangan digital ditolak verifikasi', async () => {
    const unsignedPdf = await createMinimalPdfBuffer('PDF unsigned integration');
    const verifyResponse = await request(app.getHttpServer())
      .post(`${API}/tte/public/pdf/verify`)
      .send({ pdfBase64: unsignedPdf.toString('base64') })
      .expect(201);

    expect(verifyResponse.body.data.hasSignatures).toBe(false);
    expect(verifyResponse.body.data.allValid).toBe(false);
  });

  it('GET /tte/public/pdf-signing/status menyatakan penandatanganan PDF personal aktif', async () => {
    const statusResponse = await request(app.getHttpServer())
      .get(`${API}/tte/public/pdf-signing/status`)
      .expect(200);

    expect(statusResponse.body.success).toBe(true);
    expect(statusResponse.body.data.enabled).toBe(true);
    expect(statusResponse.body.data.trustedCaSubject).toBeNull();
  });
});
