// components/dashboard/ProfileCard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { Briefcase, Building2, CalendarDays, CheckCircle, Clock, RefreshCw, User } from 'lucide-react';
import type { Profile } from '@/lib/types/session';
import { formatInternshipPeriod } from '@/lib/utils/time';

interface ProfileCardProps {
  profile: Profile | null;
  isConnected: boolean;
}

export default function ProfileCard({ profile, isConnected }: ProfileCardProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  if (!isConnected) return null;

  async function handleSync() {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/profile/sync', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSyncMessage('✓ Profil berhasil disinkronkan');
        setImageError(false);
        toast.success('Profil berhasil disinkronkan dari MagangHub.');
        router.refresh();
      } else {
        const errorMsg = data?.error || 'Gagal sinkronisasi profil';
        setSyncMessage(errorMsg);
        toast.error(errorMsg);
      }
    } catch {
      setSyncMessage('Koneksi bermasalah');
      toast.error('Koneksi bermasalah saat sinkronisasi.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3500);
    }
  }

  const name = profile?.full_name || 'Peserta Magang';
  const role = profile?.position || profile?.role || 'Posisi Magang yang Diampu';
  const company = profile?.company_name || 'Instansi / Perusahaan Magang';
  const period = formatInternshipPeriod(profile?.internship_period);
  const status = profile?.participant_status || 'Aktif';
  const photoUrl = profile?.photo_url;
  const syncedTime = profile?.maganghub_synced_at
    ? new Date(profile.maganghub_synced_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <div className="card relative flex h-full flex-col justify-between overflow-hidden border-slate-200/90 bg-gradient-to-br from-white via-white to-blue-50/40 p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Foto Profil Pengguna dengan Fallback Avatar */}
          <div className="relative shrink-0">
            {photoUrl && !imageError ? (
              <img
                src={photoUrl}
                alt={name}
                onError={() => setImageError(true)}
                className="h-14 w-14 rounded-2xl object-cover ring-2 ring-primary/25 shadow-sm"
              />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-[#7C3AED] text-sm font-bold text-white shadow-md shadow-primary/20"
                aria-hidden="true"
              >
                {initials || <User size={22} />}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
              <CheckCircle size={10} strokeWidth={3} />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold text-text-primary tracking-tight">{name}</h3>
              <span className="badge-done inline-flex items-center gap-1 text-[10px] px-2 py-0.5 uppercase tracking-wider font-semibold">
                <CheckCircle size={11} aria-hidden="true" />
                {status}
              </span>
            </div>

            {/* Posisi Magang / Job Role */}
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-primary">
              <Briefcase size={13} className="shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{role}</span>
            </p>

            {/* Instansi Perusahaan Magang */}
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-text-secondary">
              <Building2 size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">{company}</span>
            </p>

            {/* Periode Magang */}
            {period && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                <CalendarDays size={12} className="shrink-0 text-slate-400" aria-hidden="true" />
                <span>{period}</span>
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-text-secondary shadow-2xs transition hover:border-primary/40 hover:bg-blue-50/50 hover:text-primary active:scale-95 disabled:opacity-50 shrink-0"
          title="Sinkronkan data profil dari MagangHub"
          id="btn-sync-profile"
        >
          <RefreshCw size={13} className={isSyncing ? 'animate-spin text-primary' : 'text-slate-400'} aria-hidden="true" />
          <span className="hidden sm:inline">{isSyncing ? 'Menyinkronkan...' : 'Sinkron'}</span>
        </button>
      </div>

      {syncMessage && (
        <p
          role="status"
          className={`text-xs ${
            syncMessage.startsWith('✓') ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'
          }`}
        >
          {syncMessage}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Status MagangHub: <strong className="text-slate-700 font-medium">{status}</strong>
        </span>
        {syncedTime && (
          <span className="inline-flex items-center gap-1">
            <Clock size={11} className="text-slate-400" aria-hidden="true" />
            Sinkron {syncedTime}
          </span>
        )}
      </div>
    </div>
  );
}
