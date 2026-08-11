import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import request, { type Agent } from 'supertest';
import { createDefaultValidationPipe } from '../../src/common';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import {
  HasilEvaluasi,
  JenisPengajuanEvaluasi,
  PeranPengguna,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../src/generated/prisma';
import { WhatsappReminderReconcilerService } from '../../src/modules/notifications/whatsapp/whatsapp-reminder-reconciler.service';
import { WhatsappReminderWorkerService } from '../../src/modules/notifications/whatsapp/whatsapp-reminder-worker.service';
import {
  assertSafeIntegrationDatabase,
  pingIntegrationDatabase,
  resetIntegrationDatabase,
} from './helpers/integration-database.util';
import { createMinimalPdfBuffer } from './helpers/integration-pdf.util';
import { isIntegrationEnabled } from './helpers/integration-runtime.util';

const describeIntegration = isIntegrationEnabled() ? describe : describe.skip;
const API = '/api/v1';
const PASSWORD = 'Integration123!';
const PIN_TTE = '123456';
const EVOLUTION_API_KEY = 'evolution-e2e-api-key-123';
const EVOLUTION_API_INSTANCE = 'sop-staging';
const REMINDER_INTERVAL_MS = 2 * 60_000;

type StubBehavior = Readonly<{
  status?: number;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  delayMs?: number;
  destroySocket?: boolean;
}>;

type StubRequest = Readonly<{
  method: string;
  path: string;
  apiKey: string | undefined;
  body: unknown;
}>;

class EvolutionApiHttpStub {
  private server: Server | undefined;
  private sendBehaviors: StubBehavior[] = [];
  private connectionStateBehavior: StubBehavior | undefined;
  readonly requests: StubRequest[] = [];
  connectionState = 'open';

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      void this.handle(req, res).catch((error: unknown) => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({ message: error instanceof Error ? error.message : String(error) }),
          );
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(0, '127.0.0.1', () => resolve());
    });
    const address = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  }

  reset(): void {
    this.requests.length = 0;
    this.sendBehaviors = [];
    this.connectionStateBehavior = undefined;
    this.connectionState = 'open';
  }

  setConnectionStateBehavior(behavior: StubBehavior): void {
    this.connectionStateBehavior = behavior;
  }

  enqueueSend(behavior: StubBehavior): void {
    this.sendBehaviors.push(behavior);
  }

  get sendRequests(): StubRequest[] {
    return this.requests.filter(
      (entry) =>
        entry.method === 'POST' && entry.path === `/message/sendText/${EVOLUTION_API_INSTANCE}`,
    );
  }

  get connectionStateRequests(): StubRequest[] {
    return this.requests.filter(
      (entry) =>
        entry.method === 'GET' &&
        entry.path === `/instance/connectionState/${EVOLUTION_API_INSTANCE}`,
    );
  }

  async close(): Promise<void> {
    if (this.server === undefined) return;
    this.server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    const bodyText = await this.readBody(req);
    let body: unknown = null;
    if (bodyText.length > 0) {
      try {
        body = JSON.parse(bodyText) as unknown;
      } catch {
        body = bodyText;
      }
    }
    this.requests.push({
      method: req.method ?? 'UNKNOWN',
      path,
      apiKey: Array.isArray(req.headers.apikey) ? req.headers.apikey[0] : req.headers.apikey,
      body,
    });

    const apiKey = Array.isArray(req.headers.apikey) ? req.headers.apikey[0] : req.headers.apikey;
    if (apiKey !== EVOLUTION_API_KEY) {
      await this.respond(res, { status: 401, body: { message: 'Invalid API key' } });
      return;
    }
    if (req.method === 'GET' && path === `/instance/connectionState/${EVOLUTION_API_INSTANCE}`) {
      await this.respond(
        res,
        this.connectionStateBehavior ?? {
          status: 200,
          body: {
            instance: {
              instanceName: EVOLUTION_API_INSTANCE,
              state: this.connectionState,
            },
          },
        },
      );
      return;
    }
    if (req.method === 'POST' && path === `/message/sendText/${EVOLUTION_API_INSTANCE}`) {
      await this.respond(
        res,
        this.sendBehaviors.shift() ?? {
          status: 201,
          body: { key: { id: 'stub-message-id' } },
        },
      );
      return;
    }
    await this.respond(res, { status: 404, body: { message: 'Not found' } });
  }

  private async respond(res: ServerResponse, behavior: StubBehavior): Promise<void> {
    if (behavior.delayMs !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, behavior.delayMs));
    }
    if (behavior.destroySocket) {
      res.destroy();
      return;
    }
    res.statusCode = behavior.status ?? 200;
    for (const [name, value] of Object.entries(behavior.headers ?? {})) {
      res.setHeader(name, value);
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(behavior.rawBody ?? JSON.stringify(behavior.body ?? {}));
  }

  private async readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}

