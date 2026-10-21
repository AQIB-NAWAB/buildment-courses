import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import { useAdminProducts } from "../../api/queries";
import { AdminHeader } from "../../components/AdminHeader";
import { Pagination } from "../../components/Pagination";
import { Button, ErrorState, Input, Spinner } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { formatMoney, unitLabel } from "../../lib/utils";

export function AdminProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const productsQuery = useAdminProducts(page, search);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const mutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/products/${id}/status`, { isActive }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor", "products"] });
      notify(variables.isActive ? "Product reactivated" : "Product suspended", "success");
    },
    onError: (error: unknown) =>
      notify(error instanceof ApiError ? error.message : "Could not update the product", "error")
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminHeader
        title="Products"
        description="Platform-level suspension removes a listing from the catalogue without editing vendor content."
      />

      <div className="mt-6 w-full max-w-sm">
        <label htmlFor="product-search" className="mb-1 block text-sm font-semibold">
          Search products
        </label>
        <Input
          id="product-search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Product name…"
        />
      </div>

      {productsQuery.isLoading ? <Spinner label="Loading products" /> : null}
      {productsQuery.isError ? (
        <div className="mt-6">
          <ErrorState message="Products could not be loaded." onRetry={() => void productsQuery.refetch()} />
        </div>
      ) : null}

      {productsQuery.data ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-cream/70 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {productsQuery.data.items.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs capitalize text-ink/50">{product.category}</p>
                  </td>
                  <td className="px-4 py-3">{product.store?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {formatMoney(product.priceCents)}
                    <span className="block text-xs text-ink/45">{unitLabel(product.unit)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {product.availableQty}
                    <span className="block text-xs text-ink/45">
                      {product.reservedQty ? `${product.reservedQty} reserved` : "available"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1 text-xs">
                      <span className="rounded-full bg-ink/5 px-2 py-1 font-semibold">
                        {product.isPublished ? "Published" : "Draft"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 font-semibold ${
                          product.isActive
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {product.isActive ? "Active" : "Suspended"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant={product.isActive ? "danger" : "secondary"}
                      className="min-h-9 px-3 py-1.5 text-xs"
                      loading={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({ id: product.id, isActive: !product.isActive })
                      }
                    >
                      {product.isActive ? "Suspend" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={productsQuery.data.page}
            totalPages={productsQuery.data.totalPages}
            onPage={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
