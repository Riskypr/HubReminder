// components/dashboard/PermissionPrompt.tsx
// Kartu ajakan aktifkan push notification saat pertama kali pakai
'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';
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

      // Validasi VAPID Public Key
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

      // Konversi VAPID key secara aman
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
      toast.success('Notifikasi push berhasil diaktifkan.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengaktifkan notifikasi';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-3 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true"><BellRing size={24} /></div>
      <h2 className="text-base font-semibold text-text-primary">
        Aktifkan Notifikasi Push
      </h2>
      <p className="text-sm text-text-secondary">
        Izinkan HubReminder mengirim pengingat laporan harian meski aplikasi ditutup.
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-left">
          {error}
        </p>
      )}
      <button
        id="btn-enable-notifications"
        onClick={handleEnable}
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? 'Memproses...' : 'Aktifkan Notifikasi'}
      </button>
    </div>
  );
}

/**
 * Konversi VAPID public key dari base64url ke Uint8Array secara aman
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const clean = base64String.trim().replace(/['"]/g, '');
  if (!clean) {
    throw new Error('VAPID Public Key kosong.');
  }

  // Tambahkan padding base64 jika diperlukan
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
