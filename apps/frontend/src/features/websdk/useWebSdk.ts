import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WebSdkSessionInitDto, WebSdkCheckResultDto } from "@fad-console/shared-types";
import type {
  WebSdkStartInput,
  WebSdkAcuantResultInput,
  WebSdkFacetecResultInput,
} from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";
import type { ExecutionDetailDto } from "../executions/useExecutions";

export function useStartWebSdk() {
  return useMutation({
    mutationFn: (input: WebSdkStartInput) =>
      api.post<{ executionId: string; sdkInit: WebSdkSessionInitDto }>("/executions/websdk/start", input),
  });
}

export function useSubmitAcuantResult() {
  return useMutation({
    mutationFn: ({ executionId, input }: { executionId: string; input: WebSdkAcuantResultInput }) =>
      api.post<WebSdkCheckResultDto>(`/executions/websdk/${executionId}/acuant-result`, input),
  });
}

export function useSubmitFacetecResult() {
  return useMutation({
    mutationFn: ({ executionId, input }: { executionId: string; input: WebSdkFacetecResultInput }) =>
      api.post<{ ok: true }>(`/executions/websdk/${executionId}/facetec-result`, input),
  });
}

export function useCompleteWebSdk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (executionId: string) =>
      api.post<{ execution: ExecutionDetailDto }>(`/executions/websdk/${executionId}/complete`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["executions"] }),
  });
}
