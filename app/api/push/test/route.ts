// app/api/push/test/route.ts
// Mengirimkan notifikasi Web Push uji coba ke seluruh subscription milik user saat ini

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import webpush from 'web-push';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@maganghub.local';

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json(
      { error: 'VAPID Keys belum dikonfigurasi di Environment Variables' },
      { status: 500 }
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  // Ambil subscription milik user ini
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user.id);

  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json(
      { error: 'Belum ada perangkat yang terdaftar. Aktifkan notifikasi terlebih dahulu di Dashboard.' },
      { status: 400 }
    );
  }

  const payload = JSON.stringify({
    title: 'HubReminder (Uji Coba)',
    body: 'Laporan hari ini belum diisi — tap untuk isi sekarang.',
    url: 'https://monev.maganghub.kemnaker.go.id/dashboard',
  });

  const results = [];
  for (const sub of subs) {
    try {
      const res = await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
      results.push({ endpoint: sub.endpoint.slice(0, 30), success: true, statusCode: res.statusCode });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      results.push({
        endpoint: sub.endpoint.slice(0, 30),
        success: false,
        statusCode: error.statusCode,
        error: error.message,
      });
    }
  }

  // Catat riwayat tes ke notification_logs
  await supabase.from('notification_logs').insert({
    user_id: user.id,
    sent_at: new Date().toISOString(),
    status_at_send: 'belum_lapor',
    sequence_today: 1,
  });

  return NextResponse.json({
    success: true,
    sentToDevices: results.filter((r) => r.success).length,
    totalDevices: subs.length,
    details: results,
  });
}
