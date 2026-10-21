import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { api, ApiError } from "../api/client";
import { queryKeys } from "../api/queries";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Button } from "./ui";

export function AddToCartButton({
  productId,
  storeId,
  productName,
  quantity = 1,
  compact = false
}: {
  productId: string;
  storeId: string;
  productName: string;
  quantity?: number;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.post("/cart", { productId, storeId, quantity }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      notify(`${productName} added to your cart`, "success");
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Could not add this item";
      notify(message, "error");
    }
  });

  function handleClick() {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (user.role !== "customer") {
      notify("Log in with a customer account to shop.", "info");
      return;
    }
    mutation.mutate();
  }

  return (
    <Button
      variant={compact ? "secondary" : "primary"}
      className={compact ? "min-h-9 px-3 py-1.5 text-xs" : ""}
      loading={mutation.isPending}
      onClick={handleClick}
      aria-label={`Add ${productName} to cart`}
    >
      {!mutation.isPending ? <Plus className="h-4 w-4" aria-hidden="true" /> : null}
      {compact ? "Add" : "Add to cart"}
    </Button>
  );
}
