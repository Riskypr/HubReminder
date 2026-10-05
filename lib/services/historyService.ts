import { createClient } from '@/lib/supabase/server';
import { dateKeyInTz } from '@/lib/utils/dateKey';
import { isTodayInTz, DEFAULT_TIMEZONE } from '@/lib/utils/time';
import type { AttendanceCheck } from '@/lib/types/attendance';
import type { NotificationLog } from '@/lib/types/reminder';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Ambil status hari ini (hanya jika record dicek pada hari ini di timezone user).
 */
export async function getTodayStatus(
  userId: string,
  client?: SupabaseServerClient,
  tz = DEFAULT_TIMEZONE
): Promise<AttendanceCheck | null> {
  const supabase = client ?? (await createClient());

  const { data } = await supabase
    .from('attendance_checks')
    .select('*')
    .eq('user_id', userId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  // Hanya anggap sebagai status hari ini jika tanggal dicek memang hari ini
  if (!isTodayInTz(data.checked_at, tz)) {
    return null;
  }

  return data as AttendanceCheck;
}

/**
 * Ambil record pengecekan paling akhir tanpa memandang tanggal (untuk info "terakhir dicek").
 */
export async function getLatestStatusCheck(
  userId: string,
  client?: SupabaseServerClient
): Promise<AttendanceCheck | null> {
  const supabase = client ?? (await createClient());

  const { data } = await supabase
    .from('attendance_checks')
    .select('*')
    .eq('user_id', userId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as AttendanceCheck | null;
}

/**
 * Ambil riwayat attendance (per hari, N hari terakhir).
 */
export async function getAttendanceHistory(
  userId: string,
  limit = 30,
  client?: SupabaseServerClient,
  tz = DEFAULT_TIMEZONE,
): Promise<AttendanceCheck[]> {
  const supabase = client ?? (await createClient());
  const days: AttendanceCheck[] = [];
  const seenDays = new Set<string>();
  const pageSize = 1000;

  for (let offset = 0; days.length < limit; offset += pageSize) {
    const { data, error } = await supabase
      .from('attendance_checks')
      .select('*')
      .eq('user_id', userId)
      .order('checked_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error || !data?.length) break;

    for (const row of data as AttendanceCheck[]) {
      const day = dateKeyInTz(row.checked_at, tz);
      if (seenDays.has(day)) continue;
      seenDays.add(day);
      days.push(row);
      if (days.length >= limit) break;
    }

    if (data.length < pageSize) break;
  }

  return days;
}

/**
 * Ambil log notifikasi yang terkirim (N terbaru).
 */
export async function getNotificationLogs(
  userId: string,
  limit = 50,
  client?: SupabaseServerClient
): Promise<NotificationLog[]> {
  const supabase = client ?? (await createClient());

  const { data } = await supabase
    .from('notification_logs')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as NotificationLog[];
}

/**
 * Jumlah notifikasi terkirim hari ini + waktu terakhir kirim.
 */
export async function getTodayNotificationSummary(
  userId: string,
  client?: SupabaseServerClient,
  tz = DEFAULT_TIMEZONE
): Promise<{
  sentToday: number;
  lastSentAt: string | null;
}> {
  const supabase = client ?? (await createClient());

  const { data } = await supabase
    .from('notification_logs')
    .select('sent_at')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(50);

  const logsToday = (data ?? []).filter((log) => isTodayInTz(log.sent_at, tz));

  return {
    sentToday: logsToday.length,
    lastSentAt: logsToday[0]?.sent_at ?? null,
  };
}
