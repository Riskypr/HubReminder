// components/dashboard/StatusCard.tsx
// Badge status utama di atas dashboard — warna + ikon + label teks + tombol cek sekarang
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CircleHelp, CircleCheck, RefreshCw, TriangleAlert, Circle } from 'lucide-react';
import { toast } from 'react-toastify';
import type { AttendanceStatus } from '@/lib/types/attendance';

interface StatusCardProps {
  status: AttendanceStatus;
  lastCheckedAt: string | null; // ISO string
  sentToday: number;
  maxPerDay: number;
  allowManualCheck?: boolean;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { icon: typeof Circle; label: string; badgeClass: string; cardBg: string; desc: string }
> = {
  belum_lapor: {
    icon: Circle,
    label: 'Belum Lapor',
    badgeClass: 'badge-pending',
    cardBg: 'border-l-4 border-l-status-pending',
    desc: 'Laporan hari ini belum diisi. Segera isi di MagangHub.',
  },
  selesai: {
    icon: CircleCheck,
    label: 'Sudah Lapor',
    badgeClass: 'badge-done',
    cardBg: 'border-l-4 border-l-status-done',
    desc: 'Laporan hari ini sudah diisi. Terima kasih!',
  },
  unknown: {
    icon: CircleHelp,
    label: 'Tidak Diketahui',
    badgeClass: 'badge-unknown',
    cardBg: 'border-l-4 border-l-status-unknown',
    desc: 'Belum ada status laporan hari ini. Klik "Cek Status" untuk memeriksa ke MagangHub.',
  },
  session_expired: {
    icon: TriangleAlert,
    label: 'Sesi Kedaluwarsa',
    badgeClass: 'badge-unknown',
    cardBg: 'border-l-4 border-l-warning',
    desc: 'Sesi MagangHub kamu perlu dihubungkan ulang di menu Setting.',
  },
};

export default function StatusCard({
  status,
  lastCheckedAt,
  sentToday,
  maxPerDay,
  allowManualCheck = true,
}: StatusCardProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<AttendanceStatus>(status);
  const [currentLastChecked, setCurrentLastChecked] = useState<string | null>(lastCheckedAt);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Sinkronkan state lokal saat prop dari server berubah
  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  useEffect(() => {
    setCurrentLastChecked(lastCheckedAt);
  }, [lastCheckedAt]);

  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.unknown;

  const lastCheckedLabel = currentLastChecked
    ? formatRelativeTime(currentLastChecked)
    : 'Belum pernah dicek';

  async function handleCheckNow() {
    setChecking(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/attendance/check', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status) {
        setCurrentStatus(data.status);
        if (data.checkedAt) {
          setCurrentLastChecked(data.checkedAt);
        }
        const statusMsg =
          data.status === 'selesai'
            ? '✓ Status: Sudah Lapor'
            : data.status === 'belum_lapor'
            ? '✓ Status: Belum Lapor'
            : '✓ Status diperbarui';
        setFeedback(statusMsg);
        toast.success(statusMsg.replace(/^✓\s*/, ''));
        router.refresh();
      } else {
        setFeedback(data?.error || 'Gagal mengecek status');
        toast.error(data?.error || 'Gagal mengecek status');
      }
    } catch {
      setFeedback('Koneksi terganggu');
      toast.error('Koneksi terganggu saat mengecek status.');
    } finally {
      setChecking(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  return (
    <div
      className={`card ${config.cardBg} space-y-3`}
      role="status"
      aria-live="polite"
      aria-label={`Status laporan: ${config.label}`}
    >
      {/* Badge status besar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-primary shadow-sm">
            <config.icon size={28} strokeWidth={1.8} />
          </span>
          <div>
            <span className={config.badgeClass} role="img" aria-label={config.label}>
              {config.label}
            </span>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              {config.desc}
            </p>
          </div>
        </div>

        {allowManualCheck && currentStatus !== 'session_expired' && (
          <button
            onClick={handleCheckNow}
            disabled={checking}
            id="btn-check-attendance-now"
            className="text-xs text-primary hover:text-primary-dark transition-colors px-2.5 py-1.5 rounded-md hover:bg-blue-50 disabled:opacity-50 shrink-0 font-medium flex items-center gap-1 border border-primary/20"
            title="Cek status terkini langsung ke MagangHub"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{checking ? 'Mengecek...' : 'Cek Status'}</span>
          </button>
        )}
      </div>

      {feedback && (
        <p
          role="status"
          className={`text-xs ${
            feedback.startsWith('✓') ? 'text-status-done font-medium' : 'text-red-500'
          }`}
        >
          {feedback}
        </p>
      )}

      {/* Info terakhir dicek */}
      <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border">
        <span>
          <span className="font-medium">Terakhir dicek:</span> {lastCheckedLabel}
        </span>
        {currentStatus === 'belum_lapor' && (
          <div className="text-right text-status-pending">
            <span className="font-medium">
              {sentToday <= maxPerDay
                ? `${sentToday}/${maxPerDay} reminder terkirim hari ini`
                : `${sentToday} reminder sudah terkirim hari ini`}
            </span>
            {sentToday > maxPerDay && (
              <p className="mt-0.5 text-[11px] text-text-muted">
                Batas sekarang {maxPerDay}; tidak ada reminder tambahan hari ini.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Format ISO string ke relative time sederhana (tanpa import date-fns agar client bundle kecil) */
function formatRelativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}
