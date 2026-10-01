// app/(dashboard)/history/page.tsx
// Halaman Riwayat — histori status harian & notifikasi terkirim

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAttendanceHistory, getNotificationLogs } from '@/lib/services/historyService';
import HistoryTimeline from '@/components/history/HistoryTimeline';

export const metadata = {
  title: 'Riwayat — HubReminder',
  description: 'Histori status laporan harian dan notifikasi yang terkirim.',
};

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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Riwayat</h1>
      <HistoryTimeline checks={checks} logs={logs} />
    </div>
  );
}
