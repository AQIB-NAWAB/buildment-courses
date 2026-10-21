import { cn, statusLabel } from "../lib/utils";

const styles: Record<string, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-900",
  packed: "border-sky-300 bg-sky-50 text-sky-900",
  dispatched: "border-emerald-300 bg-emerald-50 text-emerald-900",
  cancelled: "border-red-300 bg-red-50 text-red-900"
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        styles[status] ?? "border-ink/20 bg-ink/5 text-ink/70"
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
