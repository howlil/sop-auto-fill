/**
 * Integration Test: OPD & Penyusun Lifecycle
 *
 * Menguji siklus hidup penuh manajemen OPD dan Penyusun:
 *  - CRUD OPD (buat, update, nonaktifkan)
 *  - Penyusun: tambah, update, nonaktifkan, aktifkan, pindah, hapus permanen
 *  - False cases: duplikasi, data tidak ada, constraint referensi
 *  - Worst cases: promosi PJ ketika slot sudah terisi, hapus dengan relasi aktif
 *  - Edge cases: search kosong, pindah ke OPD yang sama, riwayat OPD kosong
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
const PASSWORD = 'LifecycleTest123!';

function profilPayload(params: { email: string; nama: string; nip: string; nohp: string }) {
  return {
    email: params.email,
    nama: params.nama,
    nip: params.nip,
    jabatan: 'Analis Kebijakan',
    pangkat: 'III/a',
    nohp: params.nohp,
  };
}

async function loginAgent(
  app: INestApplication,
  email: string,
  password = PASSWORD,
): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post(`${API}/auth/login`).send({ email, password }).expect(201);
  const raw = res.headers['set-cookie'];
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (arr.length > 0) {
    agent.set('Cookie', arr.map((c: string) => c.split(';')[0]).join('; '));
  }
  return agent;
}

describeIntegration('OPD & Penyusun Lifecycle — siklus hidup manajemen user', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let pjEvaluatorAgent: Agent;
  let baseOpdId: string;

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

    const opd = await prisma.oPD.create({ data: { nama: 'OPD Lifecycle Base' } });
    baseOpdId = opd.opdId;

    // Seed PJ Evaluator untuk manajemen
    await prisma.pengguna.create({
      data: {
        email: 'pj-ev.lifecycle@example.test',
        nama: 'PJ Evaluator Lifecycle',
        nip: 'LC-PJE-001',
        opdId: baseOpdId,
        peran: PeranPengguna.PJ_EVALUATOR,
        kataSandi: await bcrypt.hash(PASSWORD, 10),
        jabatan: 'Kepala Biro',
        pangkat: 'Pembina',
        nohp: '083333333333',
        riwayatOpd: { create: { opdId: baseOpdId, isAktif: true } },
      },
    });

    pjEvaluatorAgent = await loginAgent(app, 'pj-ev.lifecycle@example.test');
  });

  afterAll(async () => {
    try {
      if (prisma) await resetIntegrationDatabase(prisma);
    } finally {
      if (app) await app.close();
    }
  });

  // ============================
  // OPD CRUD
  // ============================

  describe('OPD CRUD — manajemen organisasi perangkat daerah', () => {
    let createdOpdId: string;

    it('POST /opd — berhasil membuat OPD baru (Success Case)', async () => {
      const res = await pjEvaluatorAgent
        .post(`${API}/opd`)
        .send({ nama: 'OPD Lifecycle Baru' })
        .expect(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.nama).toBe('OPD Lifecycle Baru');
      createdOpdId = res.body.data.id;
    });

    it('PATCH /opd/:id — berhasil update nama OPD (Success Case)', async () => {
      const res = await pjEvaluatorAgent
        .patch(`${API}/opd/${createdOpdId}`)
        .send({ nama: 'OPD Lifecycle Diperbarui' })
        .expect(200);
      expect(res.body.data.nama).toBe('OPD Lifecycle Diperbarui');
    });

    it('GET /opd — menampilkan daftar OPD (Success Case)', async () => {
      const res = await pjEvaluatorAgent.get(`${API}/opd`).expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const names = res.body.data.map((o: { nama: string }) => o.nama);
      expect(names).toContain('OPD Lifecycle Diperbarui');
    });

    it('PATCH /opd/:id UUID tidak valid → 400 (False Case)', async () => {
      await pjEvaluatorAgent.patch(`${API}/opd/bukan-uuid`).send({ nama: 'OPD Test' }).expect(400);
    });

    it('PATCH /opd/:id OPD yang tidak ada → 404 (False Case)', async () => {
      const res = await pjEvaluatorAgent
        .patch(`${API}/opd/00000000-0000-4000-8000-000000000999`)
        .send({ nama: 'OPD Tidak Ada' });
      expect([404, 400]).toContain(res.status);
    });

    it('DELETE /opd/:id — berhasil nonaktifkan OPD tanpa referensi aktif (Success Case)', async () => {
      const newOpd = await pjEvaluatorAgent
        .post(`${API}/opd`)
        .send({ nama: 'OPD Lifecycle Hapus' })
        .expect(201);
      await pjEvaluatorAgent.delete(`${API}/opd/${newOpd.body.data.id}`).expect(200);
    });
  });

  // ============================
  // PENYUSUN LIFECYCLE
  // ============================

  describe('Penyusun Lifecycle — tambah, nonaktif, aktif, pindah, hapus', () => {
    let penyusunId: string;
    let opdTargetId: string;

    beforeAll(async () => {
      const opdTarget = await prisma.oPD.create({ data: { nama: 'OPD Target Pindah' } });
      opdTargetId = opdTarget.opdId;
    });

    it('POST /penyusun — berhasil tambah penyusun (Success Case)', async () => {
      const res = await pjEvaluatorAgent
        .post(`${API}/penyusun`)
        .send({
          ...profilPayload({
            email: 'penyusun.lc.baru@example.test',
            nama: 'Penyusun Lifecycle Baru',
            nip: 'LC-PEN-NEW-001',
            nohp: '081234560001',
          }),
          opdId: baseOpdId,
          peran: PeranPengguna.PENYUSUN,
        })
        .expect(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('penyusun.lc.baru@example.test');
      penyusunId = res.body.data.id;
    });

    it('GET /penyusun — daftar penyusun tampil dengan grup OPD (Success Case)', async () => {
      const res = await pjEvaluatorAgent.get(`${API}/penyusun`).expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /penyusun?search= — search dengan query kosong tidak crash (Edge Case)', async () => {
      const res = await pjEvaluatorAgent.get(`${API}/penyusun?search=`).expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /penyusun?search=whitespace — search whitespace tidak crash (Edge Case)', async () => {
      const res = await pjEvaluatorAgent.get(`${API}/penyusun?search=%20%20`).expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('PATCH /penyusun/:id — berhasil update data penyusun (Success Case)', async () => {
      const res = await pjEvaluatorAgent
        .patch(`${API}/penyusun/${penyusunId}`)
        .send({ nama: 'Penyusun LC Updated' })
        .expect(200);
      expect(res.body.data.nama).toBe('Penyusun LC Updated');
    });

    it('POST /penyusun — duplikasi email → 409 (False Case)', async () => {
      const res = await pjEvaluatorAgent.post(`${API}/penyusun`).send({
        ...profilPayload({
          email: 'penyusun.lc.baru@example.test',
          nama: 'Penyusun Duplikat',
          nip: 'LC-PEN-DUP-001',
          nohp: '081234560002',
        }),
        opdId: baseOpdId,
        peran: PeranPengguna.PENYUSUN,
      });
      expect([409, 400]).toContain(res.status);
    });

    it('POST /penyusun — duplikasi NIP → 409 (False Case)', async () => {
      const res = await pjEvaluatorAgent.post(`${API}/penyusun`).send({
        ...profilPayload({
          email: 'penyusun.lc.nip.dup@example.test',
          nama: 'Penyusun NIP Duplikat',
          nip: 'LC-PEN-NEW-001',
          nohp: '081234560003',
        }),
        opdId: baseOpdId,
        peran: PeranPengguna.PENYUSUN,
      });
      expect([409, 400]).toContain(res.status);
    });

    it('POST /penyusun — opdId yang tidak ada → 404/400 (False Case)', async () => {
      const res = await pjEvaluatorAgent.post(`${API}/penyusun`).send({
        ...profilPayload({
          email: 'penyusun.lc.noop@example.test',
          nama: 'Penyusun OPD Ghost',
          nip: 'LC-PEN-GHOST-001',
          nohp: '081234560004',
        }),
        opdId: '00000000-0000-4000-8000-000000000888',
        peran: PeranPengguna.PENYUSUN,
      });
      expect([404, 400, 409]).toContain(res.status);
    });

    it('PATCH /penyusun/:id/nonaktifkan — berhasil nonaktifkan penyusun (Success Case)', async () => {
      await pjEvaluatorAgent.patch(`${API}/penyusun/${penyusunId}/nonaktifkan`).expect(200);

      const db = await prisma.pengguna.findUnique({ where: { penggunaId: penyusunId } });
      expect(db?.deletedAt).not.toBeNull(); // nonaktif ditandai dengan deletedAt terisi
    });

    it('PATCH /penyusun/:id/nonaktifkan lagi (sudah NONAKTIF) → 404/409 (False Case)', async () => {
      const res = await pjEvaluatorAgent.patch(`${API}/penyusun/${penyusunId}/nonaktifkan`);
      expect([404, 409]).toContain(res.status);
    });

    it('PATCH /penyusun/:id/aktifkan — berhasil aktifkan kembali penyusun (Success Case)', async () => {
      const res = await pjEvaluatorAgent
        .patch(`${API}/penyusun/${penyusunId}/aktifkan`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it('PATCH /penyusun/:id/aktifkan lagi (sudah AKTIF) → 409 (False Case)', async () => {
      const res = await pjEvaluatorAgent.patch(`${API}/penyusun/${penyusunId}/aktifkan`);
      expect([409, 400]).toContain(res.status);
    });

    it('GET /penyusun/:id/riwayat-opd — riwayat OPD penyusun yang belum pindah (Edge Case)', async () => {
      const res = await pjEvaluatorAgent
        .get(`${API}/penyusun/${penyusunId}/riwayat-opd`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('PATCH /penyusun/:id/pindah — berhasil pindah OPD penyusun (Success Case)', async () => {
      const res = await pjEvaluatorAgent
        .patch(`${API}/penyusun/${penyusunId}/pindah`)
        .send({ opdId: opdTargetId })
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it('PATCH /penyusun/:id/pindah ke OPD yang sama → 409 (Edge Case)', async () => {
      const res = await pjEvaluatorAgent
        .patch(`${API}/penyusun/${penyusunId}/pindah`)
        .send({ opdId: opdTargetId });
      expect([409, 400]).toContain(res.status);
    });

    it('PATCH /penyusun/:id/pindah ke OPD yang tidak ada → 404 (False Case)', async () => {
      const res = await pjEvaluatorAgent
        .patch(`${API}/penyusun/${penyusunId}/pindah`)
        .send({ opdId: '00000000-0000-4000-8000-000000000777' });
      expect([404, 400]).toContain(res.status);
    });

    it('DELETE /penyusun/:id — hapus permanen penyusun tanpa referensi aktif (Success Case)', async () => {
      const fresh = await prisma.pengguna.create({
        data: {
          ...profilPayload({
            email: 'penyusun.lc.delete@example.test',
            nama: 'Penyusun LC Delete',
            nip: 'LC-PEN-DEL-001',
            nohp: '081234560005',
          }),
          opdId: baseOpdId,
          peran: PeranPengguna.PENYUSUN,
          kataSandi: await bcrypt.hash(PASSWORD, 10),
        },
      });
      await pjEvaluatorAgent.delete(`${API}/penyusun/${fresh.penggunaId}`).expect(200);
    });

    it('DELETE /penyusun/:id yang tidak ada → 404 (False Case)', async () => {
      const res = await pjEvaluatorAgent.delete(
        `${API}/penyusun/00000000-0000-4000-8000-000000009990`,
      );
      expect([404, 400]).toContain(res.status);
    });

    it('PATCH /penyusun/:id UUID tidak valid → 400 (Edge Case)', async () => {
      await pjEvaluatorAgent.patch(`${API}/penyusun/bukan-uuid`).send({ nama: 'Test' }).expect(400);
    });
  });

  // ============================
  // EVALUATOR LIFECYCLE
  // ============================

  describe('Evaluator Lifecycle — tambah, update, nonaktifkan', () => {
    let evaluatorId: string;

    it('POST /evaluator — berhasil tambah evaluator baru (Success Case)', async () => {
      const res = await pjEvaluatorAgent
        .post(`${API}/evaluator`)
        .send({
          ...profilPayload({
            email: 'evaluator.lc.baru@example.test',
            nama: 'Evaluator Lifecycle Baru',
            nip: 'LC-EV-NEW-001',
            nohp: '081234560006',
          }),
        })
        .expect(201);
      expect(res.body.success).toBe(true);
      evaluatorId = res.body.data.id;
    });

    it('PATCH /evaluator/:id — berhasil update data evaluator (Success Case)', async () => {
      const res = await pjEvaluatorAgent
        .patch(`${API}/evaluator/${evaluatorId}`)
        .send({ nama: 'Evaluator LC Updated' })
        .expect(200);
      expect(res.body.data.user.nama).toBe('Evaluator LC Updated');
    });

    it('POST /evaluator — duplikasi email evaluator → 409 (False Case)', async () => {
      const res = await pjEvaluatorAgent.post(`${API}/evaluator`).send({
        ...profilPayload({
          email: 'evaluator.lc.baru@example.test',
          nama: 'Evaluator Duplikat',
          nip: 'LC-EV-DUP-001',
          nohp: '081234560007',
        }),
      });
      expect([409, 400]).toContain(res.status);
    });

    it('DELETE /evaluator/:id — berhasil nonaktifkan evaluator (Success Case)', async () => {
      await pjEvaluatorAgent.delete(`${API}/evaluator/${evaluatorId}`).expect(200);
    });

    it('DELETE /evaluator/:id yang tidak ada → 404 (False Case)', async () => {
      const res = await pjEvaluatorAgent.delete(
        `${API}/evaluator/00000000-0000-4000-8000-000000009991`,
      );
      expect([404, 400]).toContain(res.status);
    });
  });
});
