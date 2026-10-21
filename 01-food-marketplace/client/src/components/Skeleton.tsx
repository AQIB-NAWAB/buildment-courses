import { cn } from "../lib/utils";

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("h-4 animate-pulse rounded bg-ink/10", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="surface space-y-3 p-5">
      <SkeletonLine className="w-1/3" />
      <SkeletonLine className="w-2/3" />
      <SkeletonLine className="w-1/2" />
    </div>
  );
}
