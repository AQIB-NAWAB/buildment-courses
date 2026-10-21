import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { queryKeys, useCart } from "../../api/queries";
import { EmptyState, ErrorState, Button, Input, Spinner } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { ProductImage } from "../../components/ProductImage";
import { useToast } from "../../context/ToastContext";
import { formatMoney, unitLabel } from "../../lib/utils";

export function CartPage() {
  const cartQuery = useCart();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState("");

  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.patch(`/cart/${id}`, { quantity }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cart }),
    onError: (error: unknown) =>
      notify(error instanceof ApiError ? error.message : "Could not update quantity", "error")
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cart/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      notify("Item removed", "success");
    },
    onError: (error: unknown) =>
      notify(error instanceof ApiError ? error.message : "Could not remove item", "error")
  });

  const couponMutation = useMutation({
    mutationFn: (code: string) => api.post("/cart/coupon", { code }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      notify("Coupon applied", "success");
      setCoupon("");
    },
    onError: (error: unknown) =>
      notify(error instanceof ApiError ? error.message : "Coupon could not be applied", "error")
  });

  const removeCouponMutation = useMutation({
    mutationFn: () => api.delete("/cart/coupon"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      notify("Coupon removed", "success");
    }
  });

  if (cartQuery.isLoading) return <Spinner label="Loading your cart" />;
  if (cartQuery.isError || !cartQuery.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <ErrorState message="Your cart could not be loaded." onRetry={() => void cartQuery.refetch()} />
      </div>
    );
  }

  const cart = cartQuery.data;
  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <PageHeader title="Your cart" description="One basket, every shop." />
        <div className="mt-8">
          <EmptyState
            title="Your cart is empty"
            body="Browse the market and add items from one or more vendors."
            action={
              <Link
                to="/"
                className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white hover:bg-forest"
              >
                Shop the market
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Your cart"
        description={`${cart.items.length} lines from ${cart.pricing.stores.length} vendor${cart.pricing.stores.length === 1 ? "" : "s"}. Checkout will split them into separate orders.`}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
        <div className="space-y-5">
          {cart.pricing.stores.map((store) => (
            <section key={store.storeId} className="surface overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 bg-cream/50 px-4 py-3">
                <div>
                  <h2 className="text-lg">{store.storeName}</h2>
                  <p className="text-xs text-ink/55">Ships as its own vendor order</p>
                </div>
                <p className="text-sm font-semibold">{formatMoney(store.totalCents)}</p>
              </header>
              <ul className="divide-y divide-ink/10">
                {cart.items
                  .filter((item) => item.storeId === store.storeId)
                  .map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-4 p-4">
                      <ProductImage
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="h-16 w-16 rounded-lg"
                      />
                      <div className="min-w-40 flex-1">
                        <Link
                          to={`/products/${item.product.id}`}
                          className="font-semibold text-ink hover:text-forest"
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-xs text-ink/55">
                          {formatMoney(item.product.priceCents)} {unitLabel(item.product.unit)} ·
                          {" "}
                          {item.product.availableQty} available
                        </p>
                        {!item.available ? (
                          <p className="mt-1 text-xs font-medium text-red-700">
                            This line is no longer available. Remove it before checkout.
                          </p>
                        ) : null}
                      </div>
                      <div className="inline-flex items-center rounded-lg border border-ink/20">
                        <button
                          type="button"
                          className="min-h-10 min-w-10 text-lg hover:bg-ink/5 disabled:opacity-40"
                          onClick={() =>
                            updateMutation.mutate({ id: item.id, quantity: item.quantity - 1 })
                          }
                          disabled={item.quantity <= 1 || updateMutation.isPending}
                          aria-label={`Decrease ${item.product.name} quantity`}
                        >
                          <Minus className="mx-auto h-4 w-4" />
                        </button>
                        <span className="min-w-10 border-x border-ink/20 px-2 py-2 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="min-h-10 min-w-10 text-lg hover:bg-ink/5 disabled:opacity-40"
                          onClick={() =>
                            updateMutation.mutate({ id: item.id, quantity: item.quantity + 1 })
                          }
                          disabled={updateMutation.isPending || item.quantity >= item.product.availableQty}
                          aria-label={`Increase ${item.product.name} quantity`}
                        >
                          <Plus className="mx-auto h-4 w-4" />
                        </button>
                      </div>
                      <p className="w-24 text-right text-sm font-semibold">
                        {formatMoney(item.lineTotalCents)}
                      </p>
                      <button
                        type="button"
                        className="min-h-10 min-w-10 rounded-lg text-ink/50 hover:bg-red-50 hover:text-red-700"
                        onClick={() => removeMutation.mutate(item.id)}
                        aria-label={`Remove ${item.product.name}`}
                      >
                        <Trash2 className="mx-auto h-4 w-4" />
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <section className="surface p-5" aria-labelledby="cart-summary">
            <h2 id="cart-summary" className="text-xl">
              Order summary
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink/65">Subtotal</span>
                <span>{formatMoney(cart.pricing.subtotalCents)}</span>
              </div>
              {cart.pricing.discountCents > 0 ? (
                <div className="flex justify-between text-leaf">
                  <span>Discount {cart.pricing.coupon ? `(${cart.pricing.coupon.code})` : ""}</span>
                  <span>−{formatMoney(cart.pricing.discountCents)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-ink/10 pt-3 text-base font-semibold">
                <span>Total</span>
                <span>{formatMoney(cart.pricing.totalCents)}</span>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="coupon" className="block text-sm font-semibold">
                Coupon code
              </label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="coupon"
                  value={coupon}
                  onChange={(event) => setCoupon(event.target.value.toUpperCase())}
                  placeholder="FRESH10"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => couponMutation.mutate(coupon)}
                  loading={couponMutation.isPending}
                  disabled={!coupon.trim()}
                >
                  Apply
                </Button>
              </div>
              {cart.couponError ? (
                <p role="alert" className="mt-2 text-xs font-medium text-red-700">
                  {cart.couponError}
                </p>
              ) : null}
              {cart.pricing.coupon ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-terracotta hover:underline"
                  onClick={() => removeCouponMutation.mutate()}
                >
                  Remove {cart.pricing.coupon.code}
                </button>
              ) : null}
              <p className="mt-2 text-xs text-ink/50">
                Seeded demos: FRESH10 (10% off), BAKERY5 (₹5 off Sunrise Bakery), ONCE24.
              </p>
            </div>

            <Button
              className="mt-5 w-full"
              onClick={() => navigate("/checkout")}
              disabled={cart.items.some((item) => !item.available)}
            >
              Continue to checkout
            </Button>
            <p className="mt-2 text-center text-xs text-ink/50">
              You will pay once. FreshMarket creates one order per vendor.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
