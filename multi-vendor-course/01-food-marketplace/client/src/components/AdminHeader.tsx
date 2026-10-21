import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";
import { WorkspaceTabs } from "./WorkspaceTabs";

export function AdminHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Platform owner · course extension" title={title} description={description} actions={actions} />
      <WorkspaceTabs
        items={[
          { to: "/admin", label: "Overview", end: true },
          { to: "/admin/stores", label: "Stores" },
          { to: "/admin/products", label: "Products" },
          { to: "/admin/orders", label: "Orders" },
          { to: "/admin/users", label: "Users" },
          { to: "/admin/coupons", label: "Coupons" }
        ]}
      />
    </div>
  );
}
