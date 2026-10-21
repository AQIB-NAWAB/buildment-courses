import { Link, useLocation } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import type { Order } from "../../api/types";
import { EmptyState } from "../../components/ui";
import { OrderStatusBadge } from "../../components/OrderStatusBadge";
import { formatMoney } from "../../lib/utils";

export function ConfirmationPage() {
  const location = useLocation();
  const orders = (location.state as { orders?: Order[] } | null)?.orders ?? [];

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title="No checkout receipt to show"
          body="Open your orders to see paid purchases and their split vendor receipts."
          action={
            <Link to="/orders" className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white">
              View my orders
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-leaf/10 text-leaf">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-4xl">Payment complete</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-ink/65">
          One payment was split into {orders.length} vendor order{orders.length === 1 ? "" : "s"}.
          Each shop sees only its own lines, with the prices frozen at purchase.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {orders.map((order) => (
          <section key={order.id} className="surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl">{order.store?.name ?? "Vendor order"}</h2>
                <p className="text-xs text-ink/55">Order {order.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <OrderStatusBadge status={order.status} />
                <span className="text-sm font-semibold">{formatMoney(order.totalCents)}</span>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {order.items.map((item) => (
                <li key={`${order.id}-${item.productId}`} className="flex justify-between gap-3">
                  <span className="text-ink/70">
                    {item.quantity} × {item.name} <span className="text-ink/45">({item.unit})</span>
                  </span>
                  <span>{formatMoney(item.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-ink/10 pt-3 text-sm">
              <span className="text-ink/55">
                Paid with {order.stripePaymentIntentId.slice(0, 14)}…
              </span>
              <Link to={`/orders/${order.id}`} className="font-semibold text-leaf hover:text-forest">
                View receipt
              </Link>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link to="/orders" className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white">
          All orders
        </Link>
        <Link
          to="/"
          className="rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink"
        >
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
