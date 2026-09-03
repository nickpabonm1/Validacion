import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentCheckScoringConfigDto } from "@fad-console/shared-types";
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

export interface DocumentCheckScoringConfigInput {
  categoryWeights: Record<string, number>;
  passThreshold: number | null;
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
