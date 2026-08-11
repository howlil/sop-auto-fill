import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import {
  JenisPengajuanEvaluasi,
  PeranPengguna,
  StatusPengajuanEvaluasi,
} from '../../src/generated/prisma';
import { WhatsappReminderReconcilerService } from '../../src/modules/notifications/whatsapp/whatsapp-reminder-reconciler.service';
import { WhatsappReminderRepository } from '../../src/modules/notifications/whatsapp/whatsapp-reminder.repository';
import {
  assertSafeIntegrationDatabase,
  pingIntegrationDatabase,
  resetIntegrationDatabase,
} from './helpers/integration-database.util';
import { isIntegrationEnabled } from './helpers/integration-runtime.util';

const describeIntegration = isIntegrationEnabled() ? describe : describe.skip;

describeIntegration('WhatsApp reminder integration test', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reconciler: WhatsappReminderReconcilerService;
  let repository: WhatsappReminderRepository;
  let previousAllowlist: string | undefined;
  let previousEvolutionApiKey: string | undefined;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    previousAllowlist = process.env.WHATSAPP_ALLOWED_RECIPIENTS;
    previousEvolutionApiKey = process.env.EVOLUTION_API_KEY;
    process.env.EVOLUTION_API_KEY = 'integration-evolution-api-key-123';
    process.env.WHATSAPP_ALLOWED_RECIPIENTS = [
      '6281111111111',
      '6282222222222',
      '6283333333333',
      '6284444444444',
      '6285555555555',
    ].join(',');
    const { AppModule } = await import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    reconciler = app.get(WhatsappReminderReconcilerService);
    repository = app.get(WhatsappReminderRepository);
    await pingIntegrationDatabase(prisma);
  });

  beforeEach(async () => resetIntegrationDatabase(prisma));

  afterAll(async () => {
    await app?.close();
    if (previousAllowlist === undefined) {
      delete process.env.WHATSAPP_ALLOWED_RECIPIENTS;
    } else {
      process.env.WHATSAPP_ALLOWED_RECIPIENTS = previousAllowlist;
    }
    if (previousEvolutionApiKey === undefined) {
      delete process.env.EVOLUTION_API_KEY;
    } else {
      process.env.EVOLUTION_API_KEY = previousEvolutionApiKey;
    }
  });

  async function seedWorkflow(): Promise<{
    pengajuanEvaluasiId: string;
    evaluatorIds: string[];
    pjEvaluatorId: string;
    pjPenyusunId: string;
    kepalaOpdId: string;
  }> {
    const opd = await prisma.oPD.create({ data: { nama: 'OPD Reminder Integration' } });
    const otherOpd = await prisma.oPD.create({ data: { nama: 'OPD Reminder Lain' } });
    const common = {
      kataSandi: 'hash-not-used-in-this-test',
      jabatan: 'Penguji',
      pangkat: 'Pembina',
    };
    const evaluator1 = await prisma.pengguna.create({
      data: {
        ...common,
        email: 'eval1.reminder@example.test',
        nama: 'Evaluator Satu',
        nip: 'WA-EVAL-1',
        nohp: '081111111111',
        opdId: opd.opdId,
        peran: PeranPengguna.EVALUATOR,
      },
    });
    const evaluator2 = await prisma.pengguna.create({
      data: {
        ...common,
        email: 'eval2.reminder@example.test',
        nama: 'Evaluator Dua',
        nip: 'WA-EVAL-2',
        nohp: '082222222222',
        opdId: otherOpd.opdId,
        peran: PeranPengguna.EVALUATOR,
      },
    });
    const pjEvaluator = await prisma.pengguna.create({
      data: {
        ...common,
        email: 'pjeval.reminder@example.test',
        nama: 'PJ Evaluator',
        nip: 'WA-PJE-1',
        nohp: '083333333333',
        opdId: opd.opdId,
        peran: PeranPengguna.PJ_EVALUATOR,
      },
    });
    const pjPenyusun = await prisma.pengguna.create({
      data: {
        ...common,
        email: 'pjpen.reminder@example.test',
        nama: 'PJ Penyusun',
        nip: 'WA-PJP-1',
        nohp: '084444444444',
        opdId: opd.opdId,
        peran: PeranPengguna.PJ_PENYUSUN,
      },
    });
    const kepala = await prisma.pengguna.create({
      data: {
        ...common,
        email: 'kepala.reminder@example.test',
        nama: 'Kepala OPD',
        nip: 'WA-KA-1',
        nohp: '085555555555',
        opdId: opd.opdId,
        peran: PeranPengguna.KEPALA_OPD,
      },
    });
    const pengajuan = await prisma.pengajuanEvaluasi.create({
      data: {
        opdId: opd.opdId,
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
        status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
      },
    });
    return {
      pengajuanEvaluasiId: pengajuan.pengajuanEvaluasiId,
      evaluatorIds: [evaluator1.penggunaId, evaluator2.penggunaId],
      pjEvaluatorId: pjEvaluator.penggunaId,
      pjPenyusunId: pjPenyusun.penggunaId,
      kepalaOpdId: kepala.penggunaId,
    };
  }

  it('mereconcile seluruh transisi penerima dan membersihkan reminder terminal', async () => {
    const state = await seedWorkflow();
    const now = new Date('2026-08-02T00:00:00.000Z');

    await reconciler.reconcile(now);
    await reconciler.reconcile(now);
    let reminders = await prisma.pengingatWhatsApp.findMany({ orderBy: { penggunaId: 'asc' } });
    expect(reminders).toHaveLength(2);
    expect(reminders.map((row) => row.penggunaId).sort()).toEqual([...state.evaluatorIds].sort());

    await prisma.pengajuanEvaluasi.update({
      where: { pengajuanEvaluasiId: state.pengajuanEvaluasiId },
      data: { status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI, nomorBA: 'BA-WA-001' },
    });
    await reconciler.reconcile(now);
    reminders = await prisma.pengingatWhatsApp.findMany();
    expect(reminders.map((row) => row.penggunaId)).toEqual([state.pjEvaluatorId]);

    await prisma.pengajuanEvaluasi.update({
      where: { pengajuanEvaluasiId: state.pengajuanEvaluasiId },
      data: { status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR },
    });
    await reconciler.reconcile(now);
    reminders = await prisma.pengingatWhatsApp.findMany();
    expect(reminders.map((row) => row.penggunaId)).toEqual([state.pjPenyusunId]);

    await prisma.pengajuanEvaluasi.update({
      where: { pengajuanEvaluasiId: state.pengajuanEvaluasiId },
      data: { status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN },
    });
    await reconciler.reconcile(now);
    reminders = await prisma.pengingatWhatsApp.findMany();
    expect(reminders.map((row) => row.penggunaId)).toEqual([state.kepalaOpdId]);

    await prisma.pengajuanEvaluasi.update({
      where: { pengajuanEvaluasiId: state.pengajuanEvaluasiId },
      data: { status: StatusPengajuanEvaluasi.SELESAI },
    });
    await reconciler.reconcile(now);
    await expect(prisma.pengingatWhatsApp.count()).resolves.toBe(0);
  });

  it('hanya mengizinkan satu worker memenangkan optimistic claim', async () => {
    await seedWorkflow();
    const now = new Date('2026-08-02T00:00:00.000Z');
    await reconciler.reconcile(now);
    const reminder = await prisma.pengingatWhatsApp.findFirstOrThrow();
    const results = await Promise.all([
      repository.tryClaim(
        reminder.pengingatWhatsAppId,
        '00000000-0000-4000-8000-000000000001',
        now,
        new Date(now.getTime() + 60_000),
      ),
      repository.tryClaim(
        reminder.pengingatWhatsAppId,
        '00000000-0000-4000-8000-000000000002',
        now,
        new Date(now.getTime() + 60_000),
      ),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('menghapus reminder evaluator yang dinonaktifkan', async () => {
    const state = await seedWorkflow();
    const now = new Date('2026-08-02T00:00:00.000Z');
    await reconciler.reconcile(now);
    await prisma.pengguna.update({
      where: { penggunaId: state.evaluatorIds[0] },
      data: { deletedAt: new Date() },
    });
    await reconciler.reconcile(now);
    const reminders = await prisma.pengingatWhatsApp.findMany();
    expect(reminders.map((row) => row.penggunaId)).toEqual([state.evaluatorIds[1]]);
  });
});
