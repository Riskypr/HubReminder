// components/history/HistoryTimeline.tsx
'use client';

import type { AttendanceCheck } from '@/lib/types/attendance';
import type { NotificationLog } from '@/lib/types/reminder';
import { Circle, CircleCheck, CircleHelp, TriangleAlert } from 'lucide-react';

interface HistoryTimelineProps {
  checks: AttendanceCheck[];
  logs: NotificationLog[];
}

const STATUS_LABEL: Record<string, { icon: typeof Circle; label: string; badgeClass: string }> = {
  belum_lapor:     { icon: Circle, label: 'Belum Lapor',       badgeClass: 'badge-pending' },
  selesai:         { icon: CircleCheck, label: 'Sudah Lapor',       badgeClass: 'badge-done' },
  unknown:         { icon: CircleHelp, label: 'Tidak Diketahui',   badgeClass: 'badge-unknown' },
  session_expired: { icon: TriangleAlert, label: 'Sesi Kedaluwarsa', badgeClass: 'badge-unknown' },
};

export default function HistoryTimeline({ checks, logs }: HistoryTimelineProps) {
  if (checks.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-text-muted text-sm">Belum ada riwayat pengecekan.</p>
      </div>
    );
  }

  // Kelompokkan log notifikasi per hari
  const logsByDay: Record<string, NotificationLog[]> = {};
  for (const log of logs) {
    const day = log.sent_at.slice(0, 10);
    if (!logsByDay[day]) logsByDay[day] = [];
    logsByDay[day].push(log);
  }

  // Dedupe check per hari — tampilkan status terbaru tiap hari
  const checksByDay: Record<string, AttendanceCheck> = {};
  for (const check of checks) {
    const day = check.checked_at.slice(0, 10);
    if (!checksByDay[day]) checksByDay[day] = check;
  }

  const days = Object.keys(checksByDay).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const check = checksByDay[day];
        const dayLogs = logsByDay[day] ?? [];
        const cfg = STATUS_LABEL[check.status] ?? STATUS_LABEL.unknown;

        return (
          <div key={day} className="card space-y-2">
            {/* Tanggal + badge status */}
            <div className="flex items-center justify-between">
              <time dateTime={day} className="text-sm font-semibold text-text-primary">
                {formatDate(day)}
              </time>
              <span className={cfg.badgeClass}>
                <cfg.icon size={14} aria-hidden="true" /> {cfg.label}
              </span>
            </div>

            {/* Log notifikasi hari itu */}
            {dayLogs.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border">
                <p className="text-xs font-medium text-text-muted">
                  {dayLogs.length} notifikasi terkirim
                </p>
                {dayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-xs text-text-secondary"
                  >
                    <span>Reminder ke-{log.sequence_today}</span>
                    <span>{formatTime(log.sent_at)}</span>
                  </div>
                ))}
              </div>
            )}
            {dayLogs.length === 0 && check.status === 'selesai' && (
              <p className="text-xs text-status-done">Tidak perlu reminder — sudah lapor! ✓</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
}
