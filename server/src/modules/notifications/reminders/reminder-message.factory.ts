import { Injectable } from '@nestjs/common';
import { JenisPengingatWhatsApp as NotificationReminderKind } from '../../../generated/prisma';
import type { ClaimedNotificationReminder } from './notification-reminder.types';

export type ReminderMessage = Readonly<{
  subject: string;
  title: string;
  preview: string;
  body: string;
}>;

@Injectable()
export class ReminderMessageFactory {
  build(reminder: ClaimedNotificationReminder): ReminderMessage {
    const recipientName = this.singleLine(reminder.pengguna.nama, 'Bapak/Ibu');
    const opdName = this.singleLine(reminder.pengajuanEvaluasi.opdNama, 'OPD terkait');
    const commonClosing =
      'Untuk menindaklanjuti hal tersebut, silakan masuk (login) ke dalam Sistem Informasi SOPFlow untuk melakukan pengecekan dan penyelesaian tugas terkait.\n\n' +
      'Demikian pemberitahuan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.\n\n' +
      'Catatan: Pesan ini dihasilkan secara otomatis oleh sistem. Abaikan pesan ini apabila Bapak/Ibu telah menindaklanjuti proses tersebut.';

    switch (reminder.kind) {
      case NotificationReminderKind.EVALUASI_SOP: {
        const preview = `Terdapat ${reminder.pengajuanEvaluasi.jumlahSop} dokumen SOP dari ${opdName} yang menunggu proses evaluasi.`;
        return {
          subject: 'Pemberitahuan SOPFlow: Menunggu Proses Evaluasi SOP',
          title: 'Menunggu Proses Evaluasi SOP',
          preview,
          body:
            `Yth. Bapak/Ibu ${recipientName},\n\n` +
            `Bersama pesan ini, kami memberitahukan bahwa terdapat ${reminder.pengajuanEvaluasi.jumlahSop} dokumen Standar Operasional Prosedur (SOP) dari lingkungan ${opdName} yang saat ini sedang menunggu proses evaluasi oleh Bapak/Ibu.\n\n` +
            commonClosing,
        };
      }
      case NotificationReminderKind.TTD_BA_PJ_EVALUATOR:
      case NotificationReminderKind.TTD_BA_PJ_PENYUSUN: {
        const nomorBA = this.singleLine(reminder.pengajuanEvaluasi.nomorBA, '-');
        const preview = `Berita Acara Evaluasi nomor ${nomorBA} dari ${opdName} menunggu proses Tanda Tangan Elektronik (TTE).`;
        return {
          subject: 'Pemberitahuan SOPFlow: Menunggu TTE Berita Acara',
          title: 'Berita Acara Menunggu TTE',
          preview,
          body:
            `Yth. Bapak/Ibu ${recipientName},\n\n` +
            `Bersama pesan ini, kami memberitahukan bahwa Berita Acara Evaluasi SOP dengan nomor referensi ${nomorBA} dari lingkungan ${opdName} telah diterbitkan dan saat ini menunggu proses verifikasi serta pengesahan melalui Tanda Tangan Elektronik (TTE) oleh Bapak/Ibu.\n\n` +
            commonClosing,
        };
      }
      case NotificationReminderKind.TTD_SOP_KEPALA_OPD: {
        const preview = `Dokumen SOP dari ${opdName} telah diverifikasi dan menunggu pengesahan akhir (TTE).`;
        return {
          subject: 'Pemberitahuan SOPFlow: Menunggu Pengesahan TTE Kepala OPD',
          title: 'Dokumen SOP Menunggu Pengesahan',
          preview,
          body:
            `Yth. Bapak/Ibu ${recipientName},\n\n` +
            `Bersama pesan ini, kami memberitahukan bahwa seluruh rangkaian evaluasi dokumen Standar Operasional Prosedur (SOP) di lingkungan ${opdName} telah selesai diverifikasi. Dokumen tersebut kini menunggu pengesahan resmi melalui Tanda Tangan Elektronik (TTE) oleh Bapak/Ibu selaku Kepala OPD terkait.\n\n` +
            commonClosing,
        };
      }
      default:
        throw new Error(`Unhandled reminder kind: ${String(reminder.kind)}`);
    }
  }

  private singleLine(value: string | null | undefined, fallback: string): string {
    const normalized = value
      ?.replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return normalized && normalized.length > 0 ? normalized : fallback;
  }
}
