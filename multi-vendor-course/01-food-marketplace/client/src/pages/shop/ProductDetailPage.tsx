import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Leaf, Store as StoreIcon } from "lucide-react";
import { useProduct } from "../../api/queries";
import { AddToCartButton } from "../../components/AddToCartButton";
import { ProductImage } from "../../components/ProductImage";
import { EmptyState, ErrorState, Spinner } from "../../components/ui";
import { formatMoney, unitLabel } from "../../lib/utils";

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const productQuery = useProduct(id);
  const [quantity, setQuantity] = useState(1);

  if (productQuery.isLoading) return <Spinner label="Loading product" />;
  if (productQuery.isError || !productQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState message="This product could not be loaded." onRetry={() => void productQuery.refetch()} />
      </div>
    );
  }

  const product = productQuery.data.product;
  if (!product.store) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Product unavailable" body="This product is not attached to a shop." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink/60 hover:text-forest"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to the market
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="aspect-[4/3] w-full rounded-3xl border border-ink/10"
        />

        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink/55">
            <Link
              to={`/?storeId=${product.store.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1 font-semibold hover:bg-ink/10"
            >
              <StoreIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {product.store.name}
            </Link>
            <span className="rounded-full bg-sand px-3 py-1 capitalize">{product.category}</span>
            {product.isPerishable ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-butter/50 px-3 py-1 font-semibold">
                <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
                Perishable
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-4xl">{product.name}</h1>
          <p className="mt-2 text-2xl font-semibold text-forest">
            {formatMoney(product.priceCents)}{" "}
            <span className="text-sm font-normal text-ink/55">{unitLabel(product.unit)}</span>
          </p>
          {product.description ? (
            <p className="mt-4 text-sm leading-6 text-ink/70">{product.description}</p>
          ) : null}

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-ink/10 bg-white p-3">
              <dt className="text-xs uppercase tracking-wide text-ink/50">Available</dt>
              <dd className="mt-1 font-semibold">
                {product.availableQty} {product.unit}
              </dd>
            </div>
            <div className="rounded-xl border border-ink/10 bg-white p-3">
              <dt className="text-xs uppercase tracking-wide text-ink/50">Pack size</dt>
              <dd className="mt-1 font-semibold">
                {product.weightOrQuantity ? `${product.weightOrQuantity} ${product.unit}` : "Sold as listed"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <label htmlFor="quantity" className="block text-sm font-semibold">
                  Quantity
                </label>
                <div className="mt-2 inline-flex items-center rounded-lg border border-ink/20">
                  <button
                    type="button"
                    className="min-h-11 min-w-11 text-lg font-semibold text-ink hover:bg-ink/5"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    id="quantity"
                    type="number"
                    min={1}
                    max={product.availableQty}
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(
                        Math.min(product.availableQty, Math.max(1, Number(event.target.value) || 1))
                      )
                    }
                    className="h-11 w-16 border-x border-ink/20 text-center text-sm"
                  />
                  <button
                    type="button"
                    className="min-h-11 min-w-11 text-lg font-semibold text-ink hover:bg-ink/5"
                    onClick={() =>
                      setQuantity((value) => Math.min(product.availableQty, value + 1))
                    }
                    disabled={quantity >= product.availableQty}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex-1 sm:flex-none">
                <AddToCartButton
                  productId={product.id}
                  storeId={product.store.id}
                  productName={product.name}
                  quantity={quantity}
                />
              </div>
            </div>
            {product.availableQty === 0 ? (
              <p className="mt-3 text-sm font-medium text-red-700">
                Out of stock — check back after the vendor restocks.
              </p>
            ) : (
              <p className="mt-3 text-xs text-ink/50">
                Stock is reserved when you start checkout and confirmed when payment succeeds.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
