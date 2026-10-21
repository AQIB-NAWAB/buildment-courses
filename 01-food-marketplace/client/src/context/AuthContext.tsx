import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  api,
  ApiError,
  setAccessToken,
  setUnauthorizedHandler
} from "../api/client";
import type { User } from "../api/types";

interface MeResponse {
  user: User;
  profile: { displayName: string; phone?: string | null; avatarUrl?: string | null } | null;
}

interface RegisterInput {
  email: string;
  password: string;
  role: "vendor" | "customer";
  displayName?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<User>;
  register(input: RegisterInput): Promise<{ userId: string; devOtp?: string }>;
  verifyOtp(email: string, otp: string): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const data = await api.get<MeResponse>("/auth/me");
    setUser(data.user);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const refreshed = await api.post<{ accessToken: string }>("/auth/refresh", {});
        if (cancelled) return;
        setAccessToken(refreshed.accessToken);
        const data = await api.get<MeResponse>("/auth/me");
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ accessToken: string; user: User }>("/auth/login", {
      email,
      password
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    return api.post<{ userId: string; devOtp?: string }>("/auth/register", input);
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string) => {
    await api.post("/auth/verify-otp", { email, otp });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, verifyOtp, logout, refreshUser }),
    [user, loading, login, register, verifyOtp, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
