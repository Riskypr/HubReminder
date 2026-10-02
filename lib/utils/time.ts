// lib/utils/time.ts
// Utilitas waktu berbasis date-fns + timezone WIB/WITA

import { format, formatDistanceToNow, parseISO, isToday } from 'date-fns';
import { id } from 'date-fns/locale';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export const DEFAULT_TIMEZONE = 'Asia/Jakarta'; // WIB

/**
 * Format tanggal ke "d MMM yyyy" (misal: "1 Okt 2026")
 */
export function formatDate(iso: string, tz = DEFAULT_TIMEZONE): string {
  const zoned = toZonedTime(parseISO(iso), tz);
  return format(zoned, 'd MMM yyyy', { locale: id });
}

/**
 * Format waktu ke "HH:mm" (misal: "14:30")
 */
export function formatTime(iso: string, tz = DEFAULT_TIMEZONE): string {
  const zoned = toZonedTime(parseISO(iso), tz);
  return format(zoned, 'HH:mm', { locale: id });
}

/**
 * Format datetime ke "d MMM yyyy, HH:mm"
 */
export function formatDateTime(iso: string, tz = DEFAULT_TIMEZONE): string {
  const zoned = toZonedTime(parseISO(iso), tz);
  return format(zoned, 'd MMM yyyy, HH:mm', { locale: id });
}

/**
 * Relative time, misal "5 menit lalu"
 */
export function timeAgo(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: id });
}

/**
 * Apakah timestamp ini hari ini (dalam timezone yang diberikan)?
 */
export function isTodayInTz(iso: string, tz = DEFAULT_TIMEZONE): boolean {
  const zoned = toZonedTime(parseISO(iso), tz);
  return isToday(zoned);
}

/**
 * Waktu sekarang dalam timezone tertentu, dalam format "HH:mm"
 */
export function nowTimeString(tz = DEFAULT_TIMEZONE): string {
  const zoned = toZonedTime(new Date(), tz);
  return format(zoned, 'HH:mm');
}

/**
 * Apakah waktu sekarang berada dalam rentang jam aktif reminder?
 * @param startTime "HH:mm"
 * @param endTime   "HH:mm"
 */
export function isWithinActiveHours(
  startTime: string,
  endTime: string,
  tz = DEFAULT_TIMEZONE
): boolean {
  const current = nowTimeString(tz);
  return current >= startTime && current <= endTime;
}

/**
 * Konversi date string ke UTC ISO string
 */
export function toUTC(date: Date, tz = DEFAULT_TIMEZONE): string {
  return fromZonedTime(date, tz).toISOString();
}
