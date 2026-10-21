import { Link } from "react-router-dom";
import { Leaf } from "lucide-react";
import type { Product } from "../api/types";
import { formatMoney, unitLabel } from "../lib/utils";
import { AddToCartButton } from "./AddToCartButton";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/products/${product.id}`} className="block aspect-[4/3] overflow-hidden">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full transition duration-300 group-hover:scale-[1.03]"
        />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              to={`/products/${product.id}`}
              className="font-display text-lg font-semibold leading-tight text-ink hover:text-forest"
            >
              {product.name}
            </Link>
            <p className="mt-1 text-xs text-ink/55">{product.store?.name ?? "Local vendor"}</p>
          </div>
          {product.isPerishable ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-butter/50 px-2 py-1 text-[11px] font-semibold text-ink/70"
              title="Perishable"
            >
              <Leaf className="h-3 w-3" aria-hidden="true" />
              Fresh
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-semibold text-forest">{formatMoney(product.priceCents)}</p>
            <p className="text-xs text-ink/55">{unitLabel(product.unit)}</p>
          </div>
          <p className="text-xs text-ink/55">
            {product.availableQty > 0 ? `${product.availableQty} available` : "Out of stock"}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <AddToCartButton
            productId={product.id}
            storeId={product.store?.id ?? ""}
            productName={product.name}
            compact
          />
        </div>
      </div>
    </article>
  );
}
