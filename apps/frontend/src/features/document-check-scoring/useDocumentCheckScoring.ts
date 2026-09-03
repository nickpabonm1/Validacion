import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentCheckScoringConfigDto } from "@fad-console/shared-types";
import type { DocumentCheckScoringConfigInput } from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

const QUERY_KEY = ["document-check-scoring"];

export function useDocumentCheckScoringConfig() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      api
        .get<{ documentCheckScoringConfig: DocumentCheckScoringConfigDto }>("/document-check-scoring")
        .then((r) => r.documentCheckScoringConfig),
  });
}

/** Nombres de característica ya observados en ejecuciones reales, agrupados por categoría — para
 * sugerir al configurar subpesos por característica en vez de que el operador tenga que adivinar
 * el nombre exacto que devuelve cada proveedor. */
export function useKnownDocumentCheckFeatures() {
  return useQuery({
    queryKey: ["document-check-scoring", "known-features"],
    queryFn: () =>
      api.get<{ knownFeatures: Record<string, string[]> }>("/document-check-scoring/known-features").then((r) => r.knownFeatures),
    staleTime: 60_000,
  });
}

export function useUpdateDocumentCheckScoringConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DocumentCheckScoringConfigInput) =>
      api
        .put<{ documentCheckScoringConfig: DocumentCheckScoringConfigDto }>("/document-check-scoring", input)
        .then((r) => r.documentCheckScoringConfig),
    onSuccess: (config) => queryClient.setQueryData(QUERY_KEY, config),
  });
}
