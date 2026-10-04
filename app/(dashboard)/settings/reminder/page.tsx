// app/(dashboard)/settings/reminder/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getReminderSettings } from '@/lib/services/reminderSettingsService';
import ReminderSettingsForm from '@/components/settings/ReminderSettingsForm';
import SettingsTabs from '@/components/settings/SettingsTabs';
import { BellRing, Sparkles } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <SettingsTabs />

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-[#7C3AED] text-white shadow-md shadow-primary/20">
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
              Sesuaikan jam pengingat harian, frekuensi maksimal, dan jeda waktu antar notifikasi.
            </p>
          </div>
        </div>
      </div>

      <ReminderSettingsForm initialSettings={settings} />
    </div>
  );
}
