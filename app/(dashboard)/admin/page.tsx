// app/(dashboard)/admin/page.tsx
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { getSystemReminderSettings, isReminderAdmin } from '@/lib/services/systemReminderSettingsService';
import AdminReminderSettingsForm from '@/components/settings/AdminReminderSettingsForm';
import { ShieldCheck, Sparkles, Info, Mail } from 'lucide-react';

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
      {/* Header Banner Admin - Solid clean card dengan Brand Gradient pada icon badge */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0759d8,#0344b8)] text-white shadow-md shadow-primary/20">
            <ShieldCheck size={24} aria-hidden="true" />
          </span>
          <div>
            <span className="eyebrow flex items-center gap-1">
              <Sparkles size={11} />
              Administrator Control Center
            </span>
            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
              Kontrol Sistem &amp; Bot WhatsApp
            </h1>
            <p className="text-xs text-text-secondary">
              Pusat kendali operasional bot laporan WhatsApp, scheduler reminder bersama, kuota Foonte, dan warning sesi.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5">
          <Mail size={15} className="text-primary" aria-hidden="true" />
          <div>
            <span className="block text-[10px] font-medium text-text-muted">Akun Administrator</span>
            <strong className="block text-xs font-semibold text-text-primary">{user.email}</strong>
          </div>
        </div>
      </div>

      {/* Info Callout - Solid card */}
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
