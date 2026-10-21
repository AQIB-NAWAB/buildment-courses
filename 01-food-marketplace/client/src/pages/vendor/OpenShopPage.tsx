import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import { queryKeys, useMyStore } from "../../api/queries";
import { Button, Field, Input, Textarea } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { storeSchema } from "../../lib/validation";

type StoreValues = z.infer<typeof storeSchema>;

export function OpenShopPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const storeQuery = useMyStore();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<StoreValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: { name: "", description: "", address: "", logoUrl: "" }
  });

  useEffect(() => {
    if (storeQuery.data?.store) navigate("/vendor", { replace: true });
  }, [storeQuery.data, navigate]);

  async function onSubmit(values: StoreValues) {
    setError(null);
    try {
      await api.post("/stores", {
        name: values.name,
        description: values.description || undefined,
        address: values.address || undefined,
        logoUrl: values.logoUrl || undefined
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myStore });
      await queryClient.invalidateQueries({ queryKey: queryKeys.stores });
      notify("Your shop is open", "success");
      navigate("/vendor", { replace: true });
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : "Could not open the shop");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:py-20">
      <div className="surface p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Vendor onboarding
        </p>
        <h1 className="mt-2 text-3xl">Open your shop</h1>
        <p className="mt-2 text-sm text-ink/65">
          One vendor account owns one shop. You can add products only after this step.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label="Shop name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              placeholder="Green Valley Grocer"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
          </Field>
          <Field label="Short description" htmlFor="description" error={errors.description?.message}>
            <Textarea
              id="description"
              placeholder="What do you sell, and what makes your shop special?"
              {...register("description")}
            />
          </Field>
          <Field label="Address or pickup area" htmlFor="address" error={errors.address?.message}>
            <Input id="address" placeholder="12 Market Lane" {...register("address")} />
          </Field>
          <Field
            label="Logo URL (optional)"
            htmlFor="logoUrl"
            hint="Paste a hosted image URL; product photos are uploaded separately."
            error={errors.logoUrl?.message}
          >
            <Input id="logoUrl" type="url" placeholder="https://…" {...register("logoUrl")} />
          </Field>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Open my shop
          </Button>
        </form>
      </div>
    </div>
  );
}
