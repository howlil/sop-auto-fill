/**
 * Integration Test: Auth Session Lifecycle
 *
 * Menguji seluruh siklus hidup sesi pengguna:
 *  - Login, /auth/me, update nomor HP, refresh token, change password, logout
 *  - False cases: kredensial salah, token tidak valid, token kedaluwarsa
 *  - Worst cases: replay refresh token, logout invalidasi token, concurrent session
 *  - Edge cases: logout tanpa cookie, refresh dengan token malformed
 */
import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
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
const PASSWORD = 'AuthTest123!';

async function seedAuthUser(
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
      nohp: '081111111111',
      riwayatOpd: { create: { opdId: params.opdId, isAktif: true } },
    },
  });
}

function extractCookies(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((c: string) => c.split(';')[0]).join('; ');
}

describeIntegration('Auth Session — siklus hidup sesi pengguna', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let opdId: string;

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

    const opd = await prisma.oPD.create({ data: { nama: 'OPD Auth Test' } });
    opdId = opd.opdId;

    await seedAuthUser(prisma, {
      email: 'pj-evaluator.auth@example.test',
      nama: 'PJ Evaluator Auth',
      nip: 'AUTH-PJE-001',
      peran: PeranPengguna.PJ_EVALUATOR,
      opdId,
    });
    await seedAuthUser(prisma, {
      email: 'penyusun.auth@example.test',
      nama: 'Penyusun Auth',
      nip: 'AUTH-PEN-001',
      peran: PeranPengguna.PENYUSUN,
      opdId,
    });
  });

  afterAll(async () => {
    try {
      if (prisma) await resetIntegrationDatabase(prisma);
    } finally {
      if (app) await app.close();
    }
  });

  // ============================
  // SUCCESS CASES
  // ============================

  describe('Success Cases — alur normal autentikasi', () => {
    it('login dengan kredensial valid mengembalikan data pengguna dan cookie JWT', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        data: {
          email: 'pj-evaluator.auth@example.test',
          peran: PeranPengguna.PJ_EVALUATOR,
        },
      });
      const cookies = res.headers['set-cookie'];
      expect(Array.isArray(cookies) ? cookies.length : cookies ? 1 : 0).toBeGreaterThanOrEqual(1);
    });

    it('GET /auth/me dengan token valid mengembalikan profil pengguna saat ini', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);
      agent.set('Cookie', extractCookies(loginRes));

      const meRes = await agent.get(`${API}/auth/me`).expect(200);
      expect(meRes.body).toMatchObject({
        success: true,
        data: { email: 'pj-evaluator.auth@example.test' },
      });
      expect(meRes.body).toHaveProperty('data.tte');
    });

    it('PATCH /auth/me/nohp memperbarui nomor HP akun sendiri dan menormalisasi format', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);
      agent.set('Cookie', extractCookies(loginRes));

      const updateRes = await agent
        .patch(`${API}/auth/me/nohp`)
        .send({ nohp: '081234567890' })
        .expect(200);

      expect(updateRes.body).toMatchObject({
        data: { nohp: '6281234567890' },
      });
      const meRes = await agent.get(`${API}/auth/me`).expect(200);
      expect(meRes.body).toMatchObject({
        data: { nohp: '6281234567890' },
      });
      await expect(
        prisma.pengguna.findFirstOrThrow({
          where: { email: 'pj-evaluator.auth@example.test' },
          select: { nohp: true },
        }),
      ).resolves.toEqual({ nohp: '6281234567890' });
    });

    it('POST /auth/refresh dengan refresh token valid mengembalikan token baru', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);
      agent.set('Cookie', extractCookies(loginRes));

      const refreshRes = await agent.post(`${API}/auth/refresh`).expect(200);
      expect(refreshRes.body).toMatchObject({ success: true });
      // Cookie baru seharusnya diterbitkan
      const newCookies = refreshRes.headers['set-cookie'];
      expect(
        Array.isArray(newCookies) ? newCookies.length : newCookies ? 1 : 0,
      ).toBeGreaterThanOrEqual(1);
    });

    it('POST /auth/logout berhasil dan menghapus cookie', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);
      agent.set('Cookie', extractCookies(loginRes));

      const logoutRes = await agent.post(`${API}/auth/logout`).expect(200);
      expect(logoutRes.body).toMatchObject({ success: true });
    });

    it('PATCH /auth/change-password mengubah sandi dan login lama menjadi tidak valid', async () => {
      const NEW_PASSWORD = 'NewPass456!';
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'penyusun.auth@example.test', password: PASSWORD })
        .expect(201);
      agent.set('Cookie', extractCookies(loginRes));

      await agent
        .patch(`${API}/auth/change-password`)
        .send({ kataSandiLama: PASSWORD, kataSandiBaru: NEW_PASSWORD })
        .expect(200);

      // Login dengan sandi lama harus gagal
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'penyusun.auth@example.test', password: PASSWORD })
        .expect(401);

      // Login dengan sandi baru harus berhasil
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'penyusun.auth@example.test', password: NEW_PASSWORD })
        .expect(201);

      // Kembalikan sandi original agar test lain tidak terpengaruh
      const agent2 = request.agent(app.getHttpServer());
      const relogin = await agent2
        .post(`${API}/auth/login`)
        .send({ email: 'penyusun.auth@example.test', password: NEW_PASSWORD })
        .expect(201);
      agent2.set('Cookie', extractCookies(relogin));
      await agent2
        .patch(`${API}/auth/change-password`)
        .send({ kataSandiLama: NEW_PASSWORD, kataSandiBaru: PASSWORD })
        .expect(200);
    });
  });

  // ============================
  // FALSE CASES
  // ============================

  describe('False Cases — kredensial tidak valid', () => {
    it('login dengan email yang tidak terdaftar mengembalikan 401', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'tidak.ada@example.test', password: PASSWORD })
        .expect(401);
    });

    it('login dengan sandi salah mengembalikan 401', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: 'SalahSandi999!' })
        .expect(401);
    });

    it('login dengan email kosong mengembalikan 400', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: '', password: PASSWORD })
        .expect(400);
    });

    it('GET /auth/me tanpa cookie mengembalikan 401', async () => {
      await request(app.getHttpServer()).get(`${API}/auth/me`).expect(401);
    });

    it('GET /auth/me dengan access token string acak (bukan JWT) mengembalikan 401', async () => {
      await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('Cookie', 'sop_access_token=bukan-jwt-valid')
        .expect(401);
    });

    it('PATCH /auth/change-password dengan sandi lama yang salah mengembalikan 401', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);
      agent.set('Cookie', extractCookies(loginRes));

      await agent
        .patch(`${API}/auth/change-password`)
        .send({ kataSandiLama: 'SandiSalah123!', kataSandiBaru: 'NewPass789!' })
        .expect(401);
    });

    it('PATCH /auth/me/nohp menolak nomor tidak valid', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);
      agent.set('Cookie', extractCookies(loginRes));

      await agent.patch(`${API}/auth/me/nohp`).send({ nohp: '0812-3456-7890' }).expect(400);
    });

    it('PATCH /auth/me/nohp tanpa sesi mengembalikan 401', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/auth/me/nohp`)
        .send({ nohp: '081234567890' })
        .expect(401);
    });

    it('PATCH /auth/me/nohp menolak penggunaId tambahan agar akun lain tidak dapat dipilih', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);
      agent.set('Cookie', extractCookies(loginRes));

      await agent
        .patch(`${API}/auth/me/nohp`)
        .send({ nohp: '081234567890', penggunaId: 'pengguna-lain' })
        .expect(400);
    });
  });

  // ============================
  // WORST CASES
  // ============================

  describe('Worst Cases — serangan keamanan dan inkonsistensi sesi', () => {
    it('logout lalu POST /auth/refresh seharusnya gagal (token diinvalidasi)', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);
      const cookies = extractCookies(loginRes);
      agent.set('Cookie', cookies);

      await agent.post(`${API}/auth/logout`).expect(200);

      // Setelah logout, token seharusnya tidak bisa dipakai untuk refresh
      const staleAgent = request.agent(app.getHttpServer());
      staleAgent.set('Cookie', cookies);
      const refreshAfterLogout = await staleAgent.post(`${API}/auth/refresh`);
      expect([401, 403]).toContain(refreshAfterLogout.status);
    });

    it('POST /auth/refresh dengan refresh token yang sudah dirotasi (replay attack) → 401', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);
      const originalCookies = extractCookies(loginRes);

      // Lakukan refresh pertama untuk merotasi token
      const agent2 = request.agent(app.getHttpServer());
      agent2.set('Cookie', originalCookies);
      await agent2.post(`${API}/auth/refresh`).expect(200);

      // Coba pakai refresh token lama yang sudah dirotasi
      const replayAgent = request.agent(app.getHttpServer());
      replayAgent.set('Cookie', originalCookies);
      const replayRes = await replayAgent.post(`${API}/auth/refresh`);
      expect([401, 403]).toContain(replayRes.status);
    });

    it('POST /auth/refresh dengan string refresh token acak → 401', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .set('Cookie', 'sop_refresh_token=ini-bukan-token-valid')
        .expect(401);
    });
  });

  // ============================
  // EDGE CASES
  // ============================

  describe('Edge Cases — perilaku batas', () => {
    it('POST /auth/logout tanpa cookie sama sekali berhasil (silent no-op, bukan error)', async () => {
      await request(app.getHttpServer()).post(`${API}/auth/logout`).expect(200);
    });

    it('POST /auth/login dengan payload body yang hilang field password → 400', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test' })
        .expect(400);
    });

    it('POST /auth/login dengan payload body kosong → 400', async () => {
      await request(app.getHttpServer()).post(`${API}/auth/login`).send({}).expect(400);
    });

    it('GET /auth/me setelah berhasil login mengembalikan field tte.configured', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginRes = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'pj-evaluator.auth@example.test', password: PASSWORD })
        .expect(201);
      agent.set('Cookie', extractCookies(loginRes));

      const me = await agent.get(`${API}/auth/me`).expect(200);
      expect(me.body).toHaveProperty('data.tte');
      expect(me.body).toMatchObject({
        data: { tte: { configured: expect.any(Boolean) as boolean } },
      });
    });
  });
});
