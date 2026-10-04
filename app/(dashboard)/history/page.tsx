// app/(dashboard)/history/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAttendanceHistory, getNotificationLogs } from '@/lib/services/historyService';
import HistoryTimeline from '@/components/history/HistoryTimeline';
import { History, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Riwayat — HubReminder',
  description: 'Histori status laporan harian dan notifikasi yang terkirim.',
};

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [checks, logs] = await Promise.all([
    getAttendanceHistory(user.id, 30, supabase),
    getNotificationLogs(user.id, 50, supabase),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-[#7C3AED] text-white shadow-md shadow-primary/20">
            <History size={24} aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow flex items-center gap-1">
                <Sparkles size={11} />
                Aktivitas Akun
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
              Riwayat Pengingat &amp; Kehadiran
            </h1>
            <p className="text-xs text-text-secondary">
              Pantau rekam jejak pengisian laporan dan histori notifikasi pengingat 30 hari terakhir.
            </p>
          </div>
        </div>
      </div>

      {/* Timeline with Stats & Desktop Grid */}
      <HistoryTimeline checks={checks} logs={logs} />
    </div>
  );
}
