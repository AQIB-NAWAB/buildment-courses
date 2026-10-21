import { useMyStore } from "../api/queries";
import { PageHeader } from "./PageHeader";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { SkeletonLine } from "./Skeleton";

export function VendorHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const storeQuery = useMyStore();
  const store = storeQuery.data?.store;
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={store ? `${store.name}${store.isActive === false ? " · suspended" : ""}` : "Vendor workspace"}
        title={title}
        description={description}
        actions={actions}
      />
      <WorkspaceTabs
        items={[
          { to: "/vendor", label: "Overview", end: true },
          { to: "/vendor/products", label: "Products" },
          { to: "/vendor/orders", label: "Orders" },
          { to: "/vendor/settings", label: "Shop settings" }
        ]}
      />
      {storeQuery.isLoading ? <SkeletonLine className="w-48" /> : null}
    </div>
  );
}
