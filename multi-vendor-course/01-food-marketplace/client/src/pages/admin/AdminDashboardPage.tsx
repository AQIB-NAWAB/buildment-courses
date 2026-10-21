import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Package,
  ShoppingBag,
  Store as StoreIcon,
  Users,
  Wallet
} from "lucide-react";
import { useAdminMetrics } from "../../api/queries";
import { AdminHeader } from "../../components/AdminHeader";
import { SkeletonCard } from "../../components/Skeleton";
import { ErrorState } from "../../components/ui";
import { formatMoney } from "../../lib/utils";

export function AdminDashboardPage() {
  const metricsQuery = useAdminMetrics();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminHeader
        title="Marketplace health"
        description="A narrow oversight surface: metrics, moderation, read-only orders, and coupon policy. Platform owners cannot edit vendor content or impersonate users."
      />

      {metricsQuery.isError ? (
        <div className="mt-6">
          <ErrorState message="Metrics could not be loaded." onRetry={() => void metricsQuery.refetch()} />
        </div>
      ) : null}

      {metricsQuery.isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {metricsQuery.data ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Paid GMV",
                value: formatMoney(metricsQuery.data.metrics.gmvCents),
                detail: `${metricsQuery.data.metrics.orders} total orders`,
                icon: Wallet
              },
              {
                label: "Active stores",
                value: metricsQuery.data.metrics.activeStores,
                detail: `${metricsQuery.data.metrics.stores} stores total`,
                icon: StoreIcon
              },
              {
                label: "Products",
                value: metricsQuery.data.metrics.products,
                detail: `${metricsQuery.data.metrics.lowStock} low stock`,
                icon: Package
              },
              {
                label: "Orders to pack",
                value: metricsQuery.data.metrics.pendingOrders,
                detail: "Across all vendors",
                icon: ShoppingBag
              },
              {
                label: "Users",
                value: metricsQuery.data.metrics.users,
                detail: `${metricsQuery.data.metrics.vendors} vendors · ${metricsQuery.data.metrics.customers} customers`,
                icon: Users
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

          {metricsQuery.data.metrics.reconciliation > 0 ? (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  {metricsQuery.data.metrics.reconciliation} paid checkout
                  {metricsQuery.data.metrics.reconciliation === 1 ? "" : "s"} need reconciliation
                </p>
                <p className="mt-1">
                  A payment succeeded after its reservation was released. The system refuses to
                  create orders without stock; review the Stripe test payment and resolve manually.
                </p>
              </div>
            </div>
          ) : null}

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                to: "/admin/stores",
                title: "Moderate stores",
                body: "Suspend a shop so its products disappear from the catalogue."
              },
              {
                to: "/admin/products",
                title: "Moderate products",
                body: "Suspend one listing without editing a vendor's content."
              },
              {
                to: "/admin/coupons",
                title: "Coupons",
                body: "Create platform or store codes and use the kill switch."
              }
            ].map((card) => (
              <Link key={card.to} to={card.to} className="surface p-5 transition hover:border-leaf/40">
                <h2 className="text-xl">{card.title}</h2>
                <p className="mt-2 text-sm text-ink/60">{card.body}</p>
              </Link>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
