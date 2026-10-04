// app/(dashboard)/settings/account/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getSessionStatus } from '@/lib/services/accountService';
import { getUserProfile } from '@/lib/services/profileService';
import ConnectAccountForm from '@/components/settings/ConnectAccountForm';
import SettingsTabs from '@/components/settings/SettingsTabs';
import { ShieldCheck, Sparkles } from 'lucide-react';

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
    <div className="space-y-6">
      <SettingsTabs />

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0759d8,#0344b8)] text-white shadow-md shadow-primary/20">
            <ShieldCheck size={24} aria-hidden="true" />
          </span>
          <div>
            <span className="eyebrow flex items-center gap-1">
              <Sparkles size={11} />
              Integrasi Portal
            </span>
            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
              Akun &amp; Kredensial MagangHub
            </h1>
            <p className="text-xs text-text-secondary">
              Kelola koneksi sesi aman untuk otomatisasi pengecekan absensi laporan magang.
            </p>
          </div>
        </div>
      </div>

      <ConnectAccountForm currentSession={sessionInfo} currentProfile={userProfile} />
    </div>
  );
}
