import { Link } from "react-router-dom";
import { AlertTriangle, Package, ShoppingBag, Wallet } from "lucide-react";
import { useVendorOrders, useVendorProducts } from "../../api/queries";
import { VendorHeader } from "../../components/VendorHeader";
import { OrderStatusBadge } from "../../components/OrderStatusBadge";
import { SkeletonCard } from "../../components/Skeleton";
import { ErrorState } from "../../components/ui";
import { formatDate, formatMoney } from "../../lib/utils";

export function VendorDashboardPage() {
  const productsQuery = useVendorProducts();
  const ordersQuery = useVendorOrders();

  const products = productsQuery.data?.products ?? [];
  const orders = ordersQuery.data?.orders ?? [];
  const published = products.filter((product) => product.isPublished && product.isActive).length;
  const lowStock = products.filter((product) => product.availableQty <= 5).length;
  const pending = orders.filter((order) => order.status === "pending").length;
  const revenueCents = orders
    .filter((order) => order.paymentStatus === "paid")
    .reduce((sum, order) => sum + order.totalCents, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <VendorHeader
        title="Shop overview"
        description="Your inventory, incoming orders, and paid revenue in one place."
        actions={
          <Link
            to="/vendor/products/new"
            className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white hover:bg-forest"
          >
            Add product
          </Link>
        }
      />

      {productsQuery.isError || ordersQuery.isError ? (
        <div className="mt-6">
          <ErrorState message="The vendor dashboard could not be loaded." />
        </div>
      ) : productsQuery.isLoading || ordersQuery.isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Products",
                value: products.length,
                detail: `${published} published`,
                icon: Package
              },
              {
                label: "Low stock",
                value: lowStock,
                detail: "5 or fewer available",
                icon: AlertTriangle
              },
              {
                label: "Orders to pack",
                value: pending,
                detail: `${orders.length} total orders`,
                icon: ShoppingBag
              },
              {
                label: "Paid revenue",
                value: formatMoney(revenueCents),
                detail: "Snapshot totals",
                icon: Wallet
              }
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="surface p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                      {stat.label}
                    </p>
                    <Icon className="h-4 w-4 text-leaf" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold">{stat.value}</p>
                  <p className="mt-1 text-xs text-ink/55">{stat.detail}</p>
                </div>
              );
            })}
          </div>

          <section className="mt-8" aria-labelledby="recent-orders">
            <div className="flex items-center justify-between">
              <h2 id="recent-orders" className="text-2xl">
                Recent orders
              </h2>
              <Link to="/vendor/orders" className="text-sm font-semibold text-leaf hover:text-forest">
                View all
              </Link>
            </div>
            {orders.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-ink/20 bg-white/60 p-6 text-sm text-ink/60">
                No orders yet. Publish products so customers can find your shop.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-cream/70 text-xs uppercase tracking-wide text-ink/50">
                    <tr>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Placed</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {orders.slice(0, 5).map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-3 font-medium">{order.id.slice(-8)}</td>
                        <td className="px-4 py-3">{order.customer?.displayName ?? "Customer"}</td>
                        <td className="px-4 py-3 text-ink/60">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-3 font-semibold">{formatMoney(order.totalCents)}</td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
