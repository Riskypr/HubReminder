import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  createReminderCronJob,
  getCronJobOrgConfig,
  upsertCronJobOrgJob,
} from '@/lib/services/cronJobOrgService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function hasValidSecret(received: string | null): boolean {
  const expected = process.env.CRON_SECRET_KEY;
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Sinkronkan satu job reminder ke REST API cron-job.org.
 * Panggil sekali setelah deploy (atau setelah jadwal environment diubah).
 */
export async function POST(request: NextRequest) {
  if (!hasValidSecret(request.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = getCronJobOrgConfig();
    const secret = process.env.CRON_SECRET_KEY;
    const appUrl = process.env.APP_URL?.replace(/\/$/, '');
    if (!config || !secret || !appUrl) {
      return NextResponse.json(
        { error: 'CRON_JOB_ORG_API_KEY, CRON_SECRET_KEY, dan APP_URL wajib diisi' },
        { status: 500 },
      );
    }

    const result = await upsertCronJobOrgJob(
      createReminderCronJob(`${appUrl}/api/cron/reminder`, secret),
      config,
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[cron/reminder/configure] gagal menyinkronkan job:', error);
    return NextResponse.json({ error: 'Gagal menyinkronkan job cron-job.org' }, { status: 502 });
  }
}
