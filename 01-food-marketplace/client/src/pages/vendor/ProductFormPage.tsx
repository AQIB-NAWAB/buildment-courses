import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { queryKeys, useVendorProducts } from "../../api/queries";
import type { VendorProduct } from "../../api/types";
import { VendorHeader } from "../../components/VendorHeader";
import { ImageUpload } from "../../components/ImageUpload";
import { Button, Field, Input, Select, Spinner, Textarea } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { CATEGORIES, UNITS, categoryLabel } from "../../lib/categories";
import { productSchema } from "../../lib/validation";
import { formatMoney } from "../../lib/utils";

type ProductValues = z.infer<typeof productSchema>;

const defaults: ProductValues = {
  name: "",
  description: "",
  price: 1,
  unit: "each",
  weightOrQuantity: undefined,
  stockQty: 0,
  isPerishable: false,
  category: "produce",
  isPublished: false
};

function valuesFromProduct(product: VendorProduct): ProductValues {
  return {
    name: product.name,
    description: product.description ?? "",
    price: product.price,
    unit: product.unit,
    weightOrQuantity: product.weightOrQuantity ?? undefined,
    stockQty: product.stockQty,
    isPerishable: product.isPerishable,
    category: product.category,
    isPublished: product.isPublished
  };
}

export function ProductFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const productsQuery = useVendorProducts();
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const product = productsQuery.data?.products.find((candidate) => candidate.id === id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaults
  });

  useEffect(() => {
    if (product) {
      reset(valuesFromProduct(product));
      setImageUrl(product.imageUrl ?? null);
    }
  }, [product, reset]);

  const mutation = useMutation({
    mutationFn: (values: ProductValues) => {
      const body = {
        ...values,
        description: values.description || undefined,
        weightOrQuantity: values.weightOrQuantity ?? null
      };
      return editing
        ? api.patch<{ product: VendorProduct }>(`/products/${id}`, body)
        : api.post<{ product: VendorProduct }>("/products", body);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendorProducts });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      notify(editing ? "Product updated" : "Product created", "success");
      if (!editing) {
        navigate(`/vendor/products/${data.product.id}/edit`, { replace: true });
      }
    },
    onError: (createError: unknown) => {
      const message =
        createError instanceof ApiError ? createError.message : "Could not save the product";
      setError(message);
      if (createError instanceof ApiError && createError.errors) {
        for (const issue of createError.errors) {
          notify(`${issue.path}: ${issue.message}`, "error");
        }
      }
    }
  });

  async function onSubmit(values: ProductValues) {
    setError(null);
    mutation.mutate(values);
  }

  if (editing && (!product && (productsQuery.isLoading || productsQuery.isFetching))) {
    return <Spinner label="Loading product" />;
  }
  if (editing && !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Product not found. It may have been deleted.
        </p>
        <Link to="/vendor/products" className="mt-4 inline-block text-sm font-semibold text-leaf">
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <VendorHeader
        title={editing ? "Edit product" : "Add a product"}
        description={
          editing
            ? "Change the listing, stock, photo, and publish state. Past order receipts never change."
            : "Save as a draft first, then add a photo and publish when the listing is ready."
        }
        actions={
          <Link
            to="/vendor/products"
            className="inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Products
          </Link>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <form className="surface space-y-5 p-5 sm:p-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" htmlFor="name" error={errors.name?.message} className="sm:col-span-2">
              <Input id="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </Field>

            <Field
              label="Description"
              htmlFor="description"
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              <Textarea id="description" {...register("description")} />
            </Field>

            <Field label="Price (₹)" htmlFor="price" error={errors.price?.message}>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                aria-invalid={Boolean(errors.price)}
                {...register("price", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Unit" htmlFor="unit" error={errors.unit?.message}>
              <Select id="unit" {...register("unit")}>
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Pack size / weight"
              htmlFor="weightOrQuantity"
              hint="Optional. Example: 500 for a 500g pack."
              error={errors.weightOrQuantity?.message}
            >
              <Input
                id="weightOrQuantity"
                type="number"
                min="0"
                step="any"
                {...register("weightOrQuantity", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value))
                })}
              />
            </Field>

            <Field label="Stock quantity" htmlFor="stockQty" error={errors.stockQty?.message}>
              <Input
                id="stockQty"
                type="number"
                min="0"
                step="1"
                aria-invalid={Boolean(errors.stockQty)}
                {...register("stockQty", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Category" htmlFor="category" error={errors.category?.message}>
              <Select id="category" {...register("category")}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded" {...register("isPerishable")} />
                Perishable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded" {...register("isPublished")} />
                Published in the catalogue
              </label>
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Link
              to="/vendor/products"
              className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
            >
              Cancel
            </Link>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              {editing ? "Save changes" : "Create product"}
            </Button>
          </div>
        </form>

        <aside className="space-y-4">
          {editing && product ? (
            <>
              <ImageUpload
                productId={product.id}
                currentUrl={imageUrl}
                onSuccess={(url) => {
                  setImageUrl(url);
                  void queryClient.invalidateQueries({ queryKey: queryKeys.vendorProducts });
                }}
              />
              <div className="surface p-4 text-sm">
                <p className="font-semibold">Live preview</p>
                <p className="mt-1 text-ink/60">
                  {formatMoney(product.priceCents)} · {product.availableQty} available
                </p>
                <p className="mt-1 text-xs text-ink/50">
                  {product.isPublished ? "Visible in the catalogue" : "Draft — not public"}
                </p>
                {!product.isActive ? (
                  <p className="mt-2 text-xs font-medium text-red-700">
                    The platform owner has suspended this product. You can still edit it, but it
                    will not appear publicly.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="surface p-4 text-sm text-ink/65">
              <p className="font-semibold text-ink">Photo upload</p>
              <p className="mt-1">
                Save the product first. The edit page then unlocks the Cloudinary photo upload.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
