// components/history/HistoryTimeline.tsx
'use client';

import type { AttendanceCheck } from '@/lib/types/attendance';
import type { NotificationLog } from '@/lib/types/reminder';
import { dateKeyInTz } from '@/lib/utils/dateKey';
import {
  BellRing,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HelpCircle,
  AlertCircle,
  TriangleAlert,
  Sparkles,
  Inbox,
  TrendingUp,
} from 'lucide-react';

interface HistoryTimelineProps {
  checks: AttendanceCheck[];
  logs: NotificationLog[];
  timezone: string;
}

const STATUS_CONFIG: Record<
  string,
  {
    icon: typeof CheckCircle2;
    label: string;
    badgeClass: string;
    borderColor: string;
    iconBg: string;
  }
> = {
  belum_lapor: {
    icon: AlertCircle,
    label: 'Belum Lapor',
    badgeClass: 'badge-pending',
    borderColor: 'border-blue-200/80 hover:border-blue-300',
    iconBg: 'bg-blue-100 text-blue-600',
  },
  selesai: {
    icon: CheckCircle2,
    label: 'Sudah Lapor',
    badgeClass: 'badge-done',
    borderColor: 'border-emerald-200/80 hover:border-emerald-300',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  unknown: {
    icon: HelpCircle,
    label: 'Tidak Diketahui',
    badgeClass: 'badge-unknown',
    borderColor: 'border-slate-200 hover:border-slate-300',
    iconBg: 'bg-slate-100 text-slate-600',
  },
  session_expired: {
    icon: TriangleAlert,
    label: 'Sesi Kedaluwarsa',
    badgeClass: 'badge-unknown',
    borderColor: 'border-amber-200 hover:border-amber-300',
    iconBg: 'bg-amber-100 text-amber-600',
  },
};

export default function HistoryTimeline({ checks, logs, timezone }: HistoryTimelineProps) {
  if (checks.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center p-12 text-center border-dashed border-2 border-slate-200 bg-white/60">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xs">
          <Inbox size={26} aria-hidden="true" />
        </span>
        <h3 className="text-base font-bold text-text-primary">Belum Ada Riwayat Aktivitas</h3>
        <p className="mt-1 max-w-sm text-xs text-text-secondary leading-relaxed">
          Histori pengecekan status harian dan riwayat pengiriman notifikasi pengingat akan otomatis muncul di sini.
        </p>
      </div>
    );
  }

  // Kelompokkan log notifikasi per hari
  const logsByDay: Record<string, NotificationLog[]> = {};
  for (const log of logs) {
    const day = dateKeyInTz(log.sent_at, timezone);
    if (!logsByDay[day]) logsByDay[day] = [];
    logsByDay[day].push(log);
  }

  // Dedupe check per hari — tampilkan status terbaru tiap hari
  const checksByDay: Record<string, AttendanceCheck> = {};
  for (const check of checks) {
    const day = dateKeyInTz(check.checked_at, timezone);
    if (!checksByDay[day]) checksByDay[day] = check;
  }

  const days = Object.keys(checksByDay).sort((a, b) => b.localeCompare(a));

  // Hitung summary metrics untuk card overview
  const totalDays = days.length;
  const completedDays = days.filter((d) => checksByDay[d].status === 'selesai').length;
  const pendingDays = days.filter((d) => checksByDay[d].status === 'belum_lapor').length;
  const totalNotifs = logs.length;

  return (
    <div className="space-y-6">
      {/* Desktop Metric Overview Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="card p-4 bg-white border-slate-200/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
            <Calendar size={14} className="text-primary" />
            <span>Hari Terpantau</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary">{totalDays}</p>
        </div>

        <div className="card p-4 bg-white border-slate-200/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span>Tepat Waktu</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">{completedDays}</p>
        </div>

        <div className="card p-4 bg-white border-slate-200/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
            <AlertCircle size={14} className="text-blue-500" />
            <span>Perlu Pengingat</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-600">{pendingDays}</p>
        </div>

        <div className="card p-4 bg-white border-slate-200/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
            <BellRing size={14} className="text-[#7C3AED]" />
            <span>Notifikasi Terkirim</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#7C3AED]">{totalNotifs}</p>
        </div>
      </div>

      {/* Grid of Daily History Cards for Desktop */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {days.map((day) => {
          const check = checksByDay[day];
          const dayLogs = logsByDay[day] ?? [];
          const cfg = STATUS_CONFIG[check.status] ?? STATUS_CONFIG.unknown;
          const IconComponent = cfg.icon;

          return (
            <div
              key={day}
              className={`card flex flex-col justify-between overflow-hidden bg-white p-5 shadow-sm transition-all duration-200 ${cfg.borderColor} space-y-4`}
            >
              <div>
                {/* Tanggal & Badge Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <time dateTime={day} className="flex items-center gap-1.5 text-sm font-bold text-text-primary">
                      <CalendarDays size={15} className="text-primary shrink-0" aria-hidden="true" />
                      <span>{formatDate(day)}</span>
                    </time>
                    <p className="text-[11px] text-text-muted">
                      Dicek {formatTime(check.checked_at, timezone)}
                    </p>
                  </div>

                  <span className={cfg.badgeClass}>
                    <IconComponent size={13} aria-hidden="true" />
                    <span>{cfg.label}</span>
                  </span>
                </div>

                {/* Log notifikasi hari itu */}
                {dayLogs.length > 0 ? (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <BellRing size={12} className="text-primary" aria-hidden="true" />
                      <span>{dayLogs.length} notifikasi terkirim:</span>
                    </p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {dayLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs text-text-secondary"
                        >
                          <span className="font-medium text-slate-700">Reminder #{log.sequence_today}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted tabular-nums">
                            <Clock3 size={11} aria-hidden="true" />
                            {formatTime(log.sent_at, timezone)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : check.status === 'selesai' ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50/70 border border-emerald-100 px-3 py-2 text-xs font-medium text-emerald-700">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span>Laporan beres tepat waktu tanpa perlu reminder!</span>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-500">
                    <span>Tidak ada catatan notifikasi pada tanggal ini.</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}
