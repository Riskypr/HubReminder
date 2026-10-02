'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import { LogIn, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import type { MagangHubSession, Profile, SessionStatus } from '@/lib/types/session';
import { formatInternshipPeriod } from '@/lib/utils/time';

interface Props {
  currentSession: Pick<MagangHubSession, 'status' | 'last_verified_at'> | null;
  currentProfile?: Profile | null;
}

const statusCopy: Record<SessionStatus, { label: string; detail: string }> = {
  valid: { label: 'Akun terhubung', detail: 'Sesi aktif dan dapat digunakan untuk sinkronisasi otomatis.' },
  expired: { label: 'Sesi perlu diperbarui', detail: 'Silakan login kembali untuk mengaktifkan sinkronisasi.' },
  unverified: { label: 'Belum diverifikasi', detail: 'Login dengan akun MagangHub untuk mulai menggunakan reminder.' },
};

export default function ConnectAccountForm({ currentSession, currentProfile }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<SessionStatus>(currentSession?.status ?? 'unverified');
  const [lastVerified, setLastVerified] = useState(currentSession?.last_verified_at ?? null);
  const [profile, setProfile] = useState<Profile | null>(currentProfile ?? null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/maganghub/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Login MagangHub gagal.');
      setStatus('valid');
      setLastVerified(new Date().toISOString());
      setProfile(data.profile ?? null);
      setPassword('');
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
      if (!data.isValid) throw new Error(data.message || 'Sesi MagangHub sudah berakhir. Login kembali.');
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
    if (!window.confirm('Putuskan koneksi akun MagangHub?')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/account/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error('Gagal memutuskan koneksi.');
      window.location.reload();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Gagal memutuskan koneksi.';
      setError(message);
      toast.error(message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card account-status-card space-y-4" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Koneksi MagangHub</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-text-primary"><ShieldCheck size={19} className="text-primary" aria-hidden="true" />{statusCopy[status].label}</h2>
            <p className="mt-1 text-sm text-text-secondary">{statusCopy[status].detail}</p>
          </div>
          <span className={`session-pill ${status === 'valid' ? 'is-valid' : ''}`}>{status === 'valid' ? 'Aktif' : 'Perlu login'}</span>
        </div>
        {lastVerified && <p className="text-xs text-text-muted">Diverifikasi {new Date(lastVerified).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        {profile?.full_name && (
          <div className="profile-summary">
            <p><span>Peserta</span><strong>{profile.full_name}</strong></p>
            {profile.company_name && <p><span>Instansi</span><strong>{profile.company_name}</strong></p>}
            {profile.internship_period && <p><span>Periode</span><strong>{formatInternshipPeriod(profile.internship_period)}</strong></p>}
          </div>
        )}
        {currentSession && <button type="button" className="btn-outline inline-flex w-full items-center justify-center gap-2 sm:w-auto" onClick={checkSession} disabled={busy}><RefreshCw size={15} className={busy ? 'animate-spin' : ''} aria-hidden="true" />{busy ? 'Memeriksa sesi…' : 'Periksa sesi'}</button>}
      </section>

      <form onSubmit={onSubmit} className="card account-login-card space-y-4" aria-label="Login akun MagangHub">
        <div>
          <p className="eyebrow">Login aman</p>
          <h2 className="mt-1 text-lg font-bold text-text-primary">Hubungkan akun MagangHub</h2>
          <p className="mt-1 text-sm text-text-secondary">Kredensial dikirim ke server untuk mendapatkan sesi. Kata sandi tidak disimpan.</p>
        </div>
        <div>
          <label className="label" htmlFor="maganghub-email">Email MagangHub</label>
          <input id="maganghub-email" className="input" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" />
        </div>
        <div>
          <label className="label" htmlFor="maganghub-password">Kata sandi MagangHub</label>
          <input id="maganghub-password" className="input" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi" />
        </div>
        {error && <p className="feedback feedback-error" role="alert">{error}</p>}
        {success && <p className="feedback feedback-success" role="status">{success}</p>}
        <button type="submit" disabled={busy} className="btn-primary inline-flex w-full items-center justify-center gap-2 bg-gradient-to-r from-primary to-[#7157E8] shadow-md shadow-primary/15 hover:brightness-105"><LogIn size={16} aria-hidden="true" />{busy ? 'Menghubungkan…' : status === 'valid' ? 'Perbarui sesi MagangHub' : 'Hubungkan akun'}</button>
      </form>

      {currentSession && <button type="button" onClick={disconnect} disabled={busy} className="btn-outline inline-flex w-full items-center justify-center gap-2 border-red-200 text-red-600 hover:bg-red-50"><Unplug size={15} aria-hidden="true" />Putuskan koneksi akun</button>}
    </div>
  );
}
