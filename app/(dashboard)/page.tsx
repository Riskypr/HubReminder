// app/(dashboard)/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTodayStatus, getLatestStatusCheck, getTodayNotificationSummary } from '@/lib/services/historyService';
import { getSessionStatus, getDecryptedSession } from '@/lib/services/accountService';
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
import {
  ArrowUpRight,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Hash,
  Link2,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';

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
      const sessionMaterial = await getDecryptedSession(user.id, supabase);
      if (sessionMaterial) {
        const checkResult = await checkAndUpdateAttendance(user.id, sessionMaterial, supabase);
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

  // Greeting format
  const now = new Date();
  const currentHour = now.getHours();
  const greeting =
    currentHour < 11
      ? 'Selamat Pagi'
      : currentHour < 15
      ? 'Selamat Siang'
      : currentHour < 18
      ? 'Selamat Sore'
      : 'Selamat Malam';

  const userDisplayName =
    userProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Peserta';

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  return (
    <div className="space-y-6">
      {/* Top Welcome / Hero Banner for Desktop Grid */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-md sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-2xl" />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow flex items-center gap-1">
                <Sparkles size={12} className="text-primary" />
                Dashboard Pemantauan
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Calendar size={13} className="text-slate-400" />
                {formattedDate}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {greeting}, <span className="bg-[linear-gradient(135deg,#0759d8,#0344b8)] bg-clip-text text-transparent">{userDisplayName}</span>
            </h1>
            <p className="text-xs text-text-secondary sm:text-sm">
              Pantau kepatuhan pengisian laporan harian dan pastikan absensi MagangHub kamu tercatat tepat waktu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs">
              <span className={`h-2 w-2 rounded-full ${isNotConnected ? 'bg-slate-400' : isSessionExpired ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              MagangHub: {isNotConnected ? 'Belum Terhubung' : isSessionExpired ? 'Sesi Expired' : 'Aktif'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs">
              <BellRing size={13} className={reminderSettings.enabled ? 'text-primary' : 'text-slate-400'} />
              Reminder: {reminderSettings.enabled ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>
      </section>

      {/* Main Desktop Bento Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Banner sesi expired */}
        {isSessionExpired && (
          <div className="lg:col-span-12">
            <SessionExpiredBanner />
          </div>
        )}

        {/* Kolom Kiri: Status Utama & CTA */}
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          {/* Status Card */}
          <StatusCard
            status={status}
            lastCheckedAt={effectiveCheckedAt}
            sentToday={notifSummary.sentToday}
            maxPerDay={reminderSettings.max_reminders_per_day}
            allowManualCheck={!isNotConnected}
          />

          {/* Tombol Akses MagangHub CTA */}
          <a
            href="https://monev.maganghub.kemnaker.go.id/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            id="btn-open-maganghub"
            className="group flex w-full items-center justify-between rounded-3xl border border-primary/20 bg-[linear-gradient(135deg,#0759d8,#0344b8)] p-5 text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 active:translate-y-0 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-105">
                <ExternalLink size={22} className="text-white" aria-hidden="true" />
              </span>
              <div className="text-left">
                <strong className="block text-base font-bold tracking-tight">Buka Portal MagangHub Kemnaker</strong>
                <span className="text-xs text-blue-100 font-medium">Isi jurnal aktivitas dan verifikasi kehadiran magangmu</span>
              </div>
            </div>
            <span className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 transition-transform group-hover:translate-x-1">
              <ArrowUpRight size={18} aria-hidden="true" />
            </span>
          </a>

          {/* Ajakan koneksi jika belum terhubung */}
          {isNotConnected && (
            <div className="card flex flex-col items-center justify-center space-y-4 border-dashed border-2 border-slate-300 p-8 text-center bg-slate-50/50">
              <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xs">
                <Link2 size={26} aria-hidden="true" />
              </span>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-text-primary">Hubungkan Akun MagangHub</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Akun MagangHub kamu belum terhubung ke sistem. Hubungkan cookie akun agar HubReminder dapat memantau jurnal harian secara otomatis.
                </p>
              </div>
              <Link href="/settings/account" id="btn-connect-account" className="btn-primary">
                <Link2 size={16} aria-hidden="true" />
                <span>Hubungkan Akun Sekarang</span>
              </Link>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Profil & Ringkasan Pengaturan */}
        <div className="space-y-6 lg:col-span-5 xl:col-span-4">
          {/* Kartu Profil Magang */}
          {!isNotConnected && (
            <ProfileCard profile={userProfile} isConnected={!isNotConnected} />
          )}

          {/* Kartu Ringkasan Pengaturan Reminder */}
          {reminderSettings.enabled && (
            <div className="card space-y-4 border-slate-200/90 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BellRing size={16} aria-hidden="true" />
                  </span>
                  <span>Jadwal Pengingat</span>
                </h2>
                <Link
                  href="/settings/reminder"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark hover:underline"
                >
                  <SlidersHorizontal size={13} aria-hidden="true" />
                  <span>Ubah</span>
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                    <Hash size={13} />
                    Maks. Pengingat
                  </span>
                  <p className="mt-1 text-base font-bold text-text-primary">
                    {reminderSettings.max_reminders_per_day}x <span className="text-xs font-normal text-slate-500">/ hari</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                    <Timer size={13} />
                    Interval Jeda
                  </span>
                  <p className="mt-1 text-base font-bold text-text-primary">
                    {reminderSettings.interval_minutes} <span className="text-xs font-normal text-slate-500">menit</span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                  <Clock3 size={13} />
                  Waktu Pengecekan Terjadwal
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reminderSettings.reminder_times.map((time) => (
                    <span
                      key={time}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700 shadow-2xs"
                    >
                      {time}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Info Bot Card */}
          <div className="card space-y-3 border-slate-200/90 bg-slate-50 p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={16} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-800">Otomatisasi Latar Belakang</h3>
                <p className="text-[11px] text-slate-500">Cron memeriksa status secara berkala</p>
              </div>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Jika laporan harian telah terisi sebelum jadwal reminder, pengingat akan otomatis ditiadakan agar tidak mengganggu aktivitasmu.
            </p>
          </div>
        </div>

        {/* Push Notification Card - Full Width on Bottom of Grid */}
        <div className="lg:col-span-12">
          <PermissionPromptWrapper />
        </div>
      </div>
    </div>
  );
}
