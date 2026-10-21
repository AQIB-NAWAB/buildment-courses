import bcrypt from "bcryptjs";
import { config } from "../../shared/config.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import {
  generateOpaqueToken,
  generateOtp,
  hashOtp,
  hashRefreshToken,
  otpExpiry,
  refreshExpiry,
  safeEqualStrings,
  signAccessToken
} from "../../shared/auth/tokens.js";
import type { Role } from "../../shared/types.js";
import { Profile } from "../users/profile.model.js";
import { User, type UserDocument } from "../users/user.model.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  isVerified: boolean;
  displayName: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function defaultDisplayName(email: string): string {
  const local = email.split("@")[0] ?? "Shopper";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function issueTokens(user: UserDocument): Promise<TokenPair> {
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = generateOpaqueToken();
  user.refreshTokenHash = hashRefreshToken(refreshToken);
  user.refreshTokenExpiresAt = refreshExpiry();
  await user.save();
  return { accessToken, refreshToken };
}

async function publicUser(user: UserDocument): Promise<PublicUser> {
  const profile = await Profile.findOne({ userId: user._id });
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    displayName: profile?.displayName ?? defaultDisplayName(user.email)
  };
}

export async function register(input: {
  email: string;
  password: string;
  role: Role;
  displayName?: string;
}): Promise<{ userId: string; devOtp?: string }> {
  const email = normalizeEmail(input.email);
  if (!["vendor", "customer"].includes(input.role)) {
    throw new BadRequestError("Only vendor and customer accounts can be registered");
  }
  if (await User.exists({ email })) {
    throw new ConflictError("Email already registered", "EMAIL_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const otp = generateOtp();

  let user: UserDocument;
  try {
    user = await User.create({
      email,
      passwordHash,
      role: input.role,
      isVerified: false,
      otpHash: hashOtp(otp),
      otpExpiresAt: otpExpiry(10)
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) {
      throw new ConflictError("Email already registered", "EMAIL_EXISTS");
    }
    throw error;
  }

  await Profile.create({
    userId: user._id,
    displayName: input.displayName?.trim() || defaultDisplayName(email)
  });

  if (!config.isProduction) {
    logger.info({ email, otp }, "Development OTP generated");
  }

  return {
    userId: user.id,
    ...(config.isProduction ? {} : { devOtp: otp })
  };
}

export async function verifyOtp(emailRaw: string, otp: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const user = await User.findOne({ email });
  if (!user) throw new NotFoundError("Account not found");
  if (user.isVerified) return;

  if (!user.otpHash || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
    throw new BadRequestError("OTP expired. Register again or request a new code.");
  }
  if (!safeEqualStrings(hashOtp(otp), user.otpHash)) {
    throw new BadRequestError("Incorrect OTP");
  }

  user.isVerified = true;
  user.otpHash = null;
  user.otpExpiresAt = null;
  await user.save();
}

export async function login(
  emailRaw: string,
  password: string
): Promise<{ tokens: TokenPair; user: PublicUser }> {
  const email = normalizeEmail(emailRaw);
  const user = await User.findOne({ email });
  if (!user) throw new UnauthorizedError("Invalid credentials");

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw new UnauthorizedError("Invalid credentials");
  if (!user.isVerified) throw new ForbiddenError("Email not verified");

  return {
    tokens: await issueTokens(user),
    user: await publicUser(user)
  };
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  if (!refreshToken) throw new BadRequestError("Refresh token required");
  const user = await User.findOne({ refreshTokenHash: hashRefreshToken(refreshToken) });
  if (!user) throw new UnauthorizedError("Invalid refresh token");
  if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt.getTime() < Date.now()) {
    user.refreshTokenHash = null;
    user.refreshTokenExpiresAt = null;
    await user.save();
    throw new UnauthorizedError("Refresh token expired");
  }
  return issueTokens(user);
}

export async function logout(userId: string): Promise<void> {
  await User.updateOne(
    { _id: userId },
    { $set: { refreshTokenHash: null, refreshTokenExpiresAt: null } }
  );
}

export async function me(userId: string): Promise<{ user: PublicUser; profile: unknown }> {
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError();
  const profile = await Profile.findOne({ userId: user._id });
  return {
    user: await publicUser(user),
    profile: profile
      ? {
          displayName: profile.displayName,
          phone: profile.phone,
          avatarUrl: profile.avatarUrl
        }
      : null
  };
}
