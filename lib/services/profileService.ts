// lib/services/profileService.ts
// Service layer untuk mengelola data profil pengguna.

import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types/session';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Mengambil data profil pengguna berdasarkan user_id.
 */
export async function getUserProfile(
  userId: string,
  client?: SupabaseServerClient
): Promise<Profile | null> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * Memperbarui data profil pengguna (mis. setelah disinkronkan dari MagangHub).
 */
export async function updateUserProfile(
  userId: string,
  profileData: Partial<Omit<Profile, 'id' | 'created_at'>>,
  client?: SupabaseServerClient
): Promise<{ error: string | null; data: Profile | null }> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...profileData,
    })
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) return { error: error.message, data: null };
  return { error: null, data: data as Profile };
}
