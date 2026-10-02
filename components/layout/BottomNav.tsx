'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock3, History, Settings2 } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Clock3, id: 'nav-dashboard' },
  { href: '/history', label: 'Riwayat', icon: History, id: 'nav-history' },
  { href: '/settings/reminder', label: 'Pengaturan', icon: Settings2, id: 'nav-settings' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-navigation" aria-label="Navigasi utama">
      {NAV_ITEMS.map(({ href, label, icon: Icon, id }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            id={id}
            className={`bottom-nav-tab flex-1 ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={21} strokeWidth={isActive ? 2.3 : 1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
