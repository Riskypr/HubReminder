// app/(dashboard)/settings/account/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getSessionStatus } from '@/lib/services/accountService';
import { getUserProfile } from '@/lib/services/profileService';
import ConnectAccountForm from '@/components/settings/ConnectAccountForm';
import SettingsTabs from '@/components/settings/SettingsTabs';

export const metadata = {
  title: 'Hubungkan Akun — HubReminder',
  description: 'Hubungkan akun MagangHub agar HubReminder dapat memantau status laporan kamu.',
};

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [sessionInfo, userProfile] = await Promise.all([
    getSessionStatus(user.id, supabase),
    getUserProfile(user.id, supabase),
  ]);

  return (
    <div className="space-y-4">
      <SettingsTabs />
      <h1 className="text-xl font-semibold text-text-primary">Akun MagangHub</h1>
      <ConnectAccountForm currentSession={sessionInfo} currentProfile={userProfile} />
    </div>
  );
}
