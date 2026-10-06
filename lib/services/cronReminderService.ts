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
    'Bagi yang belum mengisi laporan, silakan isi absensi hari ini melalui Monev:',
    'https://monev.maganghub.kemnaker.go.id/dashboard',
  ].join('\n');
}

export function formatBulkReportReminder(members: Pick<CronReminderMember, 'name'>[]): string {
  return [
    ...members.map((member) => `${member.name} - belum mengisi laporan`),
    '',
    'Silahkan mengisi laporan anda sekarang di link monev maganghub:',
    'https://monev.maganghub.kemnaker.go.id/dashboard',
  ].join('\n');
}

export function formatCookieWarningMessage(members: { name: string; expiringSoon: boolean }[], hubUrl: string): string {
  const appUrl = hubUrl.replace(/\/$/, '');
  return [
    'Daftar peserta yang masa aktif cookie-nya sudah habis / mau habis:',
    ...members.map((member) => `- ${member.name} - session cookie ${member.expiringSoon ? 'mau habis' : 'sudah habis'}, silahkan perbarui cookie`),
    '',
    'Silahkan perbarui cookie anda melalui link berikut:',
    appUrl,
  ].join('\n');
}
