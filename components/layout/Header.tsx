// components/layout/Header.tsx
'use client';

import Link from 'next/link';
import { ArrowUpRight, Clock3 } from 'lucide-react';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = 'HubReminder' }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-xl flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#7157E8] text-white"><Clock3 size={17} aria-hidden="true" /></span>
        <span className="text-lg font-bold tracking-tight text-text-primary">{title}</span>
      </div>
      <Link
        href="https://monev.maganghub.kemnaker.go.id/dashboard"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10"
        id="header-open-maganghub"
      >
        Buka MagangHub <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </header>
  );
}
