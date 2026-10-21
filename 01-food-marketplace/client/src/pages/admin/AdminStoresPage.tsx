import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import { useAdminStores } from "../../api/queries";
import { AdminHeader } from "../../components/AdminHeader";
import { Pagination } from "../../components/Pagination";
import { Button, ErrorState, Input, Spinner } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { formatDate } from "../../lib/utils";

export function AdminStoresPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const storesQuery = useAdminStores(page, search);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const mutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/stores/${id}/status`, { isActive }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["stores"] });
      notify(variables.isActive ? "Store reactivated" : "Store suspended", "success");
    },
    onError: (error: unknown) =>
      notify(error instanceof ApiError ? error.message : "Could not update the store", "error")
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminHeader
        title="Stores"
        description="Suspending a store hides all of its products from the catalogue. Vendors keep their data and can still see their dashboard."
      />

      <div className="mt-6 flex flex-wrap items-end gap-2">
        <div className="w-full max-w-sm">
          <label htmlFor="store-search" className="mb-1 block text-sm font-semibold">
            Search shops
          </label>
          <Input
            id="store-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Shop name…"
          />
        </div>
      </div>

      {storesQuery.isLoading ? <Spinner label="Loading stores" /> : null}
      {storesQuery.isError ? (
        <div className="mt-6">
          <ErrorState message="Stores could not be loaded." onRetry={() => void storesQuery.refetch()} />
        </div>
      ) : null}

      {storesQuery.data ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-cream/70 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {storesQuery.data.items.map((store) => (
                <tr key={store.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{store.name}</p>
                    <p className="text-xs text-ink/50">{store.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{store.owner?.displayName}</p>
                    <p className="text-xs text-ink/50">{store.owner?.email}</p>
                  </td>
                  <td className="px-4 py-3">{store.productCount}</td>
                  <td className="px-4 py-3 text-ink/60">{formatDate(store.createdAt ?? "")}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        store.isActive
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {store.isActive ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant={store.isActive ? "danger" : "secondary"}
                      className="min-h-9 px-3 py-1.5 text-xs"
                      loading={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({ id: store.id, isActive: !store.isActive })
                      }
                    >
                      {store.isActive ? "Suspend" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={storesQuery.data.page}
            totalPages={storesQuery.data.totalPages}
            onPage={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
