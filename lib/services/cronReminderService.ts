import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import type { AttendanceStatus } from '@/lib/types/attendance';

export interface CronReminderMember {
  name: string;
  status: AttendanceStatus | 'unknown';
}

const STATUS_LABEL: Record<CronReminderMember['status'], string> = {
  belum_lapor: 'Belum mengisi laporan',
  selesai: 'Laporan sudah diisi',
  session_expired: 'Sesi MagangHub kedaluwarsa',
  unknown: 'Status belum tersedia',
};

/** Buat pesan ringkas yang aman dikirim ke grup WhatsApp. */
export function formatCronReminderMessage(members: CronReminderMember[], now = new Date()): string {
  const jakartaNow = toZonedTime(now, 'Asia/Jakarta');
  const dateLabel = format(jakartaNow, "EEEE, d MMMM yyyy • HH:mm 'WIB'", { locale: id });
  return [
    '*[REMINDER MAGANGHUB]*',
    '',
    `Pembaruan status laporan (${dateLabel})`,
    '',
    '*Status peserta:*',
    ...members.map((member) => `• ${member.name} — ${STATUS_LABEL[member.status]}`),
    '',
    'Bagi yang belum mengisi laporan, silakan buka MagangHub dan isi laporan hari ini.',
  ].join('\n');
}
