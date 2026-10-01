// app/(dashboard)/settings/reminder/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getReminderSettings } from '@/lib/services/reminderSettingsService';
import ReminderSettingsForm from '@/components/settings/ReminderSettingsForm';
import SettingsTabs from '@/components/settings/SettingsTabs';

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
    <div className="space-y-4">
      <SettingsTabs />
      <h1 className="text-xl font-semibold text-text-primary">Pengaturan Reminder</h1>
      <ReminderSettingsForm initialSettings={settings} />
    </div>
  );
}
