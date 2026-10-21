import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, ShoppingBasket, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCartCount } from "../api/queries";
import { cn } from "../lib/utils";
import { Button } from "./ui";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-lg px-3 py-2 text-sm font-medium transition",
    isActive ? "bg-leaf/10 text-forest" : "text-ink/70 hover:bg-ink/5 hover:text-ink"
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const cartCount = useCartCount(user?.role === "customer");

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const links = (
    <>
      <NavLink to="/" end className={navClass}>
        Shop
      </NavLink>
      {user?.role === "customer" ? (
        <NavLink to="/orders" className={navClass}>
          Orders
        </NavLink>
      ) : null}
      {user?.role === "vendor" ? (
        <NavLink to="/vendor" className={navClass}>
          Vendor dashboard
        </NavLink>
      ) : null}
      {user?.role === "admin" ? (
        <NavLink to="/admin" className={navClass}>
          Platform
        </NavLink>
      ) : null}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-leaf focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2" aria-label="FreshMarket home">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf font-display text-lg font-semibold text-white">
              F
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">FreshMarket</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {links}
          </nav>

          <div className="flex items-center gap-2">
            {user?.role === "customer" ? (
              <Link
                to="/cart"
                className="relative inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink hover:bg-ink/5"
              >
                <ShoppingBasket className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:inline">Cart</span>
                {cartCount.data ? (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-terracotta px-1.5 py-0.5 text-xs text-white">
                    {cartCount.data}
                  </span>
                ) : null}
              </Link>
            ) : null}

            {user ? (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="max-w-40 truncate text-sm text-ink/70" title={user.displayName}>
                  {user.displayName}
                </span>
                <Button variant="ghost" onClick={() => void logout()}>
                  Log out
                </Button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink">
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-leaf px-3 py-2 text-sm font-semibold text-white hover:bg-forest"
                >
                  Join
                </Link>
              </div>
            )}

            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink hover:bg-ink/5 md:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div id="mobile-menu" className="border-t border-ink/10 px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {links}
              {user ? (
                <>
                  <span className="px-3 py-2 text-xs uppercase tracking-wide text-ink/50">
                    {user.displayName}
                  </span>
                  <Button variant="ghost" className="justify-start" onClick={() => void logout()}>
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium">
                    Log in
                  </Link>
                  <Link to="/register" className="rounded-lg px-3 py-2 text-sm font-medium">
                    Create an account
                  </Link>
                </>
              )}
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink/10 bg-white/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-ink/60 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            FreshMarket — one cart, many local vendors. Built from the Buildment multi-vendor
            marketplace course.
          </p>
          <p>Course-aligned demo · Stripe test mode only</p>
        </div>
      </footer>
    </div>
  );
}
