import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import { queryKeys, useVendorOrders } from "../../api/queries";
import type { Order } from "../../api/types";
import { VendorHeader } from "../../components/VendorHeader";
import { OrderStatusBadge } from "../../components/OrderStatusBadge";
import { EmptyState, ErrorState, Spinner } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { formatDate, formatMoney, nextStatus, statusLabel } from "../../lib/utils";

export function VendorOrdersPage() {
  const ordersQuery = useVendorOrders();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [announcement, setAnnouncement] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ order, status }: { order: Order; status: "packed" | "dispatched" }) =>
      api.patch(`/vendor/orders/${order.id}/status`, {
        status,
        currentStatus: order.status
      }),
    onMutate: ({ order }) => setBusyId(order.id),
    onSuccess: (_data, variables) => {
      setAnnouncement(`Order ${variables.order.id} is now ${statusLabel(variables.status)}.`);
      notify(`Order marked ${statusLabel(variables.status)}`, "success");
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendorOrders });
    },
    onError: (error: unknown, variables) => {
      const message =
        error instanceof ApiError ? error.message : "Could not update the order status";
      notify(message, "error");
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.vendorOrders });
      }
      setAnnouncement(`Order ${variables.order.id} was not updated: ${message}`);
    },
    onSettled: () => setBusyId(null)
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <VendorHeader
        title="Orders"
        description="Only your store's orders appear here. Update one stage at a time: order received → packed → dispatched."
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {ordersQuery.isLoading ? <Spinner label="Loading orders" /> : null}
      {ordersQuery.isError ? (
        <div className="mt-6">
          <ErrorState message="Orders could not be loaded." onRetry={() => void ordersQuery.refetch()} />
        </div>
      ) : null}

      {ordersQuery.data && ordersQuery.data.orders.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No orders yet"
            body="When a customer checks out with your products, their order appears here."
          />
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {ordersQuery.data?.orders.map((order) => {
          const action = nextStatus(order.status);
          return (
            <article key={order.id} className="surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl">Order {order.id.slice(-8)}</h2>
                  <p className="mt-1 text-xs text-ink/55">
                    {formatDate(order.createdAt)} · {order.customer?.displayName ?? "Customer"}
                    {order.customer?.email ? ` · ${order.customer.email}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={order.status} />
                  <span className="font-semibold">{formatMoney(order.totalCents)}</span>
                </div>
              </div>

              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {order.items.map((item) => (
                  <li key={`${order.id}-${item.productId}`} className="flex justify-between gap-3 rounded-lg bg-cream/60 px-3 py-2">
                    <span>
                      {item.quantity} × {item.name}{" "}
                      <span className="text-xs text-ink/45">({item.unit})</span>
                    </span>
                    <span>{formatMoney(item.lineTotalCents)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3">
                <p className="text-xs text-ink/50">
                  Prices and names are snapshots. Changing your catalogue will not edit this
                  receipt.
                </p>
                {action ? (
                  <button
                    type="button"
                    className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white hover:bg-forest disabled:opacity-60"
                    disabled={busyId === order.id}
                    onClick={() => mutation.mutate({ order, status: action })}
                  >
                    {busyId === order.id
                      ? "Updating…"
                      : action === "packed"
                        ? "Mark packed"
                        : "Mark dispatched"}
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-leaf">Fulfilment complete</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
