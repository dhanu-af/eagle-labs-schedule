import { SkeletonCard, SkeletonPageHeader, SkeletonStatRow } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatRow count={5} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkeletonCard lines={5} className="lg:col-span-2" />
        <div className="space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      </div>
    </div>
  );
}
