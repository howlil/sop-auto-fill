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
  PeranPengguna,
  StatusPengajuanEvaluasi,
  JenisPengajuanEvaluasi,
} from '../../src/generated/prisma';

const describeIntegration = isIntegrationEnabled() ? describe : describe.skip;
const API = '/api/v1';
const PASSWORD = 'Integration123!';

async function seedUser(
  prisma: PrismaService,
  params: { email: string; nama: string; opdId: string; peran: PeranPengguna },
): Promise<void> {
  await prisma.pengguna.create({
    data: {
      email: params.email,
      nama: params.nama,
      nip: `NIP-${Math.random()}`,
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

describeIntegration('Evaluasi Grafik Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let pjEvaluatorAgent: Agent;
  let penyusunAgent: Agent;

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

    const opdA = await prisma.oPD.create({ data: { nama: 'OPD Grafik A' } });
    await seedUser(prisma, {
      email: 'pj-evaluator@grafik.test',
      nama: 'PJ Evaluator',
      opdId: opdA.opdId,
      peran: PeranPengguna.PJ_EVALUATOR,
    });
    await seedUser(prisma, {
      email: 'penyusun@grafik.test',
      nama: 'Penyusun',
      opdId: opdA.opdId,
      peran: PeranPengguna.PENYUSUN,
    });

    // Create some evaluasi data
    await prisma.pengajuanEvaluasi.createMany({
      data: [
        {
          opdId: opdA.opdId,
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
          createdAt: new Date(),
        },
        {
          opdId: opdA.opdId,
          status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
          createdAt: new Date(),
        },
      ],
    });

    pjEvaluatorAgent = await loginAgent(app, 'pj-evaluator@grafik.test');
    penyusunAgent = await loginAgent(app, 'penyusun@grafik.test');
  });

  afterAll(async () => {
    try {
      if (prisma) await resetIntegrationDatabase(prisma);
    } finally {
      if (app) await app.close();
    }
  });

  it('seharusnya menolak akses jika bukan PJ_EVALUATOR (Worst Case Role)', async () => {
    const response = await penyusunAgent.get(`${API}/evaluasi/laporan/grafik-tahunan`);
    expect(response.status).toBe(403);
  });

  it('seharusnya berhasil mengambil data grafik tahunan untuk PJ_EVALUATOR', async () => {
    const response = await pjEvaluatorAgent
      .get(`${API}/evaluasi/laporan/grafik-tahunan`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.ringkasanPerTahun).toBeDefined();
    expect(response.body.data.ringkasanPerTahun.length).toBeGreaterThan(0);
    expect(response.body.data.totalOpdAktif).toBeGreaterThan(0);
  });

  it('seharusnya berhasil mengambil data grafik tahunan dengan filter tahun spesifik', async () => {
    const currentYear = new Date().getFullYear();
    const response = await pjEvaluatorAgent
      .get(
        `${API}/evaluasi/laporan/grafik-tahunan?tahunDari=${currentYear}&tahunSampai=${currentYear}`,
      )
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.ringkasanPerTahun.length).toBe(1);
    expect(response.body.data.ringkasanPerTahun[0].tahun).toEqual(currentYear);
  });
});
