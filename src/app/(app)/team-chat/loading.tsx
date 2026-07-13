import { SkeletonBlock, SkeletonPageHeader } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonBlock className="h-[60vh] w-full" />
    </div>
  );
}
