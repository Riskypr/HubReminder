// app/(dashboard)/layout.tsx
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <main className="flex-1 px-4 py-5 pb-28 max-w-3xl mx-auto w-full sm:px-6 sm:py-7 sm:pb-32">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
