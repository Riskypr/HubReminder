// app/(dashboard)/admin/page.tsx
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { getSystemReminderSettings, isReminderAdmin } from '@/lib/services/systemReminderSettingsService';
import AdminReminderSettingsForm from '@/components/settings/AdminReminderSettingsForm';
import { ShieldCheck, Sparkles, Bot, Info, Mail } from 'lucide-react';

export const metadata = {
  title: 'Panel Admin & Kontrol Sistem — HubReminder',
  description: 'Pengaturan global sistem reminder, Bot WhatsApp, cron scheduler, dan kuota provider.',
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isAdmin = isReminderAdmin(user.email);
  if (!isAdmin) {
    redirect('/');
  }

  const adminSettings = await getSystemReminderSettings(createAdminClient()).catch(() => null);

  if (!adminSettings) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
        <p className="font-semibold">Gagal memuat konfigurasi sistem reminder admin.</p>
        <p className="mt-1 text-xs">Pastikan tabel system_reminder_settings telah dimigrasi dengan benar di database.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner Khusus Admin */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200/90 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-primary text-white shadow-lg shadow-indigo-500/30">
              <ShieldCheck size={28} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-3 py-0.5 text-[11px] font-semibold text-indigo-200">
                <Sparkles size={11} aria-hidden="true" />
                Administrator Control Center
              </span>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
                Kontrol Sistem &amp; Bot WhatsApp
              </h1>
              <p className="mt-1 text-xs text-slate-300/90 sm:text-sm">
                Pusat kendali operasional bot laporan WhatsApp, scheduler reminder bersama, kuota Foonte, dan warning sesi.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2 backdrop-blur-md">
            <Mail size={14} className="text-indigo-300" aria-hidden="true" />
            <div className="text-left">
              <span className="block text-[10px] text-slate-400 font-medium">Akun Administrator</span>
              <strong className="block text-xs font-semibold text-white">{user.email}</strong>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      {/* Info Callout */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-xs backdrop-blur-md">
        <Info size={18} className="shrink-0 text-slate-500" aria-hidden="true" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Menu ini dipisahkan dari pengaturan pribadi agar antarmuka pengguna tetap bersih. Setiap perubahan di panel ini berlaku secara <strong>global</strong> untuk seluruh anggota grup dan scheduler sistem.
        </p>
      </div>

      {/* Form Pengaturan Admin */}
      <AdminReminderSettingsForm initialSettings={adminSettings} />
    </div>
  );
}
