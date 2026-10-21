import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button, Field, Input } from "../../components/ui";
import { verifyOtpSchema } from "../../lib/validation";

type VerifyValues = z.infer<typeof verifyOtpSchema>;

export function VerifyOtpPage() {
  const { verifyOtp } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { email?: string; devOtp?: string } | null;
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<VerifyValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { email: state?.email ?? "", otp: "" }
  });

  async function onSubmit(values: VerifyValues) {
    setError(null);
    try {
      await verifyOtp(values.email, values.otp);
      notify("Email verified. You can log in now.", "success");
      navigate("/login", { replace: true });
    } catch (verifyError) {
      setError(verifyError instanceof ApiError ? verifyError.message : "Could not verify the code");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 lg:py-20">
      <div className="surface p-6 sm:p-8">
        <h1 className="text-3xl">Verify your email</h1>
        <p className="mt-2 text-sm text-ink/65">
          Enter the 6-digit code we logged to the API console. In development the code is also
          shown on the previous step.
        </p>

        {state?.devOtp ? (
          <div className="mt-4 rounded-lg border border-butter bg-butter/20 px-3 py-2 text-sm">
            Development OTP: <strong className="font-mono tracking-widest">{state.devOtp}</strong>
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </Field>
          <Field label="6-digit code" htmlFor="otp" error={errors.otp?.message}>
            <Input
              id="otp"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              className="font-mono text-lg tracking-[0.4em]"
              aria-invalid={Boolean(errors.otp)}
              {...register("otp")}
            />
          </Field>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Verify email
          </Button>
        </form>

        <p className="mt-6 text-sm text-ink/65">
          Already verified?{" "}
          <Link to="/login" className="font-semibold text-leaf hover:text-forest">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
