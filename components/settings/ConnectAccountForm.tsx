// components/settings/ConnectAccountForm.tsx
// Manajemen Cookie MagangHub: Cek Validitas, Tambah / Perbarui Cookie Baru
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MagangHubSession, Profile, SessionStatus } from '@/lib/types/session';

const schema = z.object({
  cookie: z
    .string()
    .min(10, 'Cookie terlalu pendek — pastikan kamu menyalin keseluruhan nilai cookie sesi')
    .max(5000, 'Cookie terlalu panjang'),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  currentSession: Pick<MagangHubSession, 'status' | 'last_verified_at'> | null;
  currentProfile?: Profile | null;
}

const SESSION_STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; badgeClass: string; icon: string; desc: string }
> = {
  valid: {
    label: 'Aktif & Terhubung',
    badgeClass: 'badge-done',
    icon: '🟢',
    desc: 'Cookie masih berlaku. Sistem dapat memantau status laporan kamu secara berkala.',
  },
  expired: {
    label: 'Kedaluwarsa',
    badgeClass: 'badge-unknown border-l-4 border-l-warning',
    icon: '⚠️',
    desc: 'Sesi login telah habis. Masukkan cookie baru di bawah agar reminder tetap aktif.',
  },
  unverified: {
    label: 'Belum Diverifikasi',
    badgeClass: 'badge-unknown',
    icon: '⚪',
    desc: 'Cookie belum diverifikasi ke server MagangHub.',
  },
};

