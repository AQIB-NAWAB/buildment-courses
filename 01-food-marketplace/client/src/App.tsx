import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import {
  AdminRoute,
  CustomerRoute,
  VendorRoute,
  VendorWithStoreRoute
} from "./routes/guards";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { VerifyOtpPage } from "./pages/auth/VerifyOtpPage";
import { ShopPage } from "./pages/shop/ShopPage";
import { ProductDetailPage } from "./pages/shop/ProductDetailPage";
import { CartPage } from "./pages/customer/CartPage";
import { CheckoutPage } from "./pages/customer/CheckoutPage";
import { ConfirmationPage } from "./pages/customer/ConfirmationPage";
import { OrdersPage } from "./pages/customer/OrdersPage";
import { OrderDetailPage } from "./pages/customer/OrderDetailPage";
import { OpenShopPage } from "./pages/vendor/OpenShopPage";
import { VendorDashboardPage } from "./pages/vendor/VendorDashboardPage";
import { VendorProductsPage } from "./pages/vendor/VendorProductsPage";
import { ProductFormPage } from "./pages/vendor/ProductFormPage";
import { VendorSettingsPage } from "./pages/vendor/VendorSettingsPage";
import { VendorOrdersPage } from "./pages/vendor/VendorOrdersPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminStoresPage } from "./pages/admin/AdminStoresPage";
import { AdminProductsPage } from "./pages/admin/AdminProductsPage";
import { AdminOrdersPage } from "./pages/admin/AdminOrdersPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminCouponsPage } from "./pages/admin/AdminCouponsPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">404</p>
      <h1 className="mt-2 text-4xl">That aisle does not exist</h1>
      <p className="mt-3 text-sm text-ink/65">
        The page may have moved, or the product may no longer be available.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white"
      >
        Back to the market
      </Link>
    </div>
  );
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ShopPage />} />
          <Route path="shop" element={<Navigate to="/" replace />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="verify-otp" element={<VerifyOtpPage />} />

          <Route element={<CustomerRoute />}>
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="checkout/success" element={<ConfirmationPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
          </Route>

          <Route element={<VendorRoute />}>
            <Route path="vendor/open-shop" element={<OpenShopPage />} />
            <Route element={<VendorWithStoreRoute />}>
              <Route path="vendor" element={<VendorDashboardPage />} />
              <Route path="vendor/products" element={<VendorProductsPage />} />
              <Route path="vendor/products/new" element={<ProductFormPage />} />
              <Route path="vendor/products/:id/edit" element={<ProductFormPage />} />
              <Route path="vendor/settings" element={<VendorSettingsPage />} />
              <Route path="vendor/orders" element={<VendorOrdersPage />} />
            </Route>
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="admin" element={<AdminDashboardPage />} />
            <Route path="admin/stores" element={<AdminStoresPage />} />
            <Route path="admin/products" element={<AdminProductsPage />} />
            <Route path="admin/orders" element={<AdminOrdersPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="admin/coupons" element={<AdminCouponsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
