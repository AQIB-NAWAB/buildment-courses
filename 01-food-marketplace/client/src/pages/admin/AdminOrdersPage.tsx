import { useState } from "react";
import { useAdminOrders } from "../../api/queries";
import { AdminHeader } from "../../components/AdminHeader";
import { OrderStatusBadge } from "../../components/OrderStatusBadge";
import { Pagination } from "../../components/Pagination";
import { ErrorState, Spinner } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/utils";

export function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const ordersQuery = useAdminOrders(page);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminHeader
        title="Orders"
        description="Read-only oversight across vendors. Platform owners do not change fulfilment or vendor data."
      />

      {ordersQuery.isLoading ? <Spinner label="Loading orders" /> : null}
      {ordersQuery.isError ? (
        <div className="mt-6">
          <ErrorState message="Orders could not be loaded." onRetry={() => void ordersQuery.refetch()} />
        </div>
      ) : null}

      {ordersQuery.data ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-cream/70 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {ordersQuery.data.items.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-mono text-xs">{order.id.slice(-10)}</td>
                  <td className="px-4 py-3">{order.store?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p>{order.customer?.displayName}</p>
                    <p className="text-xs text-ink/50">{order.customer?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink/60">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3">{order.itemCount}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(order.totalCents)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={ordersQuery.data.page}
            totalPages={ordersQuery.data.totalPages}
            onPage={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
