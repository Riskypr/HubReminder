import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { formatCronReminderMessage, type CronReminderMember } from '@/lib/services/cronReminderService';
import { getFoonteConfig, sendFoonteMessage } from '@/lib/services/foonteService';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AttendanceStatus } from '@/lib/types/attendance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SessionRow = { user_id: string; profiles: { full_name: string | null } | null };
type CheckRow = { user_id: string; status: AttendanceStatus; checked_at: string };

function isValidSecret(receivedSecret: string | null): boolean {
  const expectedSecret = process.env.CRON_SECRET_KEY;
  if (!expectedSecret || !receivedSecret) return false;
  const expected = Buffer.from(expectedSecret);
  const received = Buffer.from(receivedSecret);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function handleReminder(request: NextRequest) {
  if (!process.env.CRON_SECRET_KEY) {
    return NextResponse.json({ error: 'Konfigurasi cron belum lengkap' }, { status: 500 });
  }
  if (!isValidSecret(request.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data: sessions, error: sessionError } = await supabase
      .from('maganghub_sessions')
      .select('user_id, profiles(full_name)')
      .eq('status', 'valid');
    if (sessionError) throw new Error(`Gagal mengambil sesi aktif: ${sessionError.message}`);
    if (!sessions?.length) {
      return NextResponse.json({ success: true, sent: false, reason: 'no_active_sessions' });
    }

    const { data: checks, error: checkError } = await supabase
      .from('attendance_checks')
      .select('user_id, status, checked_at')
      .in('user_id', sessions.map((session) => session.user_id))
      .order('checked_at', { ascending: false });
    if (checkError) throw new Error(`Gagal mengambil status laporan: ${checkError.message}`);

    const latestStatusByUser = new Map<string, AttendanceStatus>();
    for (const check of (checks ?? []) as CheckRow[]) {
      if (!latestStatusByUser.has(check.user_id)) latestStatusByUser.set(check.user_id, check.status);
    }
    const members: CronReminderMember[] = (sessions as unknown as SessionRow[]).map((session) => ({
      name: session.profiles?.full_name?.trim() || 'Peserta MagangHub',
      status: latestStatusByUser.get(session.user_id) ?? 'unknown',
    }));

    const result = await sendFoonteMessage(formatCronReminderMessage(members), getFoonteConfig());
    const { error: logError } = await supabase.from('reminder_logs').insert({
      sent_at: new Date().toISOString(),
      status: result.ok ? 'sent' : 'failed',
      recipient: process.env.FOONTE_WA_GROUP_ID,
      member_count: members.length,
      provider_status: result.status,
      provider_response: result.responseBody || null,
    });
    if (logError) throw new Error(`Gagal menyimpan log reminder: ${logError.message}`);
    if (!result.ok) return NextResponse.json({ error: 'Foonte menolak pengiriman reminder' }, { status: 502 });

    return NextResponse.json({ success: true, sent: true, recipients: members.length });
  } catch (error) {
    console.error('[cron/reminder] gagal menjalankan reminder:', error);
    return NextResponse.json({ error: 'Gagal menjalankan reminder' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleReminder(request);
}

export async function GET(request: NextRequest) {
  return handleReminder(request);
}
