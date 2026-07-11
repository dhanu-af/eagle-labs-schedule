export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-4">
          <SkeletonBlock className="mb-3 h-9 w-9 rounded-xl" />
          <SkeletonBlock className="mb-2 h-6 w-16" />
          <SkeletonBlock className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>
      <SkeletonBlock className="mb-4 h-4 w-40" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3.5 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border bg-surface-muted/40 p-3">
        <SkeletonBlock className="h-3 w-full max-w-[420px]" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <SkeletonBlock className="h-7 w-7 shrink-0 rounded-full" />
            <SkeletonBlock className="h-3.5 flex-1" />
            <SkeletonBlock className="h-3.5 w-16" />
            <SkeletonBlock className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <SkeletonBlock className="mb-2 h-6 w-48" />
        <SkeletonBlock className="h-3.5 w-64" />
      </div>
      <SkeletonBlock className="h-9 w-32 rounded-lg" />
    </div>
  );
}
