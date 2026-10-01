// app/(dashboard)/page.tsx
// Halaman Dashboard utama — status hari ini

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTodayStatus } from '@/lib/services/historyService';
import { getSessionStatus } from '@/lib/services/accountService';
import { getReminderSettings } from '@/lib/services/reminderSettingsService';
import { getTodayNotificationSummary } from '@/lib/services/historyService';
import StatusCard from '@/components/dashboard/StatusCard';
import SessionExpiredBanner from '@/components/dashboard/SessionExpiredBanner';
import PermissionPromptWrapper from '@/components/dashboard/PermissionPromptWrapper';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard — HubReminder',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Eksekusi query secara parallel dengan single client instance untuk kecepatan maksimal
  const [todayCheck, sessionInfo, reminderSettings, notifSummary] =
    await Promise.all([
      getTodayStatus(user.id, supabase),
      getSessionStatus(user.id, supabase),
      getReminderSettings(user.id, supabase),
      getTodayNotificationSummary(user.id, supabase),
    ]);

  const isSessionExpired = sessionInfo?.status === 'expired';
  const isNotConnected = !sessionInfo;

  // Tentukan status yang akurat
  let status = todayCheck?.status ?? 'unknown';
  if (isSessionExpired) {
    status = 'session_expired';
  }

  return (
    <div className="space-y-4">
      {/* Banner sesi expired */}
      {isSessionExpired && <SessionExpiredBanner />}

      {/* Status card utama */}
      <StatusCard
        status={status}
        lastCheckedAt={todayCheck?.checked_at ?? null}
        sentToday={notifSummary.sentToday}
        maxPerDay={reminderSettings.max_reminders_per_day}
      />

      {/* Tombol buka MagangHub */}
      <a
        href="https://monev.maganghub.kemnaker.go.id/dashboard"
        target="_blank"
        rel="noopener noreferrer"
        id="btn-open-maganghub"
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <span aria-hidden="true">📋</span>
        Buka MagangHub & Isi Laporan
      </a>

      {/* Koneksi akun — tampil jika belum terhubung */}
      {isNotConnected && (
        <div className="card text-center space-y-2">
          <p className="text-sm text-text-secondary">
            Akun MagangHub belum terhubung. Hubungkan dulu agar sistem bisa memantau status laporan kamu.
          </p>
          <Link href="/settings/account" id="btn-connect-account" className="btn-primary inline-block">
            Hubungkan Akun
          </Link>
        </div>
      )}

      {/* Ringkasan setting reminder */}
      {reminderSettings.enabled && (
        <div className="card">
          <h2 className="text-sm font-semibold text-text-primary mb-2">Pengaturan Reminder Aktif</h2>
          <div className="space-y-1 text-xs text-text-secondary">
            <div className="flex justify-between">
              <span>Maks. reminder/hari</span>
              <span className="font-medium text-text-primary">{reminderSettings.max_reminders_per_day}x</span>
            </div>
            <div className="flex justify-between">
              <span>Interval</span>
              <span className="font-medium text-text-primary">setiap {reminderSettings.interval_minutes} menit</span>
            </div>
            <div className="flex justify-between">
              <span>Jam aktif</span>
              <span className="font-medium text-text-primary">
                {reminderSettings.active_start_time} – {reminderSettings.active_end_time}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Push notification prompt */}
      <PermissionPromptWrapper />
    </div>
  );
}
