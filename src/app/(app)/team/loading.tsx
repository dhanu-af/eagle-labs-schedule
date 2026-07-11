import { SkeletonPageHeader, SkeletonTable } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable rows={9} />
    </div>
  );
}
