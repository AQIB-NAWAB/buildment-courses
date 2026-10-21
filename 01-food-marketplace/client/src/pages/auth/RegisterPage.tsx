import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, Field, Input } from "../../components/ui";
import { registerSchema } from "../../lib/validation";

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "", role: "customer" }
  });
  const role = watch("role");

  async function onSubmit(values: RegisterValues) {
    setError(null);
    try {
      const result = await createAccount(values);
      navigate("/verify-otp", {
        state: { email: values.email, devOtp: result.devOtp }
      });
    } catch (registerError) {
      setError(
        registerError instanceof ApiError ? registerError.message : "Could not create the account"
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:py-20">
      <div className="surface p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">
          Join the market
        </p>
        <h1 className="mt-2 text-3xl">Create your account</h1>
        <p className="mt-2 text-sm text-ink/65">
          Choose customer to shop, or vendor to open a shop and manage products.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">I am joining as</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(
                [
                  { value: "customer", title: "A customer", body: "Browse shops and check out once." },
                  { value: "vendor", title: "A vendor", body: "Open one shop and manage its products." }
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    role === option.value
                      ? "border-leaf bg-leaf/5"
                      : "border-ink/15 bg-white hover:border-leaf/40"
                  }`}
                >
                  <input
                    type="radio"
                    value={option.value}
                    className="sr-only"
                    checked={role === option.value}
                    onChange={() => setValue("role", option.value, { shouldValidate: true })}
                  />
                  <span className="block font-semibold">{option.title}</span>
                  <span className="mt-1 block text-xs text-ink/60">{option.body}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Display name" htmlFor="displayName" error={errors.displayName?.message}>
            <Input
              id="displayName"
              autoComplete="name"
              aria-invalid={Boolean(errors.displayName)}
              {...register("displayName")}
            />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters."
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
          </Field>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Create account
          </Button>
        </form>

        <p className="mt-6 text-sm text-ink/65">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-leaf hover:text-forest">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
