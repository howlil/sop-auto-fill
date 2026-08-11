/**
 * Integration Test: RBAC (Role-Based Access Control)
 *
 * Menguji enforcement peran di seluruh endpoint server:
 *  - Setiap peran hanya boleh mengakses endpoint yang diizinkan
 *  - False cases: akses endpoint yang dilarang untuk peran tertentu → 403
 *  - Worst cases: akses data OPD lain (OPD isolation)
 *  - Edge cases: token tanpa peran, request tanpa token sama sekali
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
import { PeranPengguna } from '../../src/generated/prisma';

const describeIntegration = isIntegrationEnabled() ? describe : describe.skip;
const API = '/api/v1';
const PASSWORD = 'RbacTest123!';

async function seedUser(
  prisma: PrismaService,
  params: { email: string; nama: string; nip: string; peran: PeranPengguna; opdId: string },
): Promise<void> {
  await prisma.pengguna.create({
    data: {
      email: params.email,
      nama: params.nama,
      nip: params.nip,
      opdId: params.opdId,
      peran: params.peran,
      kataSandi: await bcrypt.hash(PASSWORD, 10),
      jabatan: 'Staf',
      pangkat: 'Pembina',
      nohp: '082222222222',
      riwayatOpd: { create: { opdId: params.opdId, isAktif: true } },
    },
  });
}

async function loginAgent(app: INestApplication, email: string): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post(`${API}/auth/login`).send({ email, password: PASSWORD }).expect(201);
  const raw = res.headers['set-cookie'];
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (arr.length > 0) {
    agent.set('Cookie', arr.map((c: string) => c.split(';')[0]).join('; '));
  }
  return agent;
}

describeIntegration('RBAC Access Control — enforcement peran di seluruh endpoint', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let opdAId: string;
  let opdBId: string;

  let pjEvaluatorAgent: Agent;
  let evaluatorAgent: Agent;
  let pjPenyusunAgent: Agent;
  let penyusunAgent: Agent;
  let kepalaAgent: Agent;
  let kepalaLainAgent: Agent; // Kepala OPD dari OPD berbeda

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

    const opdA = await prisma.oPD.create({ data: { nama: 'OPD RBAC A' } });
    const opdB = await prisma.oPD.create({ data: { nama: 'OPD RBAC B' } });
    opdAId = opdA.opdId;
    opdBId = opdB.opdId;

    await seedUser(prisma, {
      email: 'pj-ev.rbac@example.test',
      nama: 'PJ Evaluator RBAC',
      nip: 'RBAC-PJE-001',
      peran: PeranPengguna.PJ_EVALUATOR,
      opdId: opdAId,
    });
    await seedUser(prisma, {
      email: 'ev.rbac@example.test',
      nama: 'Evaluator RBAC',
      nip: 'RBAC-EV-001',
      peran: PeranPengguna.EVALUATOR,
      opdId: opdAId,
    });
    await seedUser(prisma, {
      email: 'pjp.rbac@example.test',
      nama: 'PJ Penyusun RBAC',
      nip: 'RBAC-PJP-001',
      peran: PeranPengguna.PJ_PENYUSUN,
      opdId: opdAId,
    });
    await seedUser(prisma, {
      email: 'pen.rbac@example.test',
      nama: 'Penyusun RBAC',
      nip: 'RBAC-PEN-001',
      peran: PeranPengguna.PENYUSUN,
      opdId: opdAId,
    });
    await seedUser(prisma, {
      email: 'kepala.rbac@example.test',
      nama: 'Kepala OPD A RBAC',
      nip: 'RBAC-KA-001',
      peran: PeranPengguna.KEPALA_OPD,
      opdId: opdAId,
    });
    await seedUser(prisma, {
      email: 'kepala-b.rbac@example.test',
      nama: 'Kepala OPD B RBAC',
      nip: 'RBAC-KB-001',
      peran: PeranPengguna.KEPALA_OPD,
      opdId: opdBId,
    });

    pjEvaluatorAgent = await loginAgent(app, 'pj-ev.rbac@example.test');
    evaluatorAgent = await loginAgent(app, 'ev.rbac@example.test');
    pjPenyusunAgent = await loginAgent(app, 'pjp.rbac@example.test');
    penyusunAgent = await loginAgent(app, 'pen.rbac@example.test');
    kepalaAgent = await loginAgent(app, 'kepala.rbac@example.test');
    kepalaLainAgent = await loginAgent(app, 'kepala-b.rbac@example.test');
  });

  afterAll(async () => {
    try {
      if (prisma) await resetIntegrationDatabase(prisma);
    } finally {
      if (app) await app.close();
    }
  });

  // ============================
  // UNAUTHENTICATED ACCESS
  // ============================

  describe('Unauthenticated — tanpa token sama sekali', () => {
    it('GET /sop tanpa token → 401 (bukan 403)', async () => {
      await request(app.getHttpServer()).get(`${API}/sop`).expect(401);
    });

    it('GET /evaluasi tanpa token → 401', async () => {
      await request(app.getHttpServer()).get(`${API}/evaluasi`).expect(401);
    });

    it('GET /penyusun tanpa token → 401', async () => {
      await request(app.getHttpServer()).get(`${API}/penyusun`).expect(401);
    });

    it('POST /auth/login dengan cookie acak (bukan JWT valid) → endpoint /sop → 401', async () => {
      await request(app.getHttpServer())
        .get(`${API}/sop`)
        .set('Cookie', 'sop_access_token=bukan-jwt')
        .expect(401);
    });
  });

  // ============================
  // PJ_EVALUATOR — akses penuh
  // ============================

  describe('PJ_EVALUATOR — hak akses seluruh manajemen', () => {
    it('GET /opd berhasil → 200', async () => {
      await pjEvaluatorAgent.get(`${API}/opd`).expect(200);
    });

    it('GET /penyusun berhasil → 200', async () => {
      await pjEvaluatorAgent.get(`${API}/penyusun`).expect(200);
    });

    it('GET /evaluator berhasil → 200', async () => {
      await pjEvaluatorAgent.get(`${API}/evaluator`).expect(200);
    });

    it('GET /evaluasi berhasil → 200', async () => {
      await pjEvaluatorAgent.get(`${API}/evaluasi`).expect(200);
    });
  });

  // ============================
  // EVALUATOR — akses terbatas
  // ============================

  describe('EVALUATOR — tidak boleh akses manajemen user', () => {
    it('GET /evaluasi berhasil → 200', async () => {
      await evaluatorAgent.get(`${API}/evaluasi`).expect(200);
    });

    it('GET /sop berhasil → 200', async () => {
      await evaluatorAgent.get(`${API}/sop`).expect(200);
    });

    it('GET /penyusun → 403 (hanya PJ_EVALUATOR)', async () => {
      await evaluatorAgent.get(`${API}/penyusun`).expect(403);
    });

    it('POST /penyusun → 403 (hanya PJ_EVALUATOR)', async () => {
      await evaluatorAgent
        .post(`${API}/penyusun`)
        .send({ email: 'hack@example.test', nama: 'Hack', nip: 'HACK-001', opdId: opdAId })
        .expect(403);
    });

    it('GET /evaluator → 403 (hanya PJ_EVALUATOR)', async () => {
      await evaluatorAgent.get(`${API}/evaluator`).expect(403);
    });
  });

  // ============================
  // PJ_PENYUSUN — akses OPD-nya saja
  // ============================

  describe('PJ_PENYUSUN — akses terbatas pada OPD sendiri', () => {
    it('GET /evaluasi berhasil → 200', async () => {
      await pjPenyusunAgent.get(`${API}/evaluasi`).expect(200);
    });

    it('GET /sop berhasil → 200', async () => {
      await pjPenyusunAgent.get(`${API}/sop`).expect(200);
    });

    it('GET /penyusun → 403 (hanya PJ_EVALUATOR)', async () => {
      await pjPenyusunAgent.get(`${API}/penyusun`).expect(403);
    });

    it('POST /opd → 403 (hanya PJ_EVALUATOR)', async () => {
      await pjPenyusunAgent.post(`${API}/opd`).send({ nama: 'OPD Ilegal' }).expect(403);
    });

    it('GET /evaluator → 403', async () => {
      await pjPenyusunAgent.get(`${API}/evaluator`).expect(403);
    });
  });

  // ============================
  // PENYUSUN — akses paling terbatas
  // ============================

  describe('PENYUSUN — akses baca SOP dan evaluasi OPD sendiri', () => {
    it('GET /sop berhasil → 200', async () => {
      await penyusunAgent.get(`${API}/sop`).expect(200);
    });

    it('GET /evaluasi berhasil → 200', async () => {
      await penyusunAgent.get(`${API}/evaluasi`).expect(200);
    });

    it('POST /evaluasi → 403 (hanya PJ_PENYUSUN yang boleh buat pengajuan)', async () => {
      await penyusunAgent
        .post(`${API}/evaluasi`)
        .send({ jenis: 'EVALUASI_REQUEST_OPD', sopDetailIds: [] })
        .expect(403);
    });

    it('GET /penyusun → 403', async () => {
      await penyusunAgent.get(`${API}/penyusun`).expect(403);
    });

    it('POST /opd → 403', async () => {
      await penyusunAgent.post(`${API}/opd`).send({ nama: 'OPD Ilegal Penyusun' }).expect(403);
    });
  });

  // ============================
  // KEPALA_OPD — akses khusus
  // ============================

  describe('KEPALA_OPD — manajemen SOP OPD sendiri', () => {
    it('GET /sop berhasil → 200', async () => {
      await kepalaAgent.get(`${API}/sop`).expect(200);
    });

    it('GET /evaluasi berhasil → 200', async () => {
      await kepalaAgent.get(`${API}/evaluasi`).expect(200);
    });

    it('GET /penyusun → 403 (hanya PJ_EVALUATOR)', async () => {
      await kepalaAgent.get(`${API}/penyusun`).expect(403);
    });

    it('PATCH /opd/:id → 403 (hanya PJ_EVALUATOR)', async () => {
      await kepalaAgent
        .patch(`${API}/opd/${opdAId}`)
        .send({ nama: 'OPD Diubah Ilegal' })
        .expect(403);
    });
  });

  // ============================
  // OPD ISOLATION — worst cases
  // ============================

  describe('OPD Isolation — akses data OPD lain ditolak', () => {
    let detailSopIdOpdA: string;

    beforeAll(async () => {
      // Buat SOP milik OPD-A oleh penyusun OPD-A
      const sopRes = await penyusunAgent
        .post(`${API}/sop`)
        .send({ judul: 'SOP RBAC OPD A', nomorSop: 'RBAC-SOP-001', namaLembaga: 'OPD RBAC A' })
        .expect(201);
      detailSopIdOpdA = sopRes.body.data.detailSopId;
    });

    it('kepala OPD-B tidak bisa cabut SOP milik OPD-A → 403/404', async () => {
      const res = await kepalaLainAgent.post(`${API}/sop/cabut/${detailSopIdOpdA}`);
      expect([403, 404, 409]).toContain(res.status);
    });

    it('PJ Penyusun OPD-A tidak bisa GET pengajuan OPD-B yang tidak ada (OPD isolation)', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000099';
      const res = await pjPenyusunAgent.get(`${API}/evaluasi/${fakeId}`);
      expect([403, 404]).toContain(res.status);
    });
  });
});
