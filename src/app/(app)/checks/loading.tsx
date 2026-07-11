import { SkeletonPageHeader, SkeletonTable } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonTable rows={6} />
    </div>
  );
}
