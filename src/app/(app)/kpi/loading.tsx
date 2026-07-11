import { SkeletonCard, SkeletonPageHeader } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  );
}
