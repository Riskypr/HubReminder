// components/dashboard/PermissionPrompt.tsx
'use client';

import { useState } from 'react';
import { BellRing, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';

interface PermissionPromptProps {
  vapidPublicKey: string;
  onSubscribed?: () => void;
}

export default function PermissionPrompt({
  vapidPublicKey,
  onSubscribed,
}: PermissionPromptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnable() {
    setLoading(true);
    setError(null);

    try {
      if (!('Notification' in window)) {
        throw new Error('Browser ini tidak mendukung notifikasi push.');
      }

      if (!('serviceWorker' in navigator)) {
        throw new Error('Browser ini tidak mendukung Service Worker.');
      }

      const cleanKey = (vapidPublicKey || '').trim().replace(/['"]/g, '');
      if (!cleanKey || cleanKey.startsWith('your-')) {
        throw new Error(
          'Kunci VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY) belum dikonfigurasi di Environment Variables.'
        );
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Izin notifikasi ditolak. Anda dapat mengaktifkannya lewat pengaturan browser.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) {
        throw new Error('PushManager tidak tersedia pada browser ini.');
      }

      const convertedVapidKey = urlBase64ToUint8Array(cleanKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });

      const subJSON = subscription.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: subJSON.keys,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal menyimpan data subscription di server');
      }

      onSubscribed?.();
      toast.success('Notifikasi push berhasil diaktifkan!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengaktifkan notifikasi';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card relative overflow-hidden border-primary/20 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-5 sm:p-6 shadow-sm">
      <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-primary/10 blur-xl" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-[#7C3AED] text-white shadow-md shadow-primary/25" aria-hidden="true">
            <BellRing size={22} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-primary tracking-tight">
                Aktifkan Push Notifikasi
              </h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Direkomendasikan
              </span>
            </div>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed max-w-xl">
              Dapatkan pengingat otomatis langsung di HP/laptop saat belum mengisi absensi harian, bahkan ketika browser sedang ditutup.
            </p>
          </div>
        </div>

        <button
          id="btn-enable-notifications"
          onClick={handleEnable}
          disabled={loading}
          className="btn-primary shrink-0 self-start sm:self-center"
        >
          <BellRing size={16} aria-hidden="true" />
          <span>{loading ? 'Memproses...' : 'Aktifkan Notifikasi'}</span>
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const clean = base64String.trim().replace(/['"]/g, '');
  if (!clean) {
    throw new Error('VAPID Public Key kosong.');
  }

  const padding = '='.repeat((4 - (clean.length % 4)) % 4);
  const base64 = (clean + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  try {
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch {
    throw new Error(
      'Format VAPID Public Key tidak valid. Pastikan NEXT_PUBLIC_VAPID_PUBLIC_KEY adalah string base64url yang sah.'
    );
  }
}