export default function ConnectAccountForm({ currentSession, currentProfile }: Props) {
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);

  // State untuk Cek Masa Berlaku Cookie
  const [isCheckingCookie, setIsCheckingCookie] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    isValid: boolean;
    message: string;
    checkedAt?: string;
  } | null>(null);

  const [activeSession, setActiveSession] = useState<Pick<MagangHubSession, 'status' | 'last_verified_at'> | null>(
    currentSession
  );
  const [activeProfile, setActiveProfile] = useState<Profile | null>(currentProfile ?? null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const watchedCookie = watch('cookie');

  // 1. Fungsi Cek Cookie Langsung ke Server MagangHub
  async function handleCheckCookie() {
    setIsCheckingCookie(true);
    setCheckResult(null);

    try {
      const res = await fetch('/api/account/check-cookie', { method: 'POST' });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        setCheckResult({
          isValid: data.isValid,
          message: data.message || (data.isValid ? 'Cookie masih aktif!' : 'Cookie telah kedaluwarsa.'),
          checkedAt: data.checkedAt,
        });

        if (data.status) {
          setActiveSession((prev) => ({
            status: data.status,
            last_verified_at: data.checkedAt || prev?.last_verified_at || null,
          }));
        }

        if (data.profile) {
          setActiveProfile(data.profile);
        }
      } else {
        setCheckResult({
          isValid: false,
          message: data?.error || 'Gagal memeriksa status cookie ke server MagangHub.',
        });
      }
    } catch {
      setCheckResult({
        isValid: false,
        message: 'Koneksi terputus saat memeriksa status cookie.',
      });
    } finally {
      setIsCheckingCookie(false);
    }
  }

  // 2. Fungsi Simpan & Verifikasi Cookie Baru
  async function onSubmit(values: FormValues) {
    setSubmitResult(null);
    setErrorMsg('');
    setCheckResult(null);

    try {
      const res = await fetch('/api/account/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: values.cookie }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok && body.success) {
        setSubmitResult('success');
        reset();
        if (body.profile) {
          setActiveProfile(body.profile);
        }
        setActiveSession({
          status: 'valid',
          last_verified_at: new Date().toISOString(),
        });

        setCheckResult({
          isValid: true,
          message: `✓ Cookie berhasil disimpan dan terverifikasi aktif!${body.userName ? ` Terhubung sebagai ${body.userName}.` : ''}`,
          checkedAt: new Date().toISOString(),
        });

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        // Tangani error spesifik dari validasi server
        const errMessage = body.error || 'Gagal menghubungkan akun';
        setErrorMsg(errMessage);
        setSubmitResult('error');

        // Tampilkan hasil cek juga
        if (body.status === 'session_expired') {
          setCheckResult({
            isValid: false,
            message: '⚠️ Cookie yang dimasukkan sudah kedaluwarsa. Silakan login ulang di MagangHub dan salin cookie baru.',
          });
        } else if (body.status === 'invalid') {
          setCheckResult({
            isValid: false,
            message: '❌ Cookie tidak valid atau tidak dapat diverifikasi ke server MagangHub.',
          });
        }
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan saat menyimpan cookie');
      setSubmitResult('error');
    }
  }

  // 3. Putuskan Koneksi Akun
  async function handleDisconnect() {
    if (!confirm('Putuskan koneksi akun MagangHub? Sistem tidak akan lagi dapat memantau status laporan harian kamu.')) {
      return;
    }
    setDisconnecting(true);
    const res = await fetch('/api/account/disconnect', { method: 'POST' });
    if (res.ok) {
      window.location.reload();
    } else {
      setDisconnecting(false);
    }
  }

  const sessionStatus = activeSession?.status || 'unverified';
  const cfg = activeSession ? SESSION_STATUS_CONFIG[sessionStatus] : null;

  return (
    <div className="space-y-4">
      {/* 1. KARTU STATUS COOKIE & AKUN SAAT INI */}
      <div className="card space-y-3 border-l-4 border-l-primary">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Status Cookie & Sesi MagangHub</h2>
            {activeSession?.last_verified_at && (
              <p className="text-xs text-text-muted mt-0.5">
                Terverifikasi:{' '}
                {new Date(activeSession.last_verified_at).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            )}
          </div>

          {cfg && (
            <span className={`${cfg.badgeClass} flex items-center gap-1.5`} role="img" aria-label={cfg.label}>
              <span aria-hidden="true">{cfg.icon}</span> {cfg.label}
            </span>
          )}
        </div>

        {cfg && <p className="text-xs text-text-secondary leading-relaxed">{cfg.desc}</p>}

        {/* Info profil tersinkronisasi jika ada */}
        {activeProfile?.company_name && (
          <div className="pt-2 border-t border-border/70 text-xs text-text-secondary space-y-1 bg-surface-alt/40 p-2.5 rounded-lg">
            <p className="flex justify-between">
              <span className="text-text-muted">Nama Peserta:</span>
              <span className="font-semibold text-text-primary">{activeProfile.full_name}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-text-muted">Instansi Magang:</span>
              <span className="font-semibold text-text-primary">{activeProfile.company_name}</span>
            </p>
            {activeProfile.internship_period && (
              <p className="flex justify-between">
                <span className="text-text-muted">Periode:</span>
                <span className="font-medium text-text-primary">{activeProfile.internship_period}</span>
              </p>
            )}
          </div>
        )}

        {/* Tombol Cek Masa Berlaku Cookie */}
        {activeSession && (
          <div className="pt-2 border-t border-border flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              id="btn-check-cookie-validity"
              onClick={handleCheckCookie}
              disabled={isCheckingCookie}
              className="btn-outline text-xs py-2 px-3 flex items-center gap-1.5 font-medium hover:bg-primary/5 border-primary/30 text-primary w-full sm:w-auto justify-center"
            >
              <span className={`inline-block ${isCheckingCookie ? 'animate-spin' : ''}`}>🔍</span>
              <span>{isCheckingCookie ? 'Sedang Memeriksa ke MagangHub...' : 'Cek Apakah Cookie Sudah Kedaluwarsa'}</span>
            </button>

            {checkResult && (
              <span
                role="status"
                className={`text-xs font-medium ${
                  checkResult.isValid ? 'text-status-done' : 'text-red-500'
                }`}
              >
                {checkResult.message}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. PANDUAN MENGAMBIL COOKIE DARI BROWSER */}
      <details className="card cursor-pointer" id="guide-cookie">
        <summary className="text-sm font-semibold text-text-primary list-none flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            <span>📖</span>
            <span>Cara Mengambil Cookie Sesi Terbaru di Browser</span>
          </span>
          <span className="text-text-muted text-xs">Tap untuk buka</span>
        </summary>
        <ol className="mt-3 space-y-2 text-xs sm:text-sm text-text-secondary list-decimal list-inside leading-relaxed bg-surface-alt/30 p-3 rounded-lg border border-border/50">
          <li>
            Buka situs <strong>monev.maganghub.kemnaker.go.id/dashboard</strong> di browser kamu lalu login.
          </li>
          <li>
            Tekan <kbd className="bg-app-bg border border-border rounded px-1.5 py-0.5 text-xs font-mono">F12</kbd> (atau klik kanan $\rightarrow$ pilih <em>Inspect</em>) untuk membuka DevTools.
          </li>
          <li>
            Pilih tab <strong>Application</strong> (di samping Console/Network) $\rightarrow$ di panel kiri klik <strong>Cookies</strong> $\rightarrow$ pilih domain <code>maganghub.kemnaker.go.id</code> (atau <code>monev.maganghub.kemnaker.go.id</code>).
          </li>
          <li>
            Cari cookie bernama <code className="bg-app-bg rounded px-1 text-xs font-mono font-bold">monev-access-token</code>, <code className="bg-app-bg rounded px-1 text-xs font-mono font-bold">access_token</code>, atau <code className="bg-app-bg rounded px-1 text-xs font-mono font-bold">session</code>. (Bisa juga menyalin nilai token <code>Bearer eyJ...</code> langsung dari tab Network).
          </li>
          <li>
            Klik dua kali pada kolom <strong>Value</strong>, tekan <kbd className="bg-app-bg border border-border rounded px-1 py-0.5 text-xs font-mono">Ctrl+C</kbd> untuk menyalin seluruh nilainya.
          </li>
          <li>
            Tempel (*paste*) pada formulir input di bawah ini, lalu klik <strong>Simpan & Verifikasi Cookie</strong>.
          </li>
        </ol>
      </details>

      {/* 3. FORMULIR INPUT / PEMBARUAN COOKIE BARU */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card space-y-4"
        aria-label="Form input dan perbarui cookie sesi MagangHub"
      >
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="cookie-input" className="label mb-0 font-semibold">
              {activeSession ? 'Masukkan Cookie Baru (Pembaruan)' : 'Input Cookie Sesi MagangHub'}
            </label>
            {watchedCookie && (
              <span className="text-[11px] text-text-muted font-mono">
                {watchedCookie.length} karakter
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mb-2">
            {activeSession
              ? 'Jika cookie sebelumnya sudah kedaluwarsa atau kamu baru saja login ulang di MagangHub, masukkan nilai cookie yang baru di sini:'
              : 'Tempelkan nilai cookie sesi agar HubReminder dapat memantau status absensi secara otomatis:'}
          </p>
          <textarea
            id="cookie-input"
            rows={4}
            className="input resize-none font-mono text-xs"
            placeholder="Paste nilai cookie sesi atau token di sini..."
            {...register('cookie')}
          />
          {errors.cookie && (
            <p className="text-xs text-red-600 mt-1">{errors.cookie.message}</p>
          )}
        </div>

        {submitResult === 'success' && (
          <div role="status" className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-status-done font-medium space-y-0.5">
            <p className="font-bold">✓ Berhasil Disimpan & Diverifikasi!</p>
            <p>Cookie baru aktif dan data profil berhasil disinkronkan. Halaman akan menyegarkan data...</p>
          </div>
        )}

        {submitResult === 'error' && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
            <p className="font-bold">✕ Gagal Menyimpan Cookie</p>
            <p>{errorMsg}</p>
          </div>
        )}

        <button
          type="submit"
          id="btn-connect-submit"
          disabled={isSubmitting}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="animate-spin inline-block">🔄</span>
              <span>Menyimpan & Memverifikasi...</span>
            </>
          ) : activeSession ? (
            'Simpan & Verifikasi Cookie Baru'
          ) : (
            'Hubungkan Akun'
          )}
        </button>
      </form>

      {/* 4. TOMBOL PUTUSKAN KONEKSI (HAPUS SESI) */}
      {activeSession && (
        <div className="pt-2">
          <button
            id="btn-disconnect"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="btn-outline w-full text-xs text-red-600 border-red-200 hover:bg-red-50 py-2.5 transition-colors"
          >
            {disconnecting ? 'Memutuskan...' : 'Putuskan Koneksi & Hapus Cookie Tersimpan'}
          </button>
        </div>
      )}
    </div>
  );
}
