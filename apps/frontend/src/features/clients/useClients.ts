import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientBrandingDto, ClientDto } from "@fad-console/shared-types";
import type { CreateClientInput, UpdateClientBrandingInput, UpdateClientInput } from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<{ clients: ClientDto[] }>("/clients").then((r) => r.clients),
  });
}

/** Marca (logo/color/favicon) del cliente de la sesión actual — se usa para pintar el header y el
 * favicon al cargar la app, sin importar el rol. */
export function useMyClientBranding() {
  return useQuery({
    queryKey: ["clients", "branding", "me"],
    queryFn: () => api.get<{ branding: ClientBrandingDto }>("/clients/branding").then((r) => r.branding),
    staleTime: 5 * 60_000,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientInput) => api.post<{ client: ClientDto }>("/clients", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateClientInput }) =>
      api.patch<{ client: ClientDto }>(`/clients/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClientBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateClientBrandingInput }) =>
      api.put<{ client: ClientDto }>(`/clients/${id}/branding`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients", "branding", "me"] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}
