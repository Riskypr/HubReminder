// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Google_Sans_Flex } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister';
import ToastProvider from '@/components/providers/ToastProvider';

const googleSansFlex = Google_Sans_Flex({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-google-sans-flex',
});

export const metadata: Metadata = {
  title: 'HubReminder — Pengingat Laporan Harian MagangHub',
  description:
    'Pantau status laporan harian MagangHub Kemnaker dan terima push notification pengingat otomatis.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HubReminder',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2F6FED',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={googleSansFlex.variable}>
      <head />
      <body>
        <ServiceWorkerRegister />
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
