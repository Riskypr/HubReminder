import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTodayStatus, getLatestStatusCheck, getTodayNotificationSummary } from '@/lib/services/historyService';
import { getSessionStatus, getDecryptedSessionCookie } from '@/lib/services/accountService';
import { getReminderSettings } from '@/lib/services/reminderSettingsService';
import { getUserProfile } from '@/lib/services/profileService';
import { checkAndUpdateAttendance } from '@/lib/services/maganghubService';
import { DEFAULT_TIMEZONE } from '@/lib/utils/time';
import StatusCard from '@/components/dashboard/StatusCard';
import ProfileCard from '@/components/dashboard/ProfileCard';
import SessionExpiredBanner from '@/components/dashboard/SessionExpiredBanner';
import PermissionPromptWrapper from '@/components/dashboard/PermissionPromptWrapper';
import type { AttendanceStatus } from '@/lib/types/attendance';
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

  // Ambil profil terlebih dahulu untuk mendapatkan timezone user
  const userProfile = await getUserProfile(user.id, supabase);
  const tz = userProfile?.timezone || DEFAULT_TIMEZONE;

  // Eksekusi query lanjutan secara paralel
  const [initialTodayCheck, latestCheck, sessionInfo, reminderSettings, notifSummary] =
    await Promise.all([
      getTodayStatus(user.id, supabase, tz),
      getLatestStatusCheck(user.id, supabase),
      getSessionStatus(user.id, supabase),
      getReminderSettings(user.id, supabase),
      getTodayNotificationSummary(user.id, supabase, tz),
    ]);

  const isSessionExpired = sessionInfo?.status === 'expired';
  const isNotConnected = !sessionInfo;

  let todayCheck = initialTodayCheck;

  // Jika akun terhubung, sesi aktif, tapi belum ada check status hari ini:
  // Lakukan pengecekan otomatis saat membuka dashboard
  if (!isNotConnected && !isSessionExpired && !todayCheck) {
    try {
      const rawCookie = await getDecryptedSessionCookie(user.id, supabase);
      if (rawCookie) {
        const checkResult = await checkAndUpdateAttendance(user.id, rawCookie, supabase);
        if (checkResult.success && checkResult.status !== 'unknown') {
          todayCheck = {
            id: 'auto-today',
            user_id: user.id,
            status: checkResult.status,
            detected_via: checkResult.detectedVia,
            checked_at: checkResult.checkedAt,
          };
        }
      }
    } catch (e) {
      console.error('[dashboard] Auto attendance check on mount failed:', e);
    }
  }

  // Tentukan status yang akurat
  let status: AttendanceStatus = todayCheck?.status ?? 'unknown';
  if (isSessionExpired) {
    status = 'session_expired';
  }

  const effectiveCheckedAt = todayCheck?.checked_at ?? latestCheck?.checked_at ?? null;

  return (
    <div className="space-y-4">
      {/* Banner sesi expired */}
      {isSessionExpired && <SessionExpiredBanner />}

      {/* Profil MagangHub hasil sinkronisasi Backend Proxy */}
      {!isNotConnected && (
        <ProfileCard profile={userProfile} isConnected={!isNotConnected} />
      )}

      {/* Status card utama */}
      <StatusCard
        status={status}
        lastCheckedAt={effectiveCheckedAt}
        sentToday={notifSummary.sentToday}
        maxPerDay={reminderSettings.max_reminders_per_day}
        allowManualCheck={!isNotConnected}
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
