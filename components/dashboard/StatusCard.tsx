// components/dashboard/StatusCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, CheckCircle2, Clock3, HelpCircle, AlertCircle, RefreshCw, TriangleAlert, Sparkles, Check, ArrowRight } from 'lucide-react';
import { toast } from 'react-toastify';
import type { AttendanceStatus } from '@/lib/types/attendance';

interface StatusCardProps {
  status: AttendanceStatus;
  lastCheckedAt: string | null;
  sentToday: number;
  maxPerDay: number;
  allowManualCheck?: boolean;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    icon: typeof CheckCircle2;
    label: string;
    badgeClass: string;
    cardBorder: string;
    iconBg: string;
    iconColor: string;
    desc: string;
  }
> = {
  belum_lapor: {
    icon: AlertCircle,
    label: 'Belum Lapor',
    badgeClass: 'badge-pending',
    cardBorder: 'border-blue-200/80 hover:border-blue-300',
    iconBg: 'bg-blue-100 text-blue-600 border border-blue-200',
    iconColor: 'text-blue-600',
    desc: 'Laporan harian MagangHub belum tercatat hari ini. Segera buat laporan kegiatanmu.',
  },
  selesai: {
    icon: CheckCircle2,
    label: 'Sudah Lapor',
    badgeClass: 'badge-done',
    cardBorder: 'border-emerald-200/80 hover:border-emerald-300',
    iconBg: 'bg-emerald-100 text-emerald-600 border border-emerald-200',
    iconColor: 'text-emerald-600',
    desc: 'Luar biasa! Laporan harian hari ini sudah selesai diisi dan diverifikasi.',
  },
  unknown: {
    icon: HelpCircle,
    label: 'Status Belum Dicek',
    badgeClass: 'badge-unknown',
    cardBorder: 'border-slate-200 hover:border-slate-300',
    iconBg: 'bg-slate-100 text-slate-600 border border-slate-200',
    iconColor: 'text-slate-600',
    desc: 'Belum ada data status laporan hari ini. Klik "Cek Status" untuk memeriksa ke MagangHub.',
  },
  session_expired: {
    icon: TriangleAlert,
    label: 'Sesi Kedaluwarsa',
    badgeClass: 'badge-unknown',
    cardBorder: 'border-amber-200 hover:border-amber-300',
    iconBg: 'bg-amber-100 text-amber-600 border border-amber-200',
    iconColor: 'text-amber-600',
    desc: 'Sesi akun MagangHub telah berakhir. Perbarui cookie sesi di menu Pengaturan.',
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

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  useEffect(() => {
    setCurrentLastChecked(lastCheckedAt);
  }, [lastCheckedAt]);

  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.unknown;
  const IconComponent = config.icon;

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
            ? 'Status: Sudah Lapor'
            : data.status === 'belum_lapor'
            ? 'Status: Belum Lapor'
            : 'Status diperbarui';
        setFeedback(`✓ ${statusMsg}`);
        toast.success(statusMsg);
        router.refresh();
      } else {
        const errorMsg = data?.error || 'Gagal mengecek status';
        setFeedback(errorMsg);
        toast.error(errorMsg);
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
      className={`card relative overflow-hidden ${config.cardBorder} space-y-5`}
      role="status"
      aria-live="polite"
      aria-label={`Status laporan: ${config.label}`}
    >
      {/* Decorative background circle */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/40 blur-xl" />

      {/* Header & Status Display */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${config.iconBg}`}>
            {currentStatus === 'belum_lapor' && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600" />
              </span>
            )}
            <IconComponent size={30} strokeWidth={2} aria-hidden="true" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={config.badgeClass} role="img" aria-label={config.label}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {config.label}
              </span>
              {currentStatus === 'selesai' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <Sparkles size={13} aria-hidden="true" /> Aman Hari Ini
                </span>
              )}
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-text-primary">
              {currentStatus === 'selesai'
                ? 'Laporan Harian Selesai'
                : currentStatus === 'belum_lapor'
                ? 'Belum Mengisi Laporan'
                : config.label}
            </h2>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed max-w-xl">
              {config.desc}
            </p>
          </div>
        </div>

        {allowManualCheck && currentStatus !== 'session_expired' && (
          <button
            onClick={handleCheckNow}
            disabled={checking}
            id="btn-check-attendance-now"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-2.5 text-xs font-semibold text-text-primary shadow-xs transition-all hover:bg-white hover:border-primary/40 hover:text-primary hover:shadow active:scale-95 disabled:opacity-60 shrink-0 self-start"
            title="Cek status terkini langsung ke MagangHub"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin text-primary' : 'text-slate-400'} aria-hidden="true" />
            <span>{checking ? 'Mengecek...' : 'Cek Status Sekarang'}</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
            feedback.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.startsWith('✓') ? <Check size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
          <span>{feedback}</span>
        </div>
      )}

      {/* Meta Footer Grid */}
      <div className="grid grid-cols-1 gap-2 border-t border-slate-200/70 pt-3.5 text-xs text-text-muted sm:grid-cols-2 sm:items-center">
        <div className="inline-flex items-center gap-2">
          <Clock3 size={15} className="text-slate-400" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-slate-700">Terakhir dicek:</strong> {lastCheckedLabel}
          </span>
        </div>

        {(currentStatus === 'belum_lapor' || currentStatus === 'selesai') && (
          <div className={`inline-flex items-center gap-2 sm:justify-end font-medium ${
            currentStatus === 'selesai' && sentToday === 0 ? 'text-emerald-700' : 'text-blue-700'
          }`}>
            {currentStatus === 'selesai' && sentToday === 0 ? (
              <CheckCircle2 size={15} className="text-emerald-500" aria-hidden="true" />
            ) : (
              <BellRing size={15} className="text-blue-500" aria-hidden="true" />
            )}
            <span>
              {currentStatus === 'selesai' && sentToday === 0
                ? 'Tidak ada reminder diperlukan'
                : currentStatus === 'selesai'
                ? `${sentToday} reminder terkirim sebelum laporan selesai`
                : sentToday <= maxPerDay
                ? `${sentToday}/${maxPerDay} reminder terkirim hari ini`
                : `${sentToday} reminder sudah terkirim`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}
