// components/dashboard/ProfileCard.tsx
// Kartu Profil MagangHub hasil sinkronisasi otomatis via Backend Proxy
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/lib/types/session';

interface ProfileCardProps {
  profile: Profile | null;
  isConnected: boolean;
}

export default function ProfileCard({ profile, isConnected }: ProfileCardProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  if (!isConnected) return null;

  async function handleSync() {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/profile/sync', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSyncMessage('✓ Profil berhasil disinkronkan');
        router.refresh();
      } else {
        setSyncMessage(data?.error || 'Gagal sinkronisasi');
      }
    } catch {
      setSyncMessage('Koneksi bermasalah saat sinkronisasi');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  }

  const name = profile?.full_name || 'Peserta Magang';
  const company = profile?.company_name || 'Instansi / Perusahaan Magang';
  const period = profile?.internship_period;
  const status = profile?.participant_status || 'Aktif';
  const syncedTime = profile?.maganghub_synced_at
    ? new Date(profile.maganghub_synced_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  // Inisial avatar jika tidak ada foto
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <div className="card space-y-3 bg-gradient-to-r from-blue-50/50 via-surface to-surface border border-blue-100/70 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {profile?.photo_url ? (
            <img
              src={profile.photo_url}
              alt={name}
              className="w-12 h-12 rounded-full object-cover border-2 border-primary/20 shrink-0"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20 shrink-0"
              aria-hidden="true"
            >
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-text-primary truncate">{name}</h1>
              <span className="badge-done text-[10px] px-2 py-0.5 uppercase tracking-wider font-semibold">
                {status}
              </span>
            </div>
            <p className="text-xs text-text-secondary truncate mt-0.5">{company}</p>
            {period && (
              <p className="text-[11px] text-text-muted mt-0.5">
                📅 {period}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="text-xs text-primary hover:text-primary-dark transition-colors px-2.5 py-1.5 rounded-md hover:bg-blue-50 disabled:opacity-50 shrink-0 font-medium flex items-center gap-1 border border-primary/20"
          title="Sinkronkan data profil dari MagangHub"
          id="btn-sync-profile"
        >
          <span className={`inline-block ${isSyncing ? 'animate-spin' : ''}`}>🔄</span>
          <span>{isSyncing ? 'Sinkron...' : 'Sync'}</span>
        </button>
      </div>

      {syncMessage && (
        <p
          role="status"
          className={`text-xs ${
            syncMessage.startsWith('✓') ? 'text-status-done font-medium' : 'text-red-500'
          }`}
        >
          {syncMessage}
        </p>
      )}

      {syncedTime && (
        <div className="text-[10px] text-text-muted flex justify-between items-center pt-2 border-t border-border/60">
          <span>Sinkronisasi MagangHub</span>
          <span>Pukul {syncedTime}</span>
        </div>
      )}
    </div>
  );
}
