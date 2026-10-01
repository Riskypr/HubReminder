// components/layout/Header.tsx
'use client';

import Link from 'next/link';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = 'HubReminder' }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-text-primary">{title}</span>
      </div>
      <Link
        href="https://monev.maganghub.kemnaker.go.id/dashboard"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-primary hover:text-primary-dark transition-colors"
        id="header-open-maganghub"
      >
        Buka MagangHub →
      </Link>
    </header>
  );
}
