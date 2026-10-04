// components/layout/Header.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Bell, Clock3, ExternalLink, LogOut, ShieldCheck, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'react-toastify';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = 'HubReminder' }: HeaderProps) {
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Berhasil keluar dari akun.');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Gagal keluar dari akun.');
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 shadow-xs backdrop-blur-xl transition-all lg:ml-64 lg:w-[calc(100%-16rem)] lg:px-8 lg:py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0759d8,#0344b8)] text-white shadow-md shadow-primary/20">
            <Clock3 size={20} strokeWidth={2.2} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-text-primary lg:text-lg">{title}</span>
              <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sistem Aktif
              </span>
            </div>
            <p className="hidden text-[11px] text-text-muted sm:block">Pengingat Laporan Harian MagangHub Kemnaker</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="https://monev.maganghub.kemnaker.go.id/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary transition-all duration-150 hover:border-primary/40 hover:bg-primary/10 hover:shadow-xs active:scale-[0.98]"
            id="header-open-maganghub"
          >
            <span>Buka MagangHub</span>
            <ExternalLink size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95"
            title="Keluar dari akun"
            aria-label="Keluar dari akun"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Custom Next.js Confirmation Dialog for Logout */}
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Keluar dari HubReminder?"
        description="Anda harus masuk kembali menggunakan email dan kata sandi untuk mengakses dashboard ini."
        confirmLabel="Ya, Keluar"
        cancelLabel="Tetap di sini"
        variant="danger"
        icon="logout"
        busy={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}
