import { SkeletonBlock, SkeletonPageHeader } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <SkeletonBlock className="h-64 w-full" />
        </div>
        <div className="space-y-3">
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-32 w-full" />
          <SkeletonBlock className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