type SeededWorkflow = Readonly<{
  opdId: string;
  otherOpdId: string;
  detailSopId: string;
  pengajuanId: string;
  evaluatorIds: string[];
  pjEvaluatorId?: string;
  pjPenyusunId?: string;
  kepalaOpdId?: string;
}>;

describeIntegration('WhatsApp reminder E2E: Nest + MariaDB + HTTP Evolution API stub', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reconciler: WhatsappReminderReconcilerService;
  let worker: WhatsappReminderWorkerService;
  let stub: EvolutionApiHttpStub;
  let passwordHash: string;
  const previousEnv = new Map<string, string | undefined>();
  const configuredEnv: Record<string, string> = {
    WHATSAPP_ENABLED: 'false',
    EVOLUTION_API_KEY,
    EVOLUTION_API_INSTANCE,
    WHATSAPP_ALLOWED_RECIPIENTS: [
      '6281111111111',
      '6282222222222',
      '6283333333333',
      '6284444444444',
      '6285555555555',
      '6286666666666',
    ].join(','),
    WHATSAPP_REMINDER_INTERVAL_MINUTES: '2',
    WHATSAPP_REQUEST_TIMEOUT_MS: '1000',
    WHATSAPP_MAX_CONCURRENCY: '4',
    WHATSAPP_LOCK_LEASE_SECONDS: '10',
  };

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    stub = new EvolutionApiHttpStub();
    configuredEnv.EVOLUTION_API_BASE_URL = await stub.start();
    for (const [key, value] of Object.entries(configuredEnv)) {
      previousEnv.set(key, process.env[key]);
      process.env[key] = value;
    }

    const { AppModule } = await import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(createDefaultValidationPipe());
    await app.init();

    prisma = app.get(PrismaService);
    reconciler = app.get(WhatsappReminderReconcilerService);
    worker = app.get(WhatsappReminderWorkerService);
    passwordHash = await bcrypt.hash(PASSWORD, 10);
    await pingIntegrationDatabase(prisma);
  });

  beforeEach(async () => {
    stub.reset();
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    try {
      await app?.close();
      await stub?.close();
    } finally {
      for (const [key, value] of previousEnv) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  async function createUser(params: {
    opdId: string;
    peran: PeranPengguna;
    suffix: string;
    nohp: string;
  }): Promise<string> {
    const user = await prisma.pengguna.create({
      data: {
        email: `${params.suffix}@whatsapp-e2e.test`,
        nama: `Pengguna ${params.suffix}`,
        nip: `WA-E2E-${params.suffix}`.slice(0, 32),
        opdId: params.opdId,
        peran: params.peran,
        kataSandi: passwordHash,
        jabatan: String(params.peran),
        pangkat: 'Pembina',
        nohp: params.nohp,
        riwayatOpd: { create: { opdId: params.opdId, isAktif: true } },
      },
    });
    return user.penggunaId;
  }

  async function seedWorkflow(options?: {
    evaluatorNumbers?: string[];
    includeSigners?: boolean;
  }): Promise<SeededWorkflow> {
    const opd = await prisma.oPD.create({ data: { nama: 'OPD WhatsApp E2E' } });
    const otherOpd = await prisma.oPD.create({ data: { nama: 'OPD WhatsApp E2E Lain' } });
    const evaluatorNumbers = options?.evaluatorNumbers ?? ['081111111111', '082222222222'];
    const evaluatorIds: string[] = [];
    for (const [index, nohp] of evaluatorNumbers.entries()) {
      evaluatorIds.push(
        await createUser({
          opdId: index % 2 === 0 ? opd.opdId : otherOpd.opdId,
          peran: PeranPengguna.EVALUATOR,
          suffix: `evaluator-${index + 1}`,
          nohp,
        }),
      );
    }

    let pjEvaluatorId: string | undefined;
    let pjPenyusunId: string | undefined;
    let kepalaOpdId: string | undefined;
    if (options?.includeSigners ?? true) {
      pjEvaluatorId = await createUser({
        opdId: otherOpd.opdId,
        peran: PeranPengguna.PJ_EVALUATOR,
        suffix: 'pj-evaluator',
        nohp: '083333333333',
      });
      pjPenyusunId = await createUser({
        opdId: opd.opdId,
        peran: PeranPengguna.PJ_PENYUSUN,
        suffix: 'pj-penyusun',
        nohp: '084444444444',
      });
      kepalaOpdId = await createUser({
        opdId: opd.opdId,
        peran: PeranPengguna.KEPALA_OPD,
        suffix: 'kepala-opd',
        nohp: '085555555555',
      });
    }

    const sop = await prisma.sOP.create({
      data: { opdId: opd.opdId, judul: 'SOP Reminder E2E' },
    });
    const detail = await prisma.detailSOP.create({
      data: {
        sopId: sop.sopId,
        nomorSOP: 'WA-E2E-SOP-001',
        namaLembaga: opd.nama,
        status: StatusSOP.SEDANG_DIEVALUASI,
      },
    });
    const pengajuan = await prisma.pengajuanEvaluasi.create({
      data: {
        opdId: opd.opdId,
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
        status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
        nilaiEvaluasi: {
          create: {
            detailSopId: detail.detailSopId,
            hasil: HasilEvaluasi.SESUAI,
            dinilaiOlehId: evaluatorIds[0],
          },
        },
      },
    });
    return {
      opdId: opd.opdId,
      otherOpdId: otherOpd.opdId,
      detailSopId: detail.detailSopId,
      pengajuanId: pengajuan.pengajuanEvaluasiId,
      evaluatorIds,
      pjEvaluatorId,
      pjPenyusunId,
      kepalaOpdId,
    };
  }

  async function login(email: string): Promise<Agent> {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request.agent>[0];
    const agent = request.agent(httpServer);
    const response = await agent
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(201);
    const raw: unknown = response.headers['set-cookie'];
    const cookies = Array.isArray(raw)
      ? raw.filter((value): value is string => typeof value === 'string')
      : typeof raw === 'string'
        ? [raw]
        : [];
    if (cookies.length > 0) {
      agent.set('Cookie', cookies.map((cookie) => cookie.split(';')[0]).join('; '));
    }
    return agent;
  }

  async function reconcileAndSend(now = new Date()): Promise<void> {
    await reconciler.reconcile(now);
    await worker.processDue(now);
  }

  function sentPayloads(): Array<{
    number: string;
    text: string;
  }> {
    return stub.sendRequests.map(
      (entry) =>
        entry.body as {
          number: string;
          text: string;
        },
    );
  }

  it('menjalankan workflow API lengkap, repeat tanpa maksimum, perpindahan penerima, lalu berhenti pada status terminal', async () => {
    const state = await seedWorkflow();
    const evaluator = await login('evaluator-1@whatsapp-e2e.test');
    const pjEvaluator = await login('pj-evaluator@whatsapp-e2e.test');
    const pjPenyusun = await login('pj-penyusun@whatsapp-e2e.test');
    const kepala = await login('kepala-opd@whatsapp-e2e.test');

    await pjEvaluator.post(`${API}/tte/profil`).send({ pin: PIN_TTE }).expect(201);
    await pjPenyusun.post(`${API}/tte/profil`).send({ pin: PIN_TTE }).expect(201);
    await kepala.post(`${API}/tte/profil/setup/generate`).send({ pin: PIN_TTE }).expect(201);

    await reconcileAndSend(new Date());
    expect(
      sentPayloads()
        .map((payload) => payload.number)
        .sort(),
    ).toEqual(['6281111111111', '6282222222222']);
    expect(stub.connectionStateRequests).toHaveLength(1);

    const reminders = await prisma.pengingatWhatsApp.findMany();
    const firstDueAt = Math.min(...reminders.map((row) => row.nextSendAt.getTime()));
    const allDueAt = Math.max(...reminders.map((row) => row.nextSendAt.getTime())) + 1;
    await worker.processDue(new Date(firstDueAt - 1));
    expect(stub.sendRequests).toHaveLength(2);
    await worker.processDue(new Date(allDueAt));
    expect(stub.sendRequests).toHaveLength(4);

    await evaluator
      .patch(`${API}/evaluasi/${state.pengajuanId}/selesai`)
      .send({ nomorBA: 'BA-WA-E2E-001' })
      .expect(200);
    await reconcileAndSend(new Date());
    expect(sentPayloads().at(-1)?.number).toBe('6283333333333');

    await pjEvaluator
      .post(`${API}/tte/tanda-tangani/ba/${state.pengajuanId}`)
      .send({ pin: PIN_TTE, nomorDokumen: 'BA-WA-E2E-001', judulDokumen: 'BA WA E2E' })
      .expect(201);
    await reconcileAndSend(new Date());
    expect(sentPayloads().at(-1)?.number).toBe('6284444444444');

    await pjPenyusun
      .post(`${API}/tte/tanda-tangani/ba/${state.pengajuanId}`)
      .send({ pin: PIN_TTE, nomorDokumen: 'BA-WA-E2E-001', judulDokumen: 'BA WA E2E' })
      .expect(201);
    await reconcileAndSend(new Date());
    expect(sentPayloads().at(-1)?.number).toBe('6285555555555');

    const pdfBase64 = (await createMinimalPdfBuffer('SOP WhatsApp E2E')).toString('base64');
    await kepala
      .post(`${API}/tte/tanda-tangani/pengajuan/${state.pengajuanId}/sop-semua`)
      .send({
        pin: PIN_TTE,
        nomorDokumen: 'SOP-WA-E2E-001',
        judulDokumen: 'Pengesahan SOP WA E2E',
        sopPdfs: [{ detailSopId: state.detailSopId, pdfBase64 }],
      })
      .expect(201);
    await reconcileAndSend(new Date());

    await expect(prisma.pengingatWhatsApp.count()).resolves.toBe(0);
    await expect(
      prisma.pengajuanEvaluasi.findUniqueOrThrow({
        where: { pengajuanEvaluasiId: state.pengajuanId },
      }),
    ).resolves.toMatchObject({ status: StatusPengajuanEvaluasi.SELESAI });
    expect(stub.sendRequests).toHaveLength(7);
    for (const payload of sentPayloads()) {
      expect(payload.text).not.toMatch(/https?:\/\//i);
      expect(payload.text).toContain('SOPFlow');
    }
    expect(stub.requests.every((entry) => entry.apiKey === EVOLUTION_API_KEY)).toBe(true);
  });

  it('membatalkan reminder yang sudah dibuat ketika pengajuan ditolak melalui API sebelum dikirim', async () => {
    const state = await seedWorkflow();
    const evaluator = await login('evaluator-1@whatsapp-e2e.test');
    const now = new Date();
    await reconciler.reconcile(now);
    await expect(prisma.pengingatWhatsApp.count()).resolves.toBe(2);

    await evaluator
      .patch(`${API}/evaluasi/${state.pengajuanId}/tolak`)
      .send({ alasan: 'Ditolak untuk memastikan reminder berhenti.', version: 0 })
      .expect(200);
    await worker.processDue(now);
    await reconciler.reconcile(new Date());

    await expect(prisma.pengingatWhatsApp.count()).resolves.toBe(0);
    expect(stub.requests).toHaveLength(0);
  });

  it('mengirim tepat sekali per nomor saat dua worker berebut reminder yang sama', async () => {
    await seedWorkflow();
    const now = new Date();
    await reconciler.reconcile(now);
    await Promise.all([worker.processDue(now), worker.processDue(now)]);
    expect(
      sentPayloads()
        .map((payload) => payload.number)
        .sort(),
    ).toEqual(['6281111111111', '6282222222222']);
  });

  it('mengisolasi kegagalan satu penerima agar penerima lain dalam batch tetap berhasil', async () => {
    await seedWorkflow();
    const now = new Date();
    await reconciler.reconcile(now);
    stub.enqueueSend({ status: 500, body: { message: 'gagal untuk satu penerima' } });
    stub.enqueueSend({
      status: 200,
      body: { status: true, id: ['penerima-lain-berhasil'] },
    });

    await worker.processDue(now);
    expect(stub.sendRequests).toHaveLength(2);
    const rows = await prisma.pengingatWhatsApp.findMany();
    expect(
      rows.filter((row) => row.consecutiveFailures === 1 && row.lastErrorKind === 'UNAVAILABLE'),
    ).toHaveLength(1);
    expect(
      rows.filter((row) => row.consecutiveFailures === 0 && row.lastSentAt !== null),
    ).toHaveLength(1);

    const failed = rows.find((row) => row.consecutiveFailures === 1);
    expect(failed).toBeDefined();
    await worker.processDue(new Date((failed?.nextSendAt.getTime() ?? 0) + 1));
    const recovered = await prisma.pengingatWhatsApp.findUniqueOrThrow({
      where: { pengingatWhatsAppId: failed?.pengingatWhatsAppId ?? '' },
    });
    expect(recovered.consecutiveFailures).toBe(0);
    expect(recovered.lastSentAt).not.toBeNull();
  });

  it('memakai satu readiness check untuk batch dan menjadwalkan ulang seluruh penerima saat perangkat terputus', async () => {
    await seedWorkflow();
    const now = new Date();
    await reconciler.reconcile(now);
    stub.connectionState = 'connecting';

    await worker.processDue(now);
    expect(stub.connectionStateRequests).toHaveLength(1);
    expect(stub.sendRequests).toHaveLength(0);
    const rows = await prisma.pengingatWhatsApp.findMany();
    expect(rows).toHaveLength(2);
    expect(
      rows.every(
        (row) => row.consecutiveFailures === 1 && row.lastErrorKind === 'SESSION_NOT_READY',
      ),
    ).toBe(true);
  });

  it('mendeduplikasi nomor dan melewati nomor invalid maupun di luar allowlist', async () => {
    await seedWorkflow({
      evaluatorNumbers: ['081111111111', '081111111111', '0215555555', '087777777777'],
      includeSigners: false,
    });
    await reconcileAndSend(new Date());
    expect(sentPayloads().map((payload) => payload.number)).toEqual(['6281111111111']);
    await expect(prisma.pengingatWhatsApp.count()).resolves.toBe(1);
  });

  it('fail closed saat penerima tunggal tidak tersedia, lalu pulih setelah konfigurasi dilengkapi', async () => {
    const state = await seedWorkflow({ includeSigners: false });
    await prisma.pengajuanEvaluasi.update({
      where: { pengajuanEvaluasiId: state.pengajuanId },
      data: { status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI, nomorBA: 'BA-MISSING-PJ' },
    });
    await reconcileAndSend(new Date());
    expect(stub.requests).toHaveLength(0);
    await expect(prisma.pengingatWhatsApp.count()).resolves.toBe(0);

    await createUser({
      opdId: state.otherOpdId,
      peran: PeranPengguna.PJ_EVALUATOR,
      suffix: 'pj-evaluator-late',
      nohp: '083333333333',
    });
    await reconcileAndSend(new Date());
    expect(sentPayloads().map((payload) => payload.number)).toEqual(['6283333333333']);
  });

  it.each([
    ['pengguna dinonaktifkan', { deletedAt: new Date() }],
    ['nomor berubah di luar allowlist', { nohp: '087777777777' }],
    ['peran berubah', { peran: PeranPengguna.PENYUSUN }],
  ] as const)(
    'menghapus state stale tanpa memanggil Evolution API ketika %s',
    async (_name, data) => {
      const state = await seedWorkflow({
        evaluatorNumbers: ['081111111111'],
        includeSigners: false,
      });
      const now = new Date();
      await reconciler.reconcile(now);
      await prisma.pengguna.update({ where: { penggunaId: state.evaluatorIds[0] }, data });
      await worker.processDue(now);
      await expect(prisma.pengingatWhatsApp.count()).resolves.toBe(0);
      expect(stub.requests).toHaveLength(0);
    },
  );

  it.each([
    {
      name: 'instance belum open',
      target: 'connection',
      behavior: {
        status: 200,
        body: {
          instance: {
            instanceName: EVOLUTION_API_INSTANCE,
            state: 'connecting',
          },
        },
      },
      errorKind: 'SESSION_NOT_READY',
      retryMs: 5 * 60_000,
      expectedPostCount: 0,
    },
    {
      name: 'API key ditolak',
      target: 'connection',
      behavior: { status: 401, body: { message: 'Invalid API key' } },
      errorKind: 'UNAUTHORIZED',
      retryMs: 5 * 60_000,
      expectedPostCount: 0,
    },
    {
      name: 'rate limit dengan Retry-After',
      target: 'send',
      behavior: { status: 429, rawBody: 'slow down', headers: { 'retry-after': '120' } },
      errorKind: 'RATE_LIMITED',
      retryMs: 120_000,
      expectedPostCount: 1,
    },
    {
      name: 'HTTP 500',
      target: 'send',
      behavior: { status: 500, body: { message: 'Evolution API down' } },
      errorKind: 'UNAVAILABLE',
      retryMs: 60_000,
      expectedPostCount: 1,
    },
    {
      name: 'respons sukses bukan JSON',
      target: 'send',
      behavior: { status: 200, rawBody: 'not-json' },
      errorKind: 'INVALID_RESPONSE',
      retryMs: 60_000,
      expectedPostCount: 1,
    },
    {
      name: 'nomor ditolak Evolution API',
      target: 'send',
      behavior: { status: 400, body: { message: 'number invalid' } },
      errorKind: 'BAD_RECIPIENT',
      retryMs: REMINDER_INTERVAL_MS,
      expectedPostCount: 1,
    },
    {
      name: 'timeout POST ambigu',
      target: 'send',
      behavior: { delayMs: 1_250, status: 200, body: { status: true, id: ['late'] } },
      errorKind: 'TIMEOUT',
      retryMs: REMINDER_INTERVAL_MS,
      expectedPostCount: 1,
    },
    {
      name: 'koneksi putus setelah POST',
      target: 'send',
      behavior: { destroySocket: true },
      errorKind: 'UNAVAILABLE',
      retryMs: REMINDER_INTERVAL_MS,
      expectedPostCount: 1,
    },
  ])(
    'menyimpan failure state dan retry yang aman untuk $name',
    async ({ target, behavior, errorKind, retryMs, expectedPostCount }) => {
      await seedWorkflow({ evaluatorNumbers: ['081111111111'], includeSigners: false });
      const now = new Date();
      await reconciler.reconcile(now);
      if (target === 'connection') stub.setConnectionStateBehavior(behavior);
      else stub.enqueueSend(behavior);

      await worker.processDue(now);
      const reminder = await prisma.pengingatWhatsApp.findFirstOrThrow();
      expect(reminder).toMatchObject({
        consecutiveFailures: 1,
        lastErrorKind: errorKind,
        lockToken: null,
        lockedUntil: null,
      });
      expect(reminder.nextSendAt.getTime() - now.getTime()).toBe(retryMs);
      expect(stub.sendRequests).toHaveLength(expectedPostCount);
    },
  );

  it('pulih setelah Evolution API kembali siap dan tetap menyimpan reminder meski kegagalan sudah sangat banyak', async () => {
    await seedWorkflow({ evaluatorNumbers: ['081111111111'], includeSigners: false });
    const now = new Date();
    await reconciler.reconcile(now);
    await prisma.pengingatWhatsApp.updateMany({ data: { consecutiveFailures: 999 } });
    stub.connectionState = 'connecting';
    await worker.processDue(now);
    let reminder = await prisma.pengingatWhatsApp.findFirstOrThrow();
    expect(reminder.consecutiveFailures).toBe(1_000);
    expect(reminder.lastErrorKind).toBe('SESSION_NOT_READY');

    stub.connectionState = 'open';
    await worker.processDue(new Date(reminder.nextSendAt.getTime() + 1));
    reminder = await prisma.pengingatWhatsApp.findFirstOrThrow();
    expect(reminder.consecutiveFailures).toBe(0);
    expect(reminder.lastErrorKind).toBeNull();
    expect(reminder.lastSentAt).not.toBeNull();
    expect(stub.sendRequests).toHaveLength(1);
  });

  it('menghormati lock aktif dan mengirim setelah lease kedaluwarsa', async () => {
    await seedWorkflow({ evaluatorNumbers: ['081111111111'], includeSigners: false });
    const now = new Date();
    await reconciler.reconcile(now);
    const lockedUntil = new Date(now.getTime() + 30_000);
    await prisma.pengingatWhatsApp.updateMany({
      data: {
        lockToken: '00000000-0000-4000-8000-000000000099',
        lockedUntil,
      },
    });
    await worker.processDue(now);
    expect(stub.requests).toHaveLength(0);
    await worker.processDue(new Date(lockedUntil.getTime() + 1));
    expect(stub.sendRequests).toHaveLength(1);
  });
});
