'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Cookie,
  KeyRound,
  LogIn,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unplug,
  User,
} from 'lucide-react';
import type { MagangHubSession, Profile, SessionStatus } from '@/lib/types/session';
import { formatInternshipPeriod } from '@/lib/utils/time';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Props {
  currentSession: Pick<MagangHubSession, 'status' | 'last_verified_at'> | null;
  currentProfile?: Profile | null;
}

const statusCopy: Record<SessionStatus, { label: string; detail: string; badge: string }> = {
  valid: {
    label: 'Akun MagangHub Terhubung',
    detail: 'Sesi aktif dan sinkronisasi kehadiran berjalan normal.',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  expired: {
    label: 'Sesi Perlu Diperbarui',
    detail: 'Sesi kedaluwarsa. Silakan perbarui cookie login akun MagangHub.',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  unverified: {
    label: 'Belum Terhubung',
    detail: 'Hubungkan akun MagangHub untuk mulai memantau absensi.',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
  },
};

export default function ConnectAccountForm({ currentSession, currentProfile }: Props) {
  const [loginMode, setLoginMode] = useState<'cookie' | 'credentials'>('cookie');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cookie, setCookie] = useState('');
  const [status, setStatus] = useState<SessionStatus>(currentSession?.status ?? 'unverified');
  const [lastVerified, setLastVerified] = useState(currentSession?.last_verified_at ?? null);
  const [profile, setProfile] = useState<Profile | null>(currentProfile ?? null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/maganghub/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          loginMode === 'cookie'
            ? { mode: 'cookie', cookie }
            : { mode: 'credentials', email, password },
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Login MagangHub gagal.');
      setStatus('valid');
      setLastVerified(new Date().toISOString());
      setProfile(data.profile ?? null);
      setPassword('');
      setCookie('');
      const message = `Akun MagangHub berhasil dihubungkan${data.userName ? ` sebagai ${data.userName}` : ''}.`;
      setSuccess(message);
      toast.success(message);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Terjadi kesalahan saat menghubungkan akun.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function checkSession() {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/account/check-session', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal memeriksa sesi.');
      setStatus(data.status ?? (data.isValid ? 'valid' : 'expired'));
      setLastVerified(data.checkedAt ?? null);
      if (data.profile) setProfile(data.profile);
      if (!data.isValid) throw new Error(data.message || 'Sesi MagangHub sudah berakhir. Silakan login kembali.');
      setSuccess(data.message || 'Sesi MagangHub masih aktif.');
      toast.success(data.message || 'Sesi MagangHub masih aktif.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Koneksi bermasalah saat memeriksa sesi.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/account/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error('Gagal memutuskan koneksi.');
      toast.success('Koneksi akun MagangHub berhasil diputuskan.');
      setConfirmDisconnect(false);
      window.location.reload();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Gagal memutuskan koneksi.';
      setError(message);
      toast.error(message);
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
      {/* Kolom Kiri: Status Koneksi & Data Profil MagangHub */}
      <section className="card space-y-5 border-slate-200/90 bg-white p-6 shadow-sm" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-xs ${
                status === 'valid'
                  ? 'bg-emerald-100 text-emerald-700'
                  : status === 'expired'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {status === 'valid' ? (
                <ShieldCheck size={24} aria-hidden="true" />
              ) : (
                <ShieldAlert size={24} aria-hidden="true" />
              )}
            </span>
            <div>
              <span className="eyebrow">Status Integrasi</span>
              <h2 className="text-base font-bold text-text-primary tracking-tight">{statusCopy[status].label}</h2>
              <p className="mt-0.5 text-xs text-text-secondary leading-relaxed">{statusCopy[status].detail}</p>
            </div>
          </div>

          <span className={`rounded-full border px-3 py-1 text-xs font-semibold shrink-0 ${statusCopy[status].badge}`}>
            {status === 'valid' ? 'Aktif' : status === 'expired' ? 'Kedaluwarsa' : 'Belum Terhubung'}
          </span>
        </div>

        {lastVerified && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-text-muted">
            Terakhir diverifikasi:{' '}
            <strong className="text-slate-700 font-semibold">
              {new Date(lastVerified).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
            </strong>
          </div>
        )}

        {profile?.full_name && (
          <div className="profile-summary">
            <p>
              <span className="inline-flex items-center gap-1.5">
                <User size={13} /> Peserta
              </span>
              <strong>{profile.full_name}</strong>
            </p>
            {profile.company_name && (
              <p>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={13} /> Instansi Magang
                </span>
                <strong>{profile.company_name}</strong>
              </p>
            )}
            {profile.internship_period && (
              <p>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={13} /> Periode
                </span>
                <strong>{formatInternshipPeriod(profile.internship_period)}</strong>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center pt-2">
          {currentSession && (
            <button
              type="button"
              className="btn-outline flex-1"
              onClick={checkSession}
              disabled={busy}
            >
              <RefreshCw size={15} className={busy ? 'animate-spin' : ''} aria-hidden="true" />
              <span>{busy ? 'Memeriksa sesi…' : 'Periksa Status Sesi'}</span>
            </button>
          )}

          {currentSession && (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 text-xs font-semibold text-red-600 transition hover:bg-red-100/70 hover:text-red-700 active:scale-95 disabled:opacity-50"
            >
              <Unplug size={15} aria-hidden="true" />
              <span>Putuskan Akun</span>
            </button>
          )}
        </div>
      </section>

      {/* Kolom Kanan: Form Hubungkan / Perbarui Kredensial */}
      <form onSubmit={onSubmit} className="card space-y-5 border-slate-200/90 bg-white p-6 shadow-sm" aria-label="Login akun MagangHub">
        <div>
          <span className="eyebrow">Autentikasi Terenkripsi</span>
          <h2 className="mt-1 text-base font-bold text-text-primary tracking-tight">Hubungkan Akun MagangHub</h2>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            Gunakan cookie sesi dari browser Anda (paling stabil) atau login menggunakan email &amp; kata sandi MagangHub.
          </p>
        </div>

        {/* Toggle Metode Login */}
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 transition-colors hover:border-primary/30 hover:bg-white sm:p-4">
          <span className={`flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold transition-colors sm:text-sm ${loginMode === 'cookie' ? 'text-primary' : 'text-slate-500'}`}>
            <Cookie size={16} className="shrink-0" aria-hidden="true" />
            <span>Cookie Sesi</span>
          </span>
          <span className="relative inline-flex shrink-0 items-center">
            <input
              type="checkbox"
              role="switch"
              aria-label="Metode login: Cookie Sesi atau Email dan Kata Sandi"
              aria-checked={loginMode === 'credentials'}
              checked={loginMode === 'credentials'}
              onChange={(event) => {
                if (event.target.checked) {
                  setCookie('');
                  setLoginMode('credentials');
                } else {
                  setPassword('');
                  setLoginMode('cookie');
                }
              }}
              disabled={busy}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-7 w-12 rounded-full bg-slate-300 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-primary/25 peer-disabled:opacity-50"
            />
          </span>
          <span className={`flex min-w-0 flex-1 items-center justify-end gap-2 text-right text-xs font-semibold transition-colors sm:text-sm ${loginMode === 'credentials' ? 'text-primary' : 'text-slate-500'}`}>
            <span>Email &amp; Kata Sandi</span>
            <LogIn size={16} className="shrink-0" aria-hidden="true" />
          </span>
        </label>

        {loginMode === 'cookie' ? (
          <div className="space-y-1.5">
            <label className="label flex items-center gap-1.5 text-xs" htmlFor="maganghub-cookie">
              <KeyRound size={13} className="text-primary" />
              <span>Cookie Akses MagangHub</span>
            </label>
            <textarea
              id="maganghub-cookie"
              className="input min-h-28 resize-y font-mono text-xs"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              required
              maxLength={16_384}
              value={cookie}
              onChange={(event) => setCookie(event.target.value)}
              placeholder="monev-access-token=... atau tempel nilai token JWT sesi"
            />
            <p className="text-[11px] text-text-muted leading-relaxed">
              Cara mengambil <code>access_token</code>:
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-[11px] leading-relaxed text-text-secondary">
              <li>Login ke <code>monev.maganghub.kemnaker.go.id</code> di browser.</li>
              <li>Buka DevTools dengan menekan <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono">F12</kbd>, lalu pilih tab <strong>Network</strong>.</li>
              <li>Refresh halaman MagangHub. Di daftar request, pilih <code>refresh</code>, lalu buka tab <strong>Response</strong>.</li>
              <li>Salin nilai di dalam <code>"access_token": "…"</code> tanpa tanda petik, lalu tempel ke kolom ini.</li>
            </ol>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Token ini rahasia seperti kata sandi. Jangan bagikan token atau screenshot Response. Setelah sesi diverifikasi, token disimpan terenkripsi menggunakan AES-GCM.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label flex items-center gap-1.5 text-xs" htmlFor="maganghub-email">
                <Mail size={13} className="text-primary" />
                <span>Email MagangHub</span>
              </label>
              <input
                id="maganghub-email"
                className="input text-xs"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@email.com"
              />
            </div>
            <div>
              <label className="label flex items-center gap-1.5 text-xs" htmlFor="maganghub-password">
                <KeyRound size={13} className="text-primary" />
                <span>Kata Sandi MagangHub</span>
              </label>
              <input
                id="maganghub-password"
                className="input text-xs"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan kata sandi akun"
              />
            </div>
          </div>
        )}

        {error && <p className="feedback feedback-error" role="alert">{error}</p>}
        {success && <p className="feedback feedback-success" role="status">{success}</p>}

        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full shadow-md shadow-primary/20"
        >
          <LogIn size={16} aria-hidden="true" />
          <span>{busy ? 'Menghubungkan…' : status === 'valid' ? 'Perbarui Sesi MagangHub' : 'Hubungkan Akun'}</span>
        </button>
      </form>

      {/* Custom Next.js Confirmation Dialog (Replaces native browser confirm/alert) */}
      <ConfirmDialog
        open={confirmDisconnect}
        title="Putuskan Akun MagangHub?"
        description="HubReminder akan menghapus cookie sesi terenkripsi dan berhenti memantau jurnal harian akun ini. Anda bisa menghubungkannya kembali kapan saja."
        confirmLabel="Putuskan Akun"
        cancelLabel="Batal"
        variant="danger"
        busy={busy}
        onConfirm={disconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}
