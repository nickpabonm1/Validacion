import type { NormalizedValidationDetail } from "@fad-console/shared-types";
import { MapPin, Smartphone, Wifi, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "../ui/misc";
import { OcrTable } from "./OcrTable";
import { ImageGallery } from "./ImageGallery";
import { ExternalValidationCard } from "./ExternalValidationCard";
import { DocumentChecksReport } from "./DocumentChecksReport";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * Reporte automático de los datos que trae la respuesta de FAD, ya organizados por tipo de
 * información (cliente, documento/OCR, imágenes, biometría, dispositivo, alertas, validaciones
 * externas) — no un volcado de JSON. Funciona siempre a partir del dato normalizado, sin
 * requerir que un administrador configure primero una vista de respuesta.
 */
export function ReportView({ detail, executionId }: { detail: NormalizedValidationDetail; executionId: string }) {
  const hasClassification = detail.classification && Object.keys(detail.classification).length > 0;
  const hasOcr = detail.ocr && Object.keys(detail.ocr).length > 0;
  const hasDevice = detail.device && Object.keys(detail.device).length > 0;
  const hasNetwork = detail.network && Object.keys(detail.network).length > 0;
  const hasClientDetails = detail.clientDetails && Object.keys(detail.clientDetails).length > 0;
  const hasGovernmentValidation = detail.governmentValidation && Object.keys(detail.governmentValidation).length > 0;
  const hasNaatCheck = detail.naatCheckResult && Object.keys(detail.naatCheckResult).length > 0;
  const externalEntries = Object.entries(detail.externalValidations ?? {});

  const isEmpty =
    !hasClassification &&
    !hasOcr &&
    detail.mediaAssets.length === 0 &&
    detail.files.length === 0 &&
    detail.comparisonPercentage === null &&
    !hasDevice &&
    !hasNetwork &&
    !detail.location &&
    detail.alerts.length === 0 &&
    detail.documentChecks.length === 0 &&
    !hasClientDetails &&
    !hasGovernmentValidation &&
    !hasNaatCheck &&
    externalEntries.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        title="Todavía no hay datos de resultado"
        description="Esta información se completa cuando FAD entrega el detalle de la validación. Usa «Consultar estado» para actualizar."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cliente y proceso</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Stat label="Cliente" value={detail.client.nameMasked} />
          <Stat label="Correo" value={detail.client.emailMasked} />
          <Stat label="Inicio" value={formatDate(detail.startedAt)} />
          <Stat label="Finalización" value={formatDate(detail.completedAt)} />
          {detail.comparisonPercentage !== null ? (
            <Stat label="% Comparación biométrica" value={`${detail.comparisonPercentage.toFixed(2)}%`} />
          ) : null}
        </CardContent>
        {hasClientDetails ? (
          <CardContent className="border-t border-border pt-4">
            <OcrTable data={detail.clientDetails!} title="Datos del cliente (Registraduría/CURP/RFC)" />
          </CardContent>
        ) : null}
      </Card>

      {hasClassification || hasOcr ? (
        <Card>
          <CardHeader>
            <CardTitle>Documento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasClassification ? <OcrTable data={detail.classification!} title="Clasificación" /> : null}
            {hasOcr ? <OcrTable data={detail.ocr!} title="Datos OCR" /> : null}
          </CardContent>
        </Card>
      ) : null}

      <DocumentChecksReport checks={detail.documentChecks} />

      {hasGovernmentValidation || hasNaatCheck ? (
        <Card>
          <CardHeader>
            <CardTitle>Validación con gobierno / NAAT-CHECK</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasGovernmentValidation ? <OcrTable data={detail.governmentValidation!} title="Folios y respuestas de gobierno" /> : null}
            {hasNaatCheck ? <OcrTable data={detail.naatCheckResult!} title="NAAT-CHECK" /> : null}
          </CardContent>
        </Card>
      ) : null}

      {detail.mediaAssets.length > 0 || detail.files.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Imágenes y archivos</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageGallery mediaAssets={detail.mediaAssets} files={detail.files} executionId={executionId} />
          </CardContent>
        </Card>
      ) : null}

      {hasDevice || hasNetwork || detail.location ? (
        <Card>
          <CardHeader>
            <CardTitle>Dispositivo, red y ubicación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {hasDevice ? (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" /> Dispositivo
                </p>
                <OcrTable data={detail.device!} />
              </div>
            ) : null}
            {hasNetwork ? (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Wifi className="h-3.5 w-3.5" /> Red
                </p>
                <OcrTable data={detail.network!} />
              </div>
            ) : null}
            {detail.location ? (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Ubicación
                </p>
                <p className="font-mono text-sm">
                  {detail.location.latitude ?? "?"}, {detail.location.longitude ?? "?"}
                </p>
                <a
                  className="text-xs text-primary underline"
                  href={`https://www.google.com/maps?q=${detail.location.latitude},${detail.location.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver en el mapa
                </a>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {detail.alerts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.alerts.map((alert, index) => {
              const record = alert && typeof alert === "object" && !Array.isArray(alert) ? (alert as Record<string, unknown>) : null;
              const nameKey = record ? Object.keys(record).find((k) => /^(name|title|level|type)$/i.test(k)) : undefined;
              const descriptionKey = record
                ? Object.keys(record).find((k) => /^(description|message|detail|msg)$/i.test(k))
                : undefined;
              const name = nameKey ? formatValueSafely(record![nameKey]) : `Alerta ${index + 1}`;
              const description = descriptionKey ? formatValueSafely(record![descriptionKey]) : null;
              const otherEntries = record
                ? Object.entries(record).filter(([k]) => k !== nameKey && k !== descriptionKey)
                : [];
              return (
                <div key={index} className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                  <p className="font-medium">{name}</p>
                  {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
                  {!record ? <p className="text-xs text-muted-foreground">{formatValueSafely(alert)}</p> : null}
                  {otherEntries.length > 0 ? (
                    <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {otherEntries.map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt className="font-mono">{key}</dt>
                          <dd>{formatValueSafely(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {externalEntries.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Validaciones externas</p>
          {externalEntries.map(([key, value]) => (
            <ExternalValidationCard key={key} providerKey={key} data={(value ?? {}) as Record<string, unknown>} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatValueSafely(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
