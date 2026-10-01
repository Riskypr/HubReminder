// components/dashboard/PermissionPrompt.tsx
// Kartu ajakan aktifkan push notification saat pertama kali pakai
'use client';

import { useState } from 'react';

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
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
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

      if (!res.ok) throw new Error('Gagal menyimpan subscription');
      onSubscribed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-3 text-center">
      <div className="text-3xl" aria-hidden="true">🔔</div>
      <h2 className="text-base font-semibold text-text-primary">
        Aktifkan Notifikasi Push
      </h2>
      <p className="text-sm text-text-secondary">
        Izinkan HubReminder mengirim pengingat laporan harian meski aplikasi ditutup.
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
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

/** Konversi VAPID public key dari base64url ke Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
