'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Clock3, History, Settings2, LogOut, ExternalLink, Sparkles, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'react-toastify';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Clock3, id: 'nav-dashboard' },
  { href: '/history', label: 'Riwayat', icon: History, id: 'nav-history' },
  { href: '/settings/reminder', label: 'Pengaturan', icon: Settings2, id: 'nav-settings' },
];

export default function BottomNav() {
  const pathname = usePathname();
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
      <nav className="bottom-navigation" aria-label="Navigasi utama">
        {/* Desktop Brand Header */}
        <div className="mb-6 hidden w-full px-2 lg:block">
          <Link href="/" className="flex items-center gap-3" aria-label="HubReminder, ke Dashboard">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0759d8,#0344b8)] text-white shadow-lg shadow-primary/25">
              <Clock3 size={22} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <strong className="block text-base font-bold tracking-tight text-text-primary">HubReminder</strong>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                <Sparkles size={11} aria-hidden="true" />
                MagangHub Bot
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="flex w-full items-center justify-around lg:flex-col lg:items-stretch lg:gap-1.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon, id }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                id={id}
                className={`bottom-nav-tab group flex-1 lg:flex-initial ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.3 : 1.9} aria-hidden="true" />
                </span>
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Desktop Footer Sidebar Items */}
        <div className="mt-auto hidden w-full space-y-3 pt-6 border-t border-slate-200/80 lg:block">
          <a
            href="https://monev.maganghub.kemnaker.go.id/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-primary"
          >
            <span className="flex items-center gap-2">
              <ExternalLink size={14} className="text-slate-400" aria-hidden="true" />
              Portal MagangHub
            </span>
            <span className="text-[10px] text-slate-400 font-normal">Kemnaker</span>
          </a>

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700"
          >
            <LogOut size={16} aria-hidden="true" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </nav>

      {/* Confirmation modal for Sidebar logout */}
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Keluar dari HubReminder?"
        description="Apakah Anda yakin ingin keluar? Anda harus login kembali untuk melihat dan mengelola pengingat absensi."
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        variant="danger"
        icon="logout"
        busy={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}
