import { useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import type { Category, Store } from "../api/types";
import { CATEGORIES, categoryLabel } from "../lib/categories";
import { Button, Input, Select } from "./ui";

export interface ShopFilters {
  search: string;
  category: string;
  storeId: string;
  sort: string;
}

export function FilterBar({
  filters,
  stores,
  onChange
}: {
  filters: ShopFilters;
  stores: Store[];
  onChange(next: ShopFilters): void;
}) {
  const [draft, setDraft] = useState(filters);
  const hasFilters =
    Boolean(filters.search) || Boolean(filters.category) || Boolean(filters.storeId);

  function submit(event: FormEvent) {
    event.preventDefault();
    onChange({ ...draft, sort: filters.sort });
  }

  function clear() {
    const empty = { search: "", category: "", storeId: "", sort: filters.sort };
    setDraft(empty);
    onChange(empty);
  }

  return (
    <form
      onSubmit={submit}
      className="surface grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto]"
      role="search"
      aria-label="Filter the marketplace"
    >
      <label className="sr-only" htmlFor="catalogue-search">
        Search products
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
          aria-hidden="true"
        />
        <Input
          id="catalogue-search"
          value={draft.search}
          onChange={(event) => setDraft({ ...draft, search: event.target.value })}
          placeholder="Search rice, bread, coffee…"
          className="pl-9"
        />
      </div>

      <div>
        <label className="sr-only" htmlFor="category-filter">
          Category
        </label>
        <Select
          id="category-filter"
          value={draft.category}
          onChange={(event) => setDraft({ ...draft, category: event.target.value })}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryLabel(category)}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="sr-only" htmlFor="store-filter">
          Store
        </label>
        <Select
          id="store-filter"
          value={draft.storeId}
          onChange={(event) => setDraft({ ...draft, storeId: event.target.value })}
        >
          <option value="">All stores</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" className="flex-1">
          Filter
        </Button>
        {hasFilters ? (
          <Button type="button" variant="ghost" onClick={clear} aria-label="Clear filters">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </form>
  );
}

// Keep the category type reachable for callers that build filter objects.
export type { Category };
