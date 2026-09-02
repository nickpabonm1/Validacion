import { useMutation } from "@tanstack/react-query";
import type { WebSdkShareLinkDto, WebSdkPublicShareInfoDto, WebSdkSessionInitDto, WebSdkCheckResultDto } from "@fad-console/shared-types";
import type {
  WebSdkShareLinkInput,
  WebSdkShareSendInput,
  WebSdkAcuantResultInput,
  WebSdkFacetecResultInput,
} from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

export function useCreateShareLink() {
  return useMutation({
    mutationFn: (input: WebSdkShareLinkInput) => api.post<{ shareLink: WebSdkShareLinkDto }>("/websdk-share/links", input),
  });
}

export function useSendShareLink() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WebSdkShareSendInput }) =>
      api.post<{ delivered: boolean; messageId: string }>(`/websdk-share/links/${id}/send`, input),
  });
}

/** Llamadas públicas (sin cookie de sesión) que usa `/v/:token` — el mismo `api` client funciona
 * porque estas rutas del backend no requieren `requireAuth`. */
export function usePublicShareInfo() {
  return useMutation({
    mutationFn: (token: string) => api.get<{ info: WebSdkPublicShareInfoDto }>(`/public/websdk-share/${token}`),
  });
}

export function usePublicShareStart() {
  return useMutation({
    mutationFn: (token: string) =>
      api.post<{ executionId: string; sdkInit: WebSdkSessionInitDto }>(`/public/websdk-share/${token}/start`),
  });
}

export function usePublicShareAcuantResult() {
  return useMutation({
    mutationFn: ({ token, input }: { token: string; input: WebSdkAcuantResultInput }) =>
      api.post<WebSdkCheckResultDto>(`/public/websdk-share/${token}/acuant-result`, input),
  });
}

export function usePublicShareFacetecResult() {
  return useMutation({
    mutationFn: ({ token, input }: { token: string; input: WebSdkFacetecResultInput }) =>
      api.post<{ ok: true }>(`/public/websdk-share/${token}/facetec-result`, input),
  });
}

export function usePublicShareComplete() {
  return useMutation({
    mutationFn: (token: string) => api.post<{ executionId: string }>(`/public/websdk-share/${token}/complete`),
  });
}
