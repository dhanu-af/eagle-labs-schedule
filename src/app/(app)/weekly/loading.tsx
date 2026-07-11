import { SkeletonBlock, SkeletonPageHeader } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-3">
            <SkeletonBlock className="mb-3 h-3 w-12" />
            <SkeletonBlock className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
