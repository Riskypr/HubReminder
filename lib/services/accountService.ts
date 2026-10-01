// lib/services/accountService.ts
// Service layer untuk sesi akun MagangHub.
// PENTING: kolom encrypted_cookie TIDAK PERNAH dikembalikan ke response API/client.

import { createClient } from '@/lib/supabase/server';
import { encryptCookie } from '@/lib/utils/crypto';
import type { MagangHubSession, SessionStatus } from '@/lib/types/session';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Simpan (atau update) sesi MagangHub pengguna.
 * Cookie dienkripsi sebelum menyentuh database.
 */
export async function saveSession(
  userId: string,
  rawCookie: string,
  client?: SupabaseServerClient
): Promise<{ error: string | null }> {
  const supabase = client ?? (await createClient());
  const encrypted = await encryptCookie(rawCookie);

  const { error } = await supabase
    .from('maganghub_sessions')
    .upsert(
      {
        user_id: userId,
        encrypted_cookie: encrypted,
        status: 'unverified' as SessionStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Ambil status sesi (tanpa encrypted_cookie) untuk ditampilkan ke client.
 */
export async function getSessionStatus(
  userId: string,
  client?: SupabaseServerClient
): Promise<Pick<MagangHubSession, 'status' | 'last_verified_at'> | null> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .from('maganghub_sessions')
    .select('status, last_verified_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Hapus sesi pengguna (disconnect akun MagangHub).
 */
export async function deleteSession(
  userId: string,
  client?: SupabaseServerClient
): Promise<{ error: string | null }> {
  const supabase = client ?? (await createClient());

  const { error } = await supabase
    .from('maganghub_sessions')
    .delete()
    .eq('user_id', userId);

  if (error) return { error: error.message };
  return { error: null };
}
