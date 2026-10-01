// lib/services/pushService.ts
// Subscribe/unsubscribe Web Push — simpan endpoint subscription ke database

import { createClient } from '@/lib/supabase/server';
import type { PushSubscription } from '@/lib/types/session';

/**
 * Simpan push subscription dari browser ke database.
 * Satu user bisa punya beberapa subscription (multi-device).
 */
export async function saveSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: 'endpoint' }
  );

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Hapus push subscription (misal saat user mencabut izin notifikasi).
 */
export async function deleteSubscription(
  endpoint: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Ambil semua subscription milik user (untuk keperluan tampilan/debug).
 */
export async function getUserSubscriptions(
  userId: string
): Promise<PushSubscription[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  return (data ?? []) as PushSubscription[];
}
