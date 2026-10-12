// app/(dashboard)/settings/reminder/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getReminderSettings } from '@/lib/services/reminderSettingsService';
import ReminderSettingsForm from '@/components/settings/ReminderSettingsForm';
import SettingsTabs from '@/components/settings/SettingsTabs';
import { isReminderAdmin } from '@/lib/services/systemReminderSettingsService';
import { BellRing, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Pengaturan Reminder — HubReminder',
  description: 'Atur jumlah maksimum, interval, dan waktu reminder laporan harian.',
};

export const dynamic = 'force-dynamic';

export default async function ReminderSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const settings = await getReminderSettings(user.id, supabase);
  const isAdmin = isReminderAdmin(user.email);

  return (
    <div className="space-y-6">
      <SettingsTabs />

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0759d8,#0344b8)] text-white shadow-md shadow-primary/20">
            <BellRing size={24} aria-hidden="true" />
          </span>
          <div>
            <span className="eyebrow flex items-center gap-1">
              <Sparkles size={11} />
              Konfigurasi Notifikasi
            </span>
            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
              Pengaturan Jadwal Reminder
            </h1>
            <p className="text-xs text-text-secondary">
              Sesuaikan jam pengingat harian, frekuensi maksimal, dan jeda waktu antar notifikasi pribadi.
            </p>
          </div>
        </div>
      </div>

      <ReminderSettingsForm initialSettings={settings} />

      {isAdmin && (
        <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-white p-4.5 sm:flex-row sm:items-center sm:justify-between sm:p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-indigo-950 sm:text-sm">
                Pengaturan Sistem &amp; Bot WhatsApp Admin
              </h3>
              <p className="text-[11px] text-indigo-700/80 sm:text-xs">
                Pengaturan global admin kini dipisahkan ke menu khusus agar tampilan pengaturan akun tetap clean dan fokus.
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95"
          >
            <span>Buka Panel Admin</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
