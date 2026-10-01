// components/settings/ConnectAccountForm.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MagangHubSession } from '@/lib/types/session';

const schema = z.object({
  cookie: z
    .string()
    .min(20, 'Cookie terlalu pendek — pastikan kamu menyalin keseluruhan nilai cookie sesi')
    .max(4000, 'Cookie terlalu panjang'),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  currentSession: Pick<MagangHubSession, 'status' | 'last_verified_at'> | null;
}

const SESSION_STATUS_CONFIG = {
  valid:       { label: 'Terhubung', badgeClass: 'badge-done',    icon: '🟢' },
  expired:     { label: 'Kedaluwarsa', badgeClass: 'badge-unknown', icon: '⚠️' },
  unverified:  { label: 'Belum Diverifikasi', badgeClass: 'badge-unknown', icon: '⚪' },
};

export default function ConnectAccountForm({ currentSession }: Props) {
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitResult(null);
    const res = await fetch('/api/account/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: values.cookie }),
    });
    if (res.ok) {
      setSubmitResult('success');
      reset();
    } else {
      const body = await res.json().catch(() => ({}));
      setErrorMsg(body.error ?? 'Gagal menghubungkan akun');
      setSubmitResult('error');
    }
  }

  async function handleDisconnect() {
    if (!confirm('Putuskan koneksi akun MagangHub? Pemantauan akan berhenti.')) return;
    setDisconnecting(true);
    const res = await fetch('/api/account/disconnect', { method: 'POST' });
    if (res.ok) window.location.reload();
    else setDisconnecting(false);
  }

  const cfg = currentSession ? SESSION_STATUS_CONFIG[currentSession.status] : null;

  return (
    <div className="space-y-4">
      {/* Status koneksi saat ini */}
      {cfg && (
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">Status Koneksi</p>
            {currentSession?.last_verified_at && (
              <p className="text-xs text-text-muted mt-0.5">
                Terverifikasi: {new Date(currentSession.last_verified_at).toLocaleString('id-ID')}
              </p>
            )}
          </div>
          <span className={cfg.badgeClass} role="img" aria-label={cfg.label}>
            <span aria-hidden="true">{cfg.icon}</span> {cfg.label}
          </span>
        </div>
      )}

      {/* Panduan cara ambil cookie */}
      <details className="card cursor-pointer" id="guide-cookie">
        <summary className="text-sm font-semibold text-text-primary list-none flex justify-between items-center">
          <span>📖 Cara mengambil Cookie Sesi</span>
          <span className="text-text-muted text-xs">Tap untuk lihat panduan</span>
        </summary>
        <ol className="mt-3 space-y-2 text-sm text-text-secondary list-decimal list-inside leading-relaxed">
          <li>Buka <strong>monev.maganghub.kemnaker.go.id/dashboard</strong> di Chrome/browser kamu</li>
          <li>Login dengan akun MagangHub kamu</li>
          <li>Tekan <kbd className="bg-app-bg border border-border rounded px-1.5 py-0.5 text-xs font-mono">F12</kbd> untuk buka DevTools</li>
          <li>Pilih tab <strong>Application</strong> → <strong>Cookies</strong> → pilih domain maganghub</li>
          <li>Temukan cookie bernama <code className="bg-app-bg rounded px-1 text-xs font-mono">session</code> atau yang serupa</li>
          <li>Salin seluruh nilai (kolom <strong>Value</strong>) dan paste di form di bawah</li>
        </ol>
        <p className="mt-2 text-xs text-text-muted">
          ℹ️ Aplikasi hanya menggunakan cookie untuk membaca status laporan — tidak menyimpan username/password kamu.
        </p>
      </details>

      {/* Form input cookie */}
      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4" aria-label="Form hubungkan akun MagangHub">
        <div>
          <label htmlFor="cookie-input" className="label">
            Nilai Cookie Sesi MagangHub
          </label>
          <textarea
            id="cookie-input"
            rows={4}
            className="input resize-none font-mono text-xs"
            placeholder="Paste nilai cookie sesi di sini..."
            {...register('cookie')}
          />
          {errors.cookie && (
            <p className="text-xs text-red-600 mt-1">{errors.cookie.message}</p>
          )}
        </div>

        {submitResult === 'success' && (
          <p role="status" className="text-sm text-status-done font-medium">
            ✓ Akun berhasil dihubungkan! Sistem akan mulai memantau status laporan kamu.
          </p>
        )}
        {submitResult === 'error' && (
          <p role="alert" className="text-sm text-red-600">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          id="btn-connect-submit"
          disabled={isSubmitting}
          className="btn-primary w-full"
        >
          {isSubmitting ? 'Menghubungkan...' : 'Hubungkan Akun'}
        </button>
      </form>

      {/* Disconnect */}
      {currentSession && (
        <button
          id="btn-disconnect"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="btn-outline w-full text-red-600 border-red-200 hover:bg-red-50"
        >
          {disconnecting ? 'Memutuskan...' : 'Putuskan Koneksi Akun'}
        </button>
      )}
    </div>
  );
}
