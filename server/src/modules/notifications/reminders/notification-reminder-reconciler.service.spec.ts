/* eslint-disable @typescript-eslint/unbound-method */
import { JenisPengingatWhatsApp as NotificationReminderKind } from '../../../generated/prisma';
import { NotificationEventsService } from './notification-events.service';
import { NotificationRecipientResolverService } from './notification-recipient-resolver.service';
import { NotificationReminderReconcilerService } from './notification-reminder-reconciler.service';
import { NotificationReminderRepository } from './notification-reminder.repository';

describe('NotificationReminderReconcilerService', () => {
  it('upsert reminder yang diinginkan dan menghapus state stale', async () => {
    const desired = {
      pengajuanEvaluasiId: 'p-1',
      penggunaId: 'u-1',
      kind: NotificationReminderKind.EVALUASI_SOP,
      destination: 'u-1@example.test',
    };
    const repository = {
      findActionablePengajuan: jest.fn().mockResolvedValue([{ pengajuanEvaluasiId: 'p-1' }]),
      findActiveRecipients: jest.fn().mockResolvedValue([{ penggunaId: 'u-1' }]),
      findExistingReminders: jest.fn().mockResolvedValue([
        { notificationReminderId: 'keep', ...desired },
        {
          notificationReminderId: 'stale',
          pengajuanEvaluasiId: 'p-old',
          penggunaId: 'u-1',
          kind: NotificationReminderKind.EVALUASI_SOP,
        },
      ]),
      upsertDesiredReminder: jest.fn().mockResolvedValue(undefined),
      deleteReminderIds: jest.fn().mockResolvedValue(1),
    } as unknown as NotificationReminderRepository;
    const resolver = {
      resolve: jest.fn().mockReturnValue([desired]),
    } as unknown as NotificationRecipientResolverService;
    const events = { emitChanged: jest.fn() } as unknown as NotificationEventsService;
    const service = new NotificationReminderReconcilerService(repository, resolver, events);
    const now = new Date('2026-08-02T00:00:00.000Z');

    await expect(service.reconcile(now)).resolves.toEqual({ desired: 1, deleted: 1 });
    expect(repository.upsertDesiredReminder).toHaveBeenCalledWith(desired, now);
    expect(repository.deleteReminderIds).toHaveBeenCalledWith(['stale']);
    expect(events.emitChanged).toHaveBeenCalledWith('u-1');
    expect(events.emitChanged).toHaveBeenCalledWith();
  });

  it('tetap membersihkan semua reminder ketika tidak ada status actionable', async () => {
    const repository = {
      findActionablePengajuan: jest.fn().mockResolvedValue([]),
      findActiveRecipients: jest.fn().mockResolvedValue([]),
      findExistingReminders: jest.fn().mockResolvedValue([
        {
          notificationReminderId: 'stale',
          pengajuanEvaluasiId: 'p-1',
          penggunaId: 'u-1',
          kind: NotificationReminderKind.EVALUASI_SOP,
        },
      ]),
      upsertDesiredReminder: jest.fn(),
      deleteReminderIds: jest.fn().mockResolvedValue(1),
    } as unknown as NotificationReminderRepository;
    const resolver = { resolve: jest.fn() } as unknown as NotificationRecipientResolverService;
    const events = { emitChanged: jest.fn() } as unknown as NotificationEventsService;
    const service = new NotificationReminderReconcilerService(repository, resolver, events);

    await service.reconcile();
    expect(repository.deleteReminderIds).toHaveBeenCalledWith(['stale']);
    expect(repository.upsertDesiredReminder).not.toHaveBeenCalled();
    expect(events.emitChanged).toHaveBeenCalledWith();
  });
});
