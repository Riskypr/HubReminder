// lib/types/attendance.ts
// Tipe status attendance — definisi satu kali, di-import di seluruh layer.
// Jangan tulis ulang string literal ini di file lain.

export type AttendanceStatus =
  | 'belum_lapor'
  | 'selesai'
  | 'unknown'
  | 'session_expired';

export interface AttendanceCheck {
  id: string;
  user_id: string;
  checked_at: string; // ISO 8601 timestamptz
  status: AttendanceStatus;
  detected_via: string | null;
}
