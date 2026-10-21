import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../api/client";
import { queryKeys, useMyStore } from "../../api/queries";
import { VendorHeader } from "../../components/VendorHeader";
import { Button, Field, Input, Spinner, Textarea } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { storeSchema } from "../../lib/validation";

type StoreValues = z.infer<typeof storeSchema>;

export function VendorSettingsPage() {
  const storeQuery = useMyStore();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<StoreValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: { name: "", description: "", address: "", logoUrl: "" }
  });

  useEffect(() => {
    if (storeQuery.data?.store) {
      const store = storeQuery.data.store;
      reset({
        name: store.name,
        description: store.description ?? "",
        address: store.address ?? "",
        logoUrl: store.logoUrl ?? ""
      });
    }
  }, [storeQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: StoreValues) => {
      const store = storeQuery.data?.store;
      if (!store) throw new Error("Store not loaded");
      return api.patch(`/stores/${store.id}`, {
        name: values.name,
        description: values.description || null,
        address: values.address || null,
        logoUrl: values.logoUrl || null
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myStore });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stores });
      notify("Shop settings saved", "success");
    },
    onError: (saveError: unknown) => {
      const message =
        saveError instanceof ApiError ? saveError.message : "Could not save the shop settings";
      setError(message);
    }
  });

  async function onSubmit(values: StoreValues) {
    setError(null);
    mutation.mutate(values);
  }

  if (storeQuery.isLoading) return <Spinner label="Loading shop settings" />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <VendorHeader
        title="Shop settings"
        description="Customers see this name, description, and address on product cards and the shop filter."
      />

      <form className="surface mt-6 space-y-5 p-5 sm:p-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Shop name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
        </Field>
        <Field label="Description" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" {...register("description")} />
        </Field>
        <Field label="Address or pickup area" htmlFor="address" error={errors.address?.message}>
          <Input id="address" {...register("address")} />
        </Field>
        <Field
          label="Logo URL"
          htmlFor="logoUrl"
          hint="Optional hosted image URL."
          error={errors.logoUrl?.message}
        >
          <Input id="logoUrl" type="url" {...register("logoUrl")} />
        </Field>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}
