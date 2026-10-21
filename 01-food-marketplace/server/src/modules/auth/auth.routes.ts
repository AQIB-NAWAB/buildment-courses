import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../../shared/config.js";
import { asyncHandler, UnauthorizedError } from "../../shared/errors.js";
import { parseBody } from "../../shared/validation.js";
import { optionalAuth, requireAuth } from "../../shared/auth/middleware.js";
import { loginSchema, refreshSchema, registerSchema, verifyOtpSchema } from "./auth.schemas.js";
import {
  login,
  logout,
  me,
  refresh,
  register,
  verifyOtp,
  type TokenPair
} from "./auth.service.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Try again later.", code: "RATE_LIMITED" }
});

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: config.isProduction ? ("none" as const) : ("lax" as const),
    secure: config.cookieSecure,
    path: "/api/auth",
    maxAge: config.refreshTokenTtlDays * 24 * 60 * 60 * 1_000
  };
}

function sendTokens(res: Parameters<Parameters<typeof asyncHandler>[0]>[1], tokens: TokenPair) {
  res.cookie("refresh", tokens.refreshToken, refreshCookieOptions());
  return {
    accessToken: tokens.accessToken,
    ...(config.returnRefreshToken || config.env === "test"
      ? { refreshToken: tokens.refreshToken }
      : {})
  };
}

export const authRouter = Router();

authRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(registerSchema, req);
    const result = await register(body);
    res.status(201).json({
      message: "Registration successful. Verify your email with the OTP.",
      userId: result.userId,
      ...(result.devOtp ? { devOtp: result.devOtp } : {})
    });
  })
);

authRouter.post(
  "/verify-otp",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(verifyOtpSchema, req);
    await verifyOtp(body.email, body.otp);
    res.json({ message: "Email verified successfully", verified: true });
  })
);

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req);
    const result = await login(body.email, body.password);
    res.json({ ...sendTokens(res, result.tokens), user: result.user });
  })
);

authRouter.post(
  "/refresh",
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(refreshSchema, req);
    const token = body.refreshToken ?? req.cookies?.refresh;
    if (!token) throw new UnauthorizedError("Refresh token required");
    const tokens = await refresh(token);
    res.json(sendTokens(res, tokens));
  })
);

authRouter.post(
  "/logout",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (req.user) await logout(req.user.id);
    res.clearCookie("refresh", {
      path: "/api/auth",
      sameSite: config.isProduction ? "none" : "lax",
      secure: config.cookieSecure
    });
    res.status(204).send();
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await me(req.user!.id));
  })
);
