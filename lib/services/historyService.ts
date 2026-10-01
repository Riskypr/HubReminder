// lib/services/historyService.ts
// Ambil riwayat status attendance dan log notifikasi

import { createClient } from '@/lib/supabase/server';
import type { AttendanceCheck } from '@/lib/types/attendance';
import type { NotificationLog } from '@/lib/types/reminder';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Ambil status hari ini (check terbaru).
 */
export async function getTodayStatus(
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
  client?: SupabaseServerClient
): Promise<AttendanceCheck[]> {
  const supabase = client ?? (await createClient());

  const { data } = await supabase
    .from('attendance_checks')
    .select('*')
    .eq('user_id', userId)
    .order('checked_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as AttendanceCheck[];
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
  client?: SupabaseServerClient
): Promise<{
  sentToday: number;
  lastSentAt: string | null;
}> {
  const supabase = client ?? (await createClient());
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('notification_logs')
    .select('sent_at')
    .eq('user_id', userId)
    .gte('sent_at', todayStart.toISOString())
    .order('sent_at', { ascending: false });

  return {
    sentToday: data?.length ?? 0,
    lastSentAt: data?.[0]?.sent_at ?? null,
  };
}
