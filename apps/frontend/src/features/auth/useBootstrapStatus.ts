import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

export function useBootstrapStatus() {
  return useQuery({
    queryKey: ["auth", "bootstrap-status"],
    queryFn: () => api.get<{ needsBootstrap: boolean }>("/auth/bootstrap/status"),
    staleTime: 10_000,
  });
}
