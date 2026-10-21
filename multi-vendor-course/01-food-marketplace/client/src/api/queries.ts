import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AdminCoupon,
  AdminMetrics,
  CartResponse,
  Order,
  Paginated,
  Product,
  ProductList,
  Store,
  VendorProduct
} from "./types";

export const queryKeys = {
  products: (params: Record<string, string | number | undefined>) =>
    ["products", params] as const,
  product: (id: string) => ["product", id] as const,
  stores: ["stores"] as const,
  myStore: ["store", "me"] as const,
  cart: ["cart"] as const,
  myOrders: ["orders", "my"] as const,
  order: (id: string) => ["order", id] as const,
  vendorProducts: ["vendor", "products"] as const,
  vendorOrders: ["vendor", "orders"] as const,
  adminMetrics: ["admin", "metrics"] as const,
  adminStores: (page: number, search: string) => ["admin", "stores", page, search] as const,
  adminProducts: (page: number, search: string) => ["admin", "products", page, search] as const,
  adminOrders: (page: number) => ["admin", "orders", page] as const,
  adminUsers: (page: number, search: string) => ["admin", "users", page, search] as const,
  adminCoupons: ["admin", "coupons"] as const
};

export function useProducts(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: () => api.get<ProductList>(`/products?${search.toString()}`)
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => api.get<{ product: Product }>(`/products/${id}`),
    enabled: Boolean(id)
  });
}

export function useStores() {
  return useQuery({
    queryKey: queryKeys.stores,
    queryFn: () => api.get<{ stores: Store[] }>("/stores"),
    staleTime: 60_000
  });
}

export function useMyStore(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myStore,
    queryFn: () => api.get<{ store: Store }>("/stores/me"),
    enabled,
    retry: false
  });
}

export function useCart(enabled = true) {
  return useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => api.get<CartResponse>("/cart"),
    enabled
  });
}

export function useCartCount(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => api.get<CartResponse>("/cart"),
    enabled,
    select: (data) => data.items.reduce((sum, item) => sum + item.quantity, 0)
  });
}

export function useMyOrders(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myOrders,
    queryFn: () => api.get<{ orders: Order[] }>("/orders/my"),
    enabled
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => api.get<{ order: Order }>(`/orders/${id}`),
    enabled: Boolean(id)
  });
}

export function useVendorProducts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.vendorProducts,
    queryFn: () => api.get<{ products: VendorProduct[] }>("/vendor/products"),
    enabled
  });
}

export function useVendorOrders(enabled = true) {
  return useQuery({
    queryKey: queryKeys.vendorOrders,
    queryFn: () => api.get<{ orders: Order[] }>("/vendor/orders"),
    enabled
  });
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: queryKeys.adminMetrics,
    queryFn: () => api.get<{ metrics: AdminMetrics }>("/admin/metrics")
  });
}

export function useAdminStores(page: number, search: string) {
  return useQuery({
    queryKey: queryKeys.adminStores(page, search),
    queryFn: () =>
      api.get<Paginated<Store>>(
        `/admin/stores?page=${page}&limit=20&search=${encodeURIComponent(search)}`
      )
  });
}

export function useAdminProducts(page: number, search: string) {
  return useQuery({
    queryKey: queryKeys.adminProducts(page, search),
    queryFn: () =>
      api.get<Paginated<VendorProduct & { store: { id: string; name: string } | null }>>(
        `/admin/products?page=${page}&limit=20&search=${encodeURIComponent(search)}`
      )
  });
}

export function useAdminOrders(page: number) {
  return useQuery({
    queryKey: queryKeys.adminOrders(page),
    queryFn: () => api.get<Paginated<Order>>(`/admin/orders?page=${page}&limit=20`)
  });
}

export function useAdminUsers(page: number, search: string) {
  return useQuery({
    queryKey: queryKeys.adminUsers(page, search),
    queryFn: () =>
      api.get<
        Paginated<{
          id: string;
          email: string;
          role: string;
          isVerified: boolean;
          displayName: string;
          createdAt: string;
        }>
      >(`/admin/users?page=${page}&limit=20&search=${encodeURIComponent(search)}`)
  });
}

export function useAdminCoupons() {
  return useQuery({
    queryKey: queryKeys.adminCoupons,
    queryFn: () => api.get<{ coupons: AdminCoupon[] }>("/admin/coupons")
  });
}
