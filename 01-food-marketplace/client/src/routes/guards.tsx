import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMyStore } from "../api/queries";
import { ApiError } from "../api/client";
import { Spinner } from "../components/ui";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function CustomerRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== "customer") {
    return <Navigate to={user.role === "vendor" ? "/vendor" : "/admin"} replace />;
  }
  return <Outlet />;
}

export function VendorRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== "vendor") {
    return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;
  }
  return <Outlet />;
}

export function VendorWithStoreRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const storeQuery = useMyStore(user?.role === "vendor");
  if (loading || storeQuery.isLoading) return <Spinner label="Opening your shop" />;
  if (!user || user.role !== "vendor") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (storeQuery.error instanceof ApiError && storeQuery.error.status === 404) {
    return <Navigate to="/vendor/open-shop" replace />;
  }
  return <Outlet />;
}

export function AdminRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
