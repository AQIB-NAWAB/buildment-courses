import { useSearchParams } from "react-router-dom";
import { useProducts, useStores } from "../../api/queries";
import { FilterBar, type ShopFilters } from "../../components/FilterBar";
import { Pagination } from "../../components/Pagination";
import { ProductCard } from "../../components/ProductCard";
import { EmptyState, ErrorState, Select, Spinner } from "../../components/ui";

export function ShopPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? "1") || 1;
  const filters: ShopFilters = {
    search: params.get("search") ?? "",
    category: params.get("category") ?? "",
    storeId: params.get("storeId") ?? "",
    sort: params.get("sort") ?? "newest"
  };
  const productsQuery = useProducts({
    page,
    limit: 12,
    search: filters.search || undefined,
    category: filters.category || undefined,
    storeId: filters.storeId || undefined,
    sort: filters.sort
  });
  const storesQuery = useStores();

  function updateFilters(next: ShopFilters) {
    const updated = new URLSearchParams(params);
    const mapping: Record<string, string> = {
      search: next.search,
      category: next.category,
      storeId: next.storeId,
      sort: next.sort
    };
    for (const [key, value] of Object.entries(mapping)) {
      if (value) updated.set(key, value);
      else updated.delete(key);
    }
    updated.delete("page");
    setParams(updated);
  }

  function setPage(next: number) {
    const updated = new URLSearchParams(params);
    updated.set("page", String(next));
    setParams(updated);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-ink/10 bg-forest px-6 py-10 text-cream sm:px-10 sm:py-14">
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-butter">
            The neighbourhood market
          </p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
            Everything on your list, from every shop on the street.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-cream/80">
            Fill one basket with produce, bread, and pantry staples. FreshMarket splits checkout
            into one order per vendor, with prices frozen at the moment you pay.
          </p>
        </div>
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-butter/20 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 right-20 h-72 w-72 rounded-full bg-terracotta/30 blur-3xl"
        />
      </section>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl">Shop the market</h2>
          <p className="mt-1 text-sm text-ink/60" aria-live="polite">
            {productsQuery.data
              ? `${productsQuery.data.total} products across ${storesQuery.data?.stores.length ?? 0} shops`
              : "Loading the shelves…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm text-ink/65">
            Sort
          </label>
          <Select
            id="sort"
            value={filters.sort}
            onChange={(event) => updateFilters({ ...filters, sort: event.target.value })}
            className="w-44"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name">Name</option>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        <FilterBar
          key={`${filters.search}|${filters.category}|${filters.storeId}`}
          filters={filters}
          stores={storesQuery.data?.stores ?? []}
          onChange={updateFilters}
        />
      </div>

      <div className="mt-6">
        {productsQuery.isLoading ? (
          <Spinner label="Loading products" />
        ) : productsQuery.isError ? (
          <ErrorState
            message="The catalogue could not be loaded."
            onRetry={() => void productsQuery.refetch()}
          />
        ) : productsQuery.data && productsQuery.data.items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {productsQuery.data.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <Pagination
              page={productsQuery.data.page}
              totalPages={productsQuery.data.totalPages}
              onPage={setPage}
            />
          </>
        ) : (
          <EmptyState
            title="No products match those filters"
            body="Try clearing the search or choosing a different shop."
          />
        )}
      </div>
    </div>
  );
}
