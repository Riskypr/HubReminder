// components/dashboard/StatusCard.tsx
// Badge status utama di atas dashboard — warna + ikon + label teks (aksesibilitas)
'use client';

import type { AttendanceStatus } from '@/lib/types/attendance';

interface StatusCardProps {
  status: AttendanceStatus;
  lastCheckedAt: string | null; // ISO string
  sentToday: number;
  maxPerDay: number;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { icon: string; label: string; badgeClass: string; cardBg: string; desc: string }
> = {
  belum_lapor: {
    icon: '🔵',
    label: 'Belum Lapor',
    badgeClass: 'badge-pending',
    cardBg: 'border-l-4 border-l-status-pending',
    desc: 'Laporan hari ini belum diisi. Segera isi di MagangHub.',
  },
  selesai: {
    icon: '🟢',
    label: 'Sudah Lapor',
    badgeClass: 'badge-done',
    cardBg: 'border-l-4 border-l-status-done',
    desc: 'Laporan hari ini sudah diisi. Terima kasih!',
  },
  unknown: {
    icon: '⚪',
    label: 'Tidak Diketahui',
    badgeClass: 'badge-unknown',
    cardBg: 'border-l-4 border-l-status-unknown',
    desc: 'Status tidak dapat ditentukan saat ini.',
  },
  session_expired: {
    icon: '⚠️',
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
}: StatusCardProps) {
  const config = STATUS_CONFIG[status];

  const lastCheckedLabel = lastCheckedAt
    ? formatRelativeTime(lastCheckedAt)
    : 'Belum pernah dicek';

  return (
    <div
      className={`card ${config.cardBg} space-y-3`}
      role="status"
      aria-live="polite"
      aria-label={`Status laporan: ${config.label}`}
    >
      {/* Badge status besar */}
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-4xl leading-none">
          {config.icon}
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

      {/* Info terakhir dicek */}
      <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border">
        <span>
          <span className="font-medium">Terakhir dicek:</span> {lastCheckedLabel}
        </span>
        {status === 'belum_lapor' && (
          <span className="font-medium text-status-pending">
            {sentToday}/{maxPerDay} reminder terkirim
          </span>
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
