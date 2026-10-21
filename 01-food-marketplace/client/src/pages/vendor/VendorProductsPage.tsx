import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { queryKeys, useVendorProducts } from "../../api/queries";
import { VendorHeader } from "../../components/VendorHeader";
import { ProductImage } from "../../components/ProductImage";
import { EmptyState, ErrorState, Spinner } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { formatMoney, unitLabel } from "../../lib/utils";

export function VendorProductsPage() {
  const productsQuery = useVendorProducts();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api.patch(`/products/${id}`, { isPublished }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendorProducts });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      notify(variables.isPublished ? "Product published" : "Product moved to draft", "success");
    },
    onError: (error: unknown) =>
      notify(error instanceof ApiError ? error.message : "Could not update the product", "error")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendorProducts });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      notify("Product deleted", "success");
    },
    onError: (error: unknown) =>
      notify(error instanceof ApiError ? error.message : "Could not delete the product", "error")
  });

  function remove(id: string, name: string) {
    if (window.confirm(`Delete “${name}”? Past orders keep their snapshots.`)) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <VendorHeader
        title="Products"
        description="Drafts stay private. Published, active products with stock appear in the public catalogue."
        actions={
          <Link
            to="/vendor/products/new"
            className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white hover:bg-forest"
          >
            Add product
          </Link>
        }
      />

      {productsQuery.isLoading ? <Spinner label="Loading products" /> : null}
      {productsQuery.isError ? (
        <div className="mt-6">
          <ErrorState message="Products could not be loaded." onRetry={() => void productsQuery.refetch()} />
        </div>
      ) : null}
      {productsQuery.data && productsQuery.data.products.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Your shelves are empty"
            body="Add your first grocery product. You can save it as a draft and publish when ready."
            action={
              <Link
                to="/vendor/products/new"
                className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white"
              >
                Add a product
              </Link>
            }
          />
        </div>
      ) : null}

      {productsQuery.data && productsQuery.data.products.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-cream/70 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {productsQuery.data.products.map((product) => (
                <tr key={product.id} className="align-middle">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-12 w-12 rounded-lg"
                      />
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-xs text-ink/50">
                          {product.category} · {product.unit}
                          {product.isPerishable ? " · perishable" : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(product.priceCents)}
                    <span className="block text-xs text-ink/45">{unitLabel(product.unit)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={product.availableQty <= 5 ? "font-semibold text-terracotta" : ""}>
                      {product.availableQty}
                    </span>
                    <span className="block text-xs text-ink/45">
                      {product.reservedQty ? `${product.reservedQty} reserved` : "available"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          product.isPublished
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-ink/5 text-ink/60"
                        }`}
                      >
                        {product.isPublished ? "Published" : "Draft"}
                      </span>
                      {!product.isActive ? (
                        <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                          Suspended by platform
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold hover:border-leaf/40"
                        onClick={() =>
                          publishMutation.mutate({
                            id: product.id,
                            isPublished: !product.isPublished
                          })
                        }
                        disabled={publishMutation.isPending || !product.isActive}
                      >
                        {product.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <Link
                        to={`/vendor/products/${product.id}/edit`}
                        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-ink/60 hover:bg-ink/5 hover:text-ink"
                        aria-label={`Edit ${product.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-ink/50 hover:bg-red-50 hover:text-red-700"
                        onClick={() => remove(product.id, product.name)}
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
