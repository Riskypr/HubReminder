// app/(dashboard)/loading.tsx
// Skeleton placeholder untuk transisi halaman instan di dalam layout dashboard

export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Memuat data...">
      {/* Skeleton Status / Header */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-border/60" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-28 bg-border/80 rounded-full" />
            <div className="h-3.5 w-3/4 bg-border/50 rounded" />
          </div>
        </div>
        <div className="pt-2 border-t border-border flex justify-between">
          <div className="h-3 w-28 bg-border/40 rounded" />
          <div className="h-3 w-20 bg-border/40 rounded" />
        </div>
      </div>

      {/* Skeleton Action Button */}
      <div className="h-12 w-full bg-primary/20 rounded-xl" />

      {/* Skeleton Secondary Card */}
      <div className="card space-y-2.5">
        <div className="h-4 w-36 bg-border/70 rounded" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-border/40 rounded" />
          <div className="h-3 w-5/6 bg-border/40 rounded" />
          <div className="h-3 w-2/3 bg-border/40 rounded" />
        </div>
      </div>
    </div>
  );
}
