import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button, Field, Input } from "../../components/ui";
import { loginSchema } from "../../lib/validation";

type LoginValues = z.infer<typeof loginSchema>;

const demoAccounts = [
  { label: "Customer", email: "customer-a@freshmarket.local" },
  { label: "Vendor", email: "vendor-a@freshmarket.local" },
  { label: "Platform owner", email: "admin@freshmarket.local" }
];

export function LoginPage() {
  const { login } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const showDemo = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== "false";

  async function onSubmit(values: LoginValues) {
    setError(null);
    try {
      const user = await login(values.email, values.password);
      notify(`Welcome back, ${user.displayName}`, "success");
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? (user.role === "vendor" ? "/vendor" : user.role === "admin" ? "/admin" : "/"), {
        replace: true
      });
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : "Could not log in");
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.85fr] lg:px-8 lg:py-20">
      <section className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          One cart, many vendors
        </p>
        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
          Fresh groceries from every shop on your street.
        </h1>
        <p className="mt-4 text-base leading-7 text-ink/70">
          FreshMarket connects local grocers, bakers, and spice sellers in one storefront. Shop
          across shops, check out once, and let the platform split the order.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["Shop", "Browse every vendor in one catalogue."],
            ["Split", "One checkout becomes one order per shop."],
            ["Track", "Vendors update fulfilment; you see the receipt."]
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-ink/10 bg-white/70 p-4">
              <p className="font-display text-lg">{title}</p>
              <p className="mt-1 text-xs leading-5 text-ink/60">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface p-6 sm:p-8" aria-labelledby="login-heading">
        <h2 id="login-heading" className="text-2xl">
          Log in
        </h2>
        <p className="mt-1 text-sm text-ink/60">Use the account you registered with.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
          </Field>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Log in
          </Button>
        </form>

        {showDemo ? (
          <div className="mt-6 rounded-xl border border-ink/10 bg-cream/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">
              Seeded demo accounts
            </p>
            <p className="mt-1 text-xs text-ink/55">Password: Password123!</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-left text-xs hover:border-leaf/40"
                  onClick={() => {
                    setValue("email", account.email, { shouldValidate: true });
                    setValue("password", "Password123!", { shouldValidate: true });
                  }}
                >
                  <span className="block font-semibold">{account.label}</span>
                  <span className="block text-ink/55">{account.email}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-6 text-sm text-ink/65">
          New here?{" "}
          <Link to="/register" className="font-semibold text-leaf hover:text-forest">
            Create an account
          </Link>
        </p>
      </section>
    </div>
  );
}
