import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "../../api/client";
import { queryKeys, useAdminCoupons, useStores } from "../../api/queries";
import { AdminHeader } from "../../components/AdminHeader";
import { Button, ErrorState, Field, Input, Select, Spinner } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { couponSchema } from "../../lib/validation";
import { formatDate, formatMoney } from "../../lib/utils";

type CouponValues = z.infer<typeof couponSchema>;

function isoDate(daysFromNow: number): string {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1_000);
  return date.toISOString().slice(0, 10);
}

export function AdminCouponsPage() {
  const couponsQuery = useAdminCoupons();
  const storesQuery = useStores();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CouponValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: "",
      scope: "platform",
      storeId: "",
      type: "percent",
      value: 10,
      minSubtotalCents: 0,
      maxDiscountCents: undefined,
      startsAt: isoDate(0),
      endsAt: isoDate(30)
    }
  });
  const scope = watch("scope");
  const type = watch("type");

  const createMutation = useMutation({
    mutationFn: (values: CouponValues) =>
      api.post("/admin/coupons", {
        ...values,
        storeId: values.scope === "store" ? values.storeId : undefined,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: new Date(values.endsAt).toISOString(),
        maxDiscountCents: values.maxDiscountCents || undefined
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCoupons });
      notify("Coupon created", "success");
      reset({
        code: "",
        scope: "platform",
        storeId: "",
        type: "percent",
        value: 10,
        minSubtotalCents: 0,
        maxDiscountCents: undefined,
        startsAt: isoDate(0),
        endsAt: isoDate(30)
      });
      setError(null);
    },
    onError: (createError: unknown) => {
      const message =
        createError instanceof ApiError ? createError.message : "Could not create the coupon";
      setError(message);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/coupons/${id}`, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminCoupons });
      notify("Coupon updated", "success");
    },
    onError: (toggleError: unknown) =>
      notify(
        toggleError instanceof ApiError ? toggleError.message : "Could not update the coupon",
        "error"
      )
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminHeader
        title="Coupons"
        description="Codes are validated again at checkout. Deactivating a code stops new uses; paid orders keep their discount snapshots."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
        <form
          className="surface space-y-4 p-5"
          onSubmit={handleSubmit((values) => {
            setError(null);
            createMutation.mutate(values);
          })}
          noValidate
        >
          <h2 className="text-xl">Create a coupon</h2>
          <Field label="Code" htmlFor="code" error={errors.code?.message}>
            <Input id="code" placeholder="FRESH10" {...register("code")} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Scope" htmlFor="scope" error={errors.scope?.message}>
              <Select id="scope" {...register("scope")}>
                <option value="platform">Platform-wide</option>
                <option value="store">One store</option>
              </Select>
            </Field>
            <Field label="Type" htmlFor="type" error={errors.type?.message}>
              <Select id="type" {...register("type")}>
                <option value="percent">Percent</option>
                <option value="fixed_cents">Fixed (minor units)</option>
              </Select>
            </Field>
          </div>

          {scope === "store" ? (
            <Field label="Store" htmlFor="storeId" error={errors.storeId?.message}>
              <Select id="storeId" {...register("storeId")}>
                <option value="">Choose a store</option>
                {storesQuery.data?.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={type === "percent" ? "Percent off" : "Amount off (minor units)"}
              htmlFor="value"
              error={errors.value?.message}
            >
              <Input
                id="value"
                type="number"
                min="1"
                step="1"
                {...register("value", { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Max discount (minor units)"
              htmlFor="maxDiscountCents"
              hint="Optional cap."
              error={errors.maxDiscountCents?.message}
            >
              <Input
                id="maxDiscountCents"
                type="number"
                min="0"
                step="1"
                {...register("maxDiscountCents", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value))
                })}
              />
            </Field>
          </div>

          <Field
            label="Minimum subtotal (minor units)"
            htmlFor="minSubtotalCents"
            error={errors.minSubtotalCents?.message}
          >
            <Input
              id="minSubtotalCents"
              type="number"
              min="0"
              step="1"
              {...register("minSubtotalCents", { valueAsNumber: true })}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts" htmlFor="startsAt" error={errors.startsAt?.message}>
              <Input id="startsAt" type="date" {...register("startsAt")} />
            </Field>
            <Field label="Ends" htmlFor="endsAt" error={errors.endsAt?.message}>
              <Input id="endsAt" type="date" {...register("endsAt")} />
            </Field>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting || createMutation.isPending}>
            Create coupon
          </Button>
        </form>

        <div>
          {couponsQuery.isLoading ? <Spinner label="Loading coupons" /> : null}
          {couponsQuery.isError ? (
            <ErrorState message="Coupons could not be loaded." onRetry={() => void couponsQuery.refetch()} />
          ) : null}
          {couponsQuery.data ? (
            <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-cream/70 text-xs uppercase tracking-wide text-ink/50">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Rule</th>
                    <th className="px-4 py-3">Window</th>
                    <th className="px-4 py-3">Uses</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {couponsQuery.data.coupons.map((coupon) => (
                    <tr key={coupon.id}>
                      <td className="px-4 py-3 font-semibold">{coupon.code}</td>
                      <td className="px-4 py-3">
                        {coupon.type === "percent"
                          ? `${coupon.value}% off`
                          : `${formatMoney(coupon.value)} off`}
                        <span className="block text-xs capitalize text-ink/50">
                          {coupon.scope} · min {formatMoney(coupon.minSubtotalCents)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink/60">
                        {formatDate(coupon.startsAt)} → {formatDate(coupon.endsAt)}
                      </td>
                      <td className="px-4 py-3">
                        {coupon.redemptionCount}
                        {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            coupon.isActive
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {coupon.isActive ? "Active" : "Off"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant={coupon.isActive ? "danger" : "secondary"}
                          className="min-h-9 px-3 py-1.5 text-xs"
                          onClick={() =>
                            toggleMutation.mutate({ id: coupon.id, isActive: !coupon.isActive })
                          }
                        >
                          {coupon.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
