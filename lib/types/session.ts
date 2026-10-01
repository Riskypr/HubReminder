// lib/types/session.ts
export type SessionStatus = 'valid' | 'expired' | 'unverified';

export interface MagangHubSession {
  id: string;
  user_id: string;
  // PENTING: encrypted_cookie TIDAK pernah dikembalikan ke client
  status: SessionStatus;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// Tipe yang aman dikembalikan ke client (tanpa encrypted_cookie)
export type SessionPublic = Omit<MagangHubSession, never>;

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  timezone: string; // default 'Asia/Makassar'
  created_at: string;
}
