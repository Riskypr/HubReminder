// lib/services/accountService.ts
// Service layer untuk sesi akun MagangHub.
// Token hanya disimpan terenkripsi dan tidak pernah dikembalikan ke client.

import { createClient } from '@/lib/supabase/server';
import { encryptSessionSecret } from '@/lib/utils/crypto';
import type { MagangHubSession, SessionStatus } from '@/lib/types/session';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Simpan (atau update) sesi MagangHub pengguna.
 * Access dan refresh token dienkripsi sebelum menyentuh database.
 */
export async function saveSession(
  userId: string,
  accessToken: string,
  refreshToken: string | null = null,
  client?: SupabaseServerClient,
  initialStatus: SessionStatus = 'unverified'
): Promise<{ error: string | null }> {
  const supabase = client ?? (await createClient());
  const encryptedAccessToken = await encryptSessionSecret(accessToken);
  const encryptedRefreshToken = refreshToken ? await encryptSessionSecret(refreshToken) : null;

  const { error } = await supabase
    .from('maganghub_sessions')
    .upsert(
      {
        user_id: userId,
        encrypted_session: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        status: initialStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Ambil status sesi tanpa material autentikasi untuk ditampilkan ke client.
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

/**
 * Mengambil dan mendekripsi access token MagangHub untuk keperluan server saja.
 */
export async function getDecryptedSession(
  userId: string,
  client?: SupabaseServerClient
): Promise<string | null> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .from('maganghub_sessions')
    .select('encrypted_session, encrypted_refresh_token, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data || !data.encrypted_session) {
    return null;
  }

  try {
    const { decryptSessionSecret } = await import('@/lib/utils/crypto');
    const accessToken = await decryptSessionSecret(data.encrypted_session);
    const refreshToken = data.encrypted_refresh_token
      ? await decryptSessionSecret(data.encrypted_refresh_token)
      : null;
    if (!refreshToken && (accessToken.includes('=') || accessToken.includes(';') || accessToken.startsWith('Bearer '))) {
      return accessToken;
    }
    return JSON.stringify({ accessToken, refreshToken });
  } catch (err) {
    console.error('Failed to decrypt MagangHub session');
    return null;
  }
}

export async function updateSessionTokens(
  userId: string,
  accessToken: string,
  refreshToken?: string | null,
  client?: SupabaseServerClient
): Promise<void> {
  const supabase = client ?? (await createClient());
  const encryptedSession = await encryptSessionSecret(accessToken);
  const payload: Record<string, string | null> = {
    encrypted_session: encryptedSession,
    updated_at: new Date().toISOString(),
  };
  if (refreshToken !== undefined) {
    payload.encrypted_refresh_token = refreshToken ? await encryptSessionSecret(refreshToken) : null;
  }
  const { error } = await supabase.from('maganghub_sessions').update(payload).eq('user_id', userId);
  if (error) throw new Error('Gagal memperbarui sesi MagangHub');
}
