import { useQuery } from "@tanstack/react-query";
import type { ProviderCatalogEntryDto } from "@fad-console/shared-types";
import { api } from "../../lib/api-client";

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => api.get<{ providers: ProviderCatalogEntryDto[] }>("/providers").then((r) => r.providers),
  });
}
