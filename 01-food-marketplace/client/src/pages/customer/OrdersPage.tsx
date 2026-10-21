import { Link } from "react-router-dom";
import { useMyOrders } from "../../api/queries";
import { PageHeader } from "../../components/PageHeader";
import { OrderStatusBadge } from "../../components/OrderStatusBadge";
import { EmptyState, ErrorState, Spinner } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/utils";

export function OrdersPage() {
  const ordersQuery = useMyOrders();

  if (ordersQuery.isLoading) return <Spinner label="Loading orders" />;
  if (ordersQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <ErrorState message="Your orders could not be loaded." onRetry={() => void ordersQuery.refetch()} />
      </div>
    );
  }

  const orders = ordersQuery.data?.orders ?? [];
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Your orders"
        description="Every checkout is split by vendor. Prices and product names are snapshots from the moment you paid."
      />

      {orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No orders yet"
            body="Your first checkout will create one receipt per vendor."
            action={
              <Link to="/" className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white">
                Shop the market
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl">{order.store?.name ?? "Vendor order"}</h2>
                  <p className="mt-1 text-xs text-ink/55">
                    {formatDate(order.createdAt)} · {order.items.length} lines ·{" "}
                    {order.paymentStatus}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-sm font-semibold">{formatMoney(order.totalCents)}</span>
                </div>
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/65">
                {order.items.map((item) => (
                  <li key={`${order.id}-${item.productId}`}>
                    {item.quantity} × {item.name}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
                <span className="text-xs text-ink/50">Order {order.id}</span>
                <Link
                  to={`/orders/${order.id}`}
                  className="text-sm font-semibold text-leaf hover:text-forest"
                >
                  View order details
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
