// app/(dashboard)/layout.tsx
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import { createClient } from '@/lib/supabase/server';
import { isReminderAdmin } from '@/lib/services/systemReminderSettingsService';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = isReminderAdmin(user?.email);

  return (
    <div className="flex flex-col min-h-dvh bg-slate-50/50">
      <Header isAdmin={isAdmin} />
      <main className="flex-1 px-4 py-6 pb-28 mx-auto w-full max-w-7xl sm:px-6 sm:py-8 sm:pb-32 lg:ml-64 lg:mr-0 lg:w-[calc(100%-16rem)] lg:max-w-none lg:px-8 lg:py-8 lg:pb-16">
        {children}
      </main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
