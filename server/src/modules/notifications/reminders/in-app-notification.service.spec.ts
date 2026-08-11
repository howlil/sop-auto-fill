/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import {
  JenisPengingatWhatsApp as NotificationReminderKind,
  PeranPengguna,
  StatusPengajuanEvaluasi,
} from '../../../generated/prisma';
import { InAppNotificationService } from './in-app-notification.service';
import { NotificationEventsService } from './notification-events.service';
import { ReminderMessageFactory } from './reminder-message.factory';
import { NotificationReminderRepository } from './notification-reminder.repository';

const createdAt = new Date('2026-08-08T01:00:00.000Z');
const updatedAt = new Date('2026-08-08T02:00:00.000Z');

function build() {
  const repository = {
    countUnreadInApp: jest.fn().mockResolvedValue(3),
    findInAppNotifications: jest.fn().mockResolvedValue([
      {
        notificationReminderId: '11111111-1111-4111-8111-111111111111',
        pengajuanEvaluasiId: 'pengajuan-1',
        penggunaId: 'user-1',
        kind: NotificationReminderKind.EVALUASI_SOP,
        destination: 'user-1@example.test',
        inAppReadAt: null,
        createdAt,
        updatedAt,
        pengajuanEvaluasi: {
          pengajuanEvaluasiId: 'pengajuan-1',
          opdId: 'opd-1',
          opdNama: 'Dinas Kesehatan',
          nomorBA: null,
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          jumlahSop: 2,
        },
        pengguna: {
          penggunaId: 'user-1',
          opdId: 'opd-1',
          email: 'user-1@example.test',
          nama: 'Evaluator Satu',
          peran: PeranPengguna.EVALUATOR,
          nohp: '628123456789',
          deletedAt: null,
        },
      },
    ]),
    markInAppRead: jest.fn().mockResolvedValue(true),
    markAllInAppRead: jest.fn().mockResolvedValue(2),
  } as unknown as jest.Mocked<NotificationReminderRepository>;
  const events = new NotificationEventsService();
  const emitted: unknown[] = [];
  const subscription = events.events$.subscribe((event) => emitted.push(event));
  const service = new InAppNotificationService(repository, new ReminderMessageFactory(), events);
  return { service, repository, emitted, subscription };
}

describe('InAppNotificationService', () => {
  it('membangun daftar notifikasi in-app dari state reminder aktif', async () => {
    const { service, repository, subscription } = build();
    await expect(service.findMine('user-1', 500)).resolves.toEqual([
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        pengajuanEvaluasiId: 'pengajuan-1',
        title: 'Menunggu Proses Evaluasi SOP',
        preview: 'Terdapat 2 dokumen SOP dari Dinas Kesehatan yang menunggu proses evaluasi.',
        readAt: null,
        createdAt,
        updatedAt,
      }),
    ]);
    expect(repository.findInAppNotifications).toHaveBeenCalledWith('user-1', 50);
    subscription.unsubscribe();
  });

  it('menandai satu notifikasi dibaca dan mengirim event perubahan', async () => {
    const { service, repository, emitted, subscription } = build();
    await expect(
      service.markRead('user-1', '11111111-1111-4111-8111-111111111111'),
    ).resolves.toEqual({ unreadCount: 3 });
    expect(repository.markInAppRead).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
      expect.any(Date),
    );
    expect(emitted).toEqual([expect.objectContaining({ penggunaId: 'user-1', type: 'changed' })]);
    subscription.unsubscribe();
  });

  it('mengembalikan NotFound ketika notifikasi bukan milik pengguna', async () => {
    const { service, repository, subscription } = build();
    repository.markInAppRead.mockResolvedValue(false);
    await expect(service.markRead('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    subscription.unsubscribe();
  });

  it('menandai semua notifikasi dibaca dan mengirim event hanya saat ada perubahan', async () => {
    const { service, repository, emitted, subscription } = build();
    await expect(service.markAllRead('user-1')).resolves.toEqual({
      unreadCount: 3,
      updated: 2,
    });
    expect(emitted).toHaveLength(1);

    emitted.length = 0;
    repository.markAllInAppRead.mockResolvedValue(0);
    await expect(service.markAllRead('user-1')).resolves.toEqual({
      unreadCount: 3,
      updated: 0,
    });
    expect(emitted).toHaveLength(0);
    subscription.unsubscribe();
  });
});
