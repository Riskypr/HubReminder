import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function hasValidSecret(received: string | null): boolean {
  const expected = process.env.CRON_SECRET_KEY;
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

/** Jalankan Edge Function pengecek status laporan melalui cron-job.org. */
export async function POST(request: NextRequest) {
  if (!hasValidSecret(request.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Konfigurasi Supabase untuk checker belum lengkap' }, { status: 500 });
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/check-attendance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'cron-job.org' }),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({})) as {
      processed?: number;
      results?: Array<{ success?: boolean }>;
    };
    const failed = (result.results ?? []).filter((item) => item.success === false).length;

    if (!response.ok || failed > 0) {
      console.error('[cron/attendance] checker gagal:', { status: response.status, failed });
      return NextResponse.json({
        error: response.status === 404
          ? 'Edge Function check-attendance belum dideploy pada proyek Supabase ini'
          : 'Pengecekan status laporan gagal',
        checkerStatus: response.status,
        processed: result.processed ?? 0,
        failed,
      }, { status: 502 });
    }

    return NextResponse.json({ success: true, processed: result.processed ?? result.results?.length ?? 0, failed: 0 });
  } catch (error) {
    console.error('[cron/attendance] gagal memanggil Edge Function:', error);
    return NextResponse.json({ error: 'Gagal memanggil pengecek status laporan' }, { status: 502 });
  }
}
