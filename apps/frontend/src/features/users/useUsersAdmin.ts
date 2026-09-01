import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthenticatedUserDto } from "@fad-console/shared-types";
import type { CreateUserInput, UpdateUserInput } from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

export function useUsersAdmin() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ users: AuthenticatedUserDto[] }>("/users").then((r) => r.users),
  });
}

export function useCreateUserAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => api.post<{ user: AuthenticatedUserDto }>("/users", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUserAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      api.patch<{ user: AuthenticatedUserDto }>(`/users/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUserAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
