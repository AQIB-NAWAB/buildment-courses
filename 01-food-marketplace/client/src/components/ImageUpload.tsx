import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import { Button, Field } from "./ui";
import { ProductImage } from "./ProductImage";

export function ImageUpload({
  productId,
  currentUrl,
  onSuccess
}: {
  productId: string;
  currentUrl?: string | null;
  onSuccess(url: string): void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { notify } = useToast();

  const mutation = useMutation({
    mutationFn: async (selected: File) => {
      const form = new FormData();
      form.append("image", selected);
      return api.upload<{ imageUrl: string }>(`/products/${productId}/image`, form);
    },
    onSuccess: (data) => {
      notify("Photo uploaded", "success");
      setFile(null);
      setPreview(null);
      onSuccess(data.imageUrl);
    },
    onError: (uploadError: unknown) => {
      const message =
        uploadError instanceof ApiError ? uploadError.message : "Could not upload the photo";
      setError(message);
      notify(message, "error");
    }
  });

  function select(selected: File | null) {
    setError(null);
    if (!selected) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("The image must be 5 MB or smaller.");
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  return (
    <div className="space-y-3 rounded-xl border border-ink/10 bg-cream/50 p-4">
      <div className="flex items-center gap-4">
        <ProductImage
          src={preview ?? currentUrl}
          alt="Product preview"
          className="h-20 w-20 rounded-lg"
        />
        <div className="flex-1">
          <Field
            label="Product photo"
            htmlFor="product-image"
            hint="JPEG, PNG, or WebP. Maximum 5 MB. Uploaded to Cloudinary."
            error={error ?? undefined}
          >
            <input
              id="product-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-leaf file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              onChange={(event) => select(event.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={!file}
          loading={mutation.isPending}
          onClick={() => file && mutation.mutate(file)}
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          Upload photo
        </Button>
      </div>
    </div>
  );
}
