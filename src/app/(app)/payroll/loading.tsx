import { SkeletonCard, SkeletonPageHeader } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonCard lines={1} />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
    </div>
  );
}
