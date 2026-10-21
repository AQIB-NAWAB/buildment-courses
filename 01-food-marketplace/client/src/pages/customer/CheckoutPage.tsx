import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe
} from "@stripe/react-stripe-js";
import { api, ApiError } from "../../api/client";
import { queryKeys, useCart } from "../../api/queries";
import type { CheckoutStart, Order } from "../../api/types";
import { Button, EmptyState, ErrorState, Spinner } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../context/ToastContext";
import { formatMoney, unitLabel } from "../../lib/utils";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function PaymentForm({
  checkout,
  onCompleted
}: {
  checkout: CheckoutStart;
  onCompleted(orders: Order[]): void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const completeMutation = useMutation({
    mutationFn: (paymentIntentId: string) =>
      api.post<{ orders: Order[]; replayed: boolean }>("/checkout", { paymentIntentId }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myOrders });
      onCompleted(data.orders);
    },
    onError: (completeError: unknown) => {
      const message =
        completeError instanceof ApiError
          ? completeError.message
          : "Payment succeeded but the order could not be created.";
      setError(
        `${message} Keep this payment reference: ${checkout.paymentIntentId}. Do not pay again.`
      );
      notify("Order creation needs attention", "error");
    }
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setPaying(true);
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`
      }
    });
    if (result.error) {
      setError(result.error.message ?? "Payment was not completed.");
      setPaying(false);
      return;
    }
    if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
      completeMutation.mutate(result.paymentIntent.id);
    } else {
      setError(
        "Payment is still processing. Refresh your orders in a moment before trying again."
      );
    }
    setPaying(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        loading={paying || completeMutation.isPending}
        disabled={!stripe || !elements}
      >
        Pay {formatMoney(checkout.amountCents, checkout.currency)}
      </Button>
      <p className="text-center text-xs text-ink/55">
        Stripe test mode. Use 4242 4242 4242 4242, any future expiry, any CVC.
      </p>
    </form>
  );
}

function FinalizePaidOrder({
  checkout,
  onCompleted
}: {
  checkout: CheckoutStart;
  onCompleted(orders: Order[]): void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ orders: Order[] }>("/checkout", {
        paymentIntentId: checkout.paymentIntentId
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myOrders });
      onCompleted(data.orders);
    },
    onError: (finalizeError: unknown) => {
      setError(
        finalizeError instanceof ApiError
          ? finalizeError.message
          : "The paid order could not be finalized."
      );
    }
  });

  return (
    <div className="mt-5 space-y-3 rounded-xl border border-leaf/20 bg-leaf/5 p-4 text-sm">
      <p className="font-semibold text-forest">Payment already received</p>
      <p className="text-ink/70">
        Stripe reports this payment as complete. Finalize the order to create your vendor
        receipts; do not pay again.
      </p>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
          {error}
        </p>
      ) : null}
      <Button
        className="w-full"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Finalize paid order
      </Button>
    </div>
  );
}

export function CheckoutPage() {
  const cartQuery = useCart();
  const navigate = useNavigate();
  const { notify } = useToast();
  const checkoutId = useRef(crypto.randomUUID());
  const [checkout, setCheckout] = useState<CheckoutStart | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () =>
      api.post<CheckoutStart>("/checkout/start", { checkoutId: checkoutId.current }),
    onSuccess: (data) => {
      setCheckout(data);
      setError(null);
    },
    onError: (startError: unknown) => {
      const message =
        startError instanceof ApiError ? startError.message : "Could not start checkout";
      setError(message);
      notify(message, "error");
      void cartQuery.refetch();
    }
  });

  const totals = useMemo(() => {
    if (!cartQuery.data) return null;
    return cartQuery.data.pricing;
  }, [cartQuery.data]);

  if (cartQuery.isLoading) return <Spinner label="Preparing checkout" />;
  if (cartQuery.isError || !cartQuery.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <ErrorState message="Your cart could not be loaded." onRetry={() => void cartQuery.refetch()} />
      </div>
    );
  }
  if (cartQuery.data.items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <PageHeader title="Checkout" />
        <div className="mt-8">
          <EmptyState
            title="Nothing to check out"
            body="Your cart is empty. Add items from one or more vendors first."
            action={
              <Link to="/" className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white">
                Shop the market
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const availableLines = cartQuery.data.items.filter((item) => item.available);
  const hasUnavailable = availableLines.length !== cartQuery.data.items.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Checkout"
        description="Your cart is reserved at checkout start and confirmed only after Stripe reports a successful payment."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="surface p-5" aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="text-xl">
            Payment
          </h2>

          {!stripePromise ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Stripe is not configured.</p>
              <p className="mt-1">
                Add <code className="rounded bg-white px-1">VITE_STRIPE_PUBLISHABLE_KEY</code> to
                <code className="mx-1 rounded bg-white px-1">client/.env</code> and restart Vite.
                The API also needs <code className="rounded bg-white px-1">STRIPE_SECRET_KEY</code>.
              </p>
            </div>
          ) : null}

          {hasUnavailable ? (
            <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              Some cart lines are no longer available.{" "}
              <Link to="/cart" className="font-semibold underline">
                Review your cart
              </Link>
              .
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          {!checkout ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-ink/10 bg-cream/60 p-4 text-sm text-ink/70">
                <p className="font-semibold text-ink">What happens next</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>We reserve stock for every line for 15 minutes.</li>
                  <li>Stripe accepts the payment in test mode.</li>
                  <li>We confirm the reservations and create one order per vendor.</li>
                </ol>
              </div>
              <Button
                className="w-full"
                loading={startMutation.isPending}
                disabled={!stripePromise || hasUnavailable}
                onClick={() => startMutation.mutate()}
              >
                Start secure checkout
              </Button>
              <p className="text-center text-xs text-ink/50">
                Starting checkout does not charge you. You will see the card form next.
              </p>
            </div>
          ) : checkout.clientSecret ? (
            <div className="mt-5">
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: checkout.clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#2f6b4f",
                      colorText: "#1e2a23",
                      borderRadius: "8px"
                    }
                  }
                }}
              >
                <PaymentForm
                  checkout={checkout}
                  onCompleted={(orders) => {
                    navigate("/checkout/success", { state: { orders } });
                  }}
                />
              </Elements>
            </div>
          ) : (
            <FinalizePaidOrder
              checkout={checkout}
              onCompleted={(orders) => {
                navigate("/checkout/success", { state: { orders } });
              }}
            />
          )}
        </section>

        <aside className="space-y-4">
          <section className="surface p-5" aria-labelledby="checkout-summary">
            <h2 id="checkout-summary" className="text-xl">
              Review
            </h2>
            <div className="mt-4 space-y-4">
              {cartQuery.data.pricing.stores.map((store) => (
                <div key={store.storeId}>
                  <h3 className="text-sm font-semibold">{store.storeName}</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {store.lines.map((line) => (
                      <li key={line.cartItemId} className="flex justify-between gap-3">
                        <span className="text-ink/70">
                          {line.quantity} × {line.name}{" "}
                          <span className="text-xs text-ink/45">({unitLabel(line.unit)})</span>
                        </span>
                        <span>{formatMoney(line.lineTotalCents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {totals ? (
              <div className="mt-5 space-y-2 border-t border-ink/10 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink/65">Subtotal</span>
                  <span>{formatMoney(totals.subtotalCents)}</span>
                </div>
                {totals.discountCents > 0 ? (
                  <div className="flex justify-between text-leaf">
                    <span>Discount</span>
                    <span>−{formatMoney(totals.discountCents)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(totals.totalCents)}</span>
                </div>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
