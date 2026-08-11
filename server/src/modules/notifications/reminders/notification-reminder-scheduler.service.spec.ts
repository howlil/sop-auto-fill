/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PushReminderWorkerService } from './push-reminder-worker.service';
import { NotificationReminderReconcilerService } from './notification-reminder-reconciler.service';
import { NotificationReminderSchedulerService } from './notification-reminder-scheduler.service';

function build(inAppEnabled: boolean, whatsappEnabled = false) {
  const schedulerRegistry = {
    addInterval: jest.fn(),
    doesExist: jest.fn().mockReturnValue(true),
    deleteInterval: jest.fn(),
  } as unknown as SchedulerRegistry;
  const reconciler = {
    reconcile: jest.fn().mockResolvedValue({ desired: 0, deleted: 0 }),
  } as unknown as NotificationReminderReconcilerService;
  const pushWorker = {
    processDue: jest.fn().mockResolvedValue({ candidates: 0, processed: 0 }),
  } as unknown as PushReminderWorkerService;
  const config = {
    get: jest.fn((key: string, fallback: unknown) => {
      if (key === 'NOTIFICATION_IN_APP_ENABLED') return inAppEnabled;
      if (key === 'WHATSAPP_ENABLED') return whatsappEnabled;
      if (key === 'NOTIFICATION_RECONCILE_INTERVAL_SECONDS') return 10;
      return fallback;
    }),
  } as unknown as ConfigService;
  return {
    schedulerRegistry,
    reconciler,
    pushWorker,
    service: new NotificationReminderSchedulerService(
      schedulerRegistry,
      reconciler,
      pushWorker,
      config,
    ),
  };
}

describe('NotificationReminderSchedulerService', () => {
  afterEach(() => jest.useRealTimers());

  it('tidak membuat interval atau menjalankan pekerjaan ketika fitur nonaktif', async () => {
    const { service, schedulerRegistry, reconciler, pushWorker } = build(false, false);
    service.onModuleInit();
    await service.tick();
    expect(schedulerRegistry.addInterval).not.toHaveBeenCalled();
    expect(reconciler.reconcile).not.toHaveBeenCalled();
    expect(pushWorker.processDue).not.toHaveBeenCalled();
  });

  it('mendaftarkan interval, menjalankan tick awal, dan membersihkannya saat shutdown', () => {
    jest.useFakeTimers();
    const { service, schedulerRegistry } = build(true);
    const tick = jest.spyOn(service, 'tick').mockResolvedValue(undefined);
    service.onModuleInit();
    expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
      'notification-reminder-reconcile',
      expect.anything(),
    );
    expect(tick).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
      'notification-reminder-reconcile',
    );
  });

  it('mencegah siklus overlap ketika rekonsiliasi sebelumnya belum selesai', async () => {
    const { service, reconciler, pushWorker } = build(true);
    let finishReconcile: (() => void) | undefined;
    (reconciler.reconcile as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finishReconcile = () => resolve({ desired: 0, deleted: 0 });
      }),
    );
    const first = service.tick();
    await service.tick();
    expect(reconciler.reconcile).toHaveBeenCalledTimes(1);
    expect(pushWorker.processDue).not.toHaveBeenCalled();
    finishReconcile?.();
    await first;
    expect(pushWorker.processDue).not.toHaveBeenCalled();
  });

  it('membuka kembali scheduler setelah satu siklus gagal', async () => {
    const { service, reconciler, pushWorker } = build(true, true);
    (reconciler.reconcile as jest.Mock)
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ desired: 0, deleted: 0 });
    await expect(service.tick()).resolves.toBeUndefined();
    await expect(service.tick()).resolves.toBeUndefined();
    expect(reconciler.reconcile).toHaveBeenCalledTimes(2);
    expect(pushWorker.processDue).toHaveBeenCalledTimes(1);
  });

  it('menjalankan worker push hanya ketika whatsapp notification aktif', async () => {
    const enabled = build(false, true);
    await enabled.service.tick();
    expect(enabled.reconciler.reconcile).toHaveBeenCalledTimes(1);
    expect(enabled.pushWorker.processDue).toHaveBeenCalledTimes(1);

    const inAppOnly = build(true, false);
    await inAppOnly.service.tick();
    expect(inAppOnly.reconciler.reconcile).toHaveBeenCalledTimes(1);
    expect(inAppOnly.pushWorker.processDue).not.toHaveBeenCalled();
  });
});
