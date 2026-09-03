import { useMutation } from "@tanstack/react-query";
import type { ForgotPasswordInput, ResetPasswordInput } from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) => api.post<{ message: string }>("/auth/forgot-password", input),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => api.post<void>("/auth/reset-password", input),
  });
}
