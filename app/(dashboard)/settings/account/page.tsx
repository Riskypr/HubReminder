// app/(dashboard)/settings/account/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getSessionStatus } from '@/lib/services/accountService';
import ConnectAccountForm from '@/components/settings/ConnectAccountForm';

export const metadata = {
  title: 'Hubungkan Akun — HubReminder',
  description: 'Hubungkan akun MagangHub agar HubReminder dapat memantau status laporan kamu.',
};

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const sessionInfo = await getSessionStatus(user.id, supabase);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Akun MagangHub</h1>
      <ConnectAccountForm currentSession={sessionInfo} />
    </div>
  );
}
