import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthenticatedUserDto } from "@fad-console/shared-types";
import { api, ApiError } from "./api-client";

interface AuthContextValue {
  user: AuthenticatedUserDto | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginError: string | null;
  isLoggingIn: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const res = await api.get<{ user: AuthenticatedUserDto }>("/auth/me");
        return res.user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await api.post<{ user: AuthenticatedUserDto }>("/auth/login", { email, password });
      return res.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["auth", "me"], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.clear();
    },
  });

  const value: AuthContextValue = {
    user: meQuery.data ?? null,
    isLoading: meQuery.isLoading,
    login: async (email, password) => {
      await loginMutation.mutateAsync({ email, password });
    },
    loginError: loginMutation.error instanceof ApiError ? loginMutation.error.message : null,
    isLoggingIn: loginMutation.isPending,
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
