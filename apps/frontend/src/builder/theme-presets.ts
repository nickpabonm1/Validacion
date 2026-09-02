import type { ThemeVariable } from "@fad-console/validation-schemas";

export interface ThemePreset {
  name: string;
  description: string;
  theme: ThemeVariable[];
}

/**
 * Combinaciones completas de las 13 variables `--fad-*` listas para aplicar con un clic, para que
 * configurar un tema visual básico no requiera escribir 13 valores CSS uno por uno. El primer
 * preset reproduce los valores de ejemplo de la colección Postman UATHA (ver
 * `packages/shared-types/src/theme.ts`); los demás son combinaciones nuevas con buen contraste.
 */
export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    name: "Azul corporativo",
    description: "Los valores de ejemplo documentados (colección UATHA).",
    theme: [
      { key: "--fad-common-primary-color", value: "#005b95" },
      { key: "--fad-common-secondary-color", value: "#00b5e1" },
      { key: "--fad-common-tertiary-color", value: "#55b7e5" },
      { key: "--fad-common-successful-color", value: "#149c0d" },
      { key: "--fad-common-primary-button-background-color", value: "#003e7f" },
      { key: "--fad-common-primary-button-label-color", value: "#ffffff" },
      { key: "--fad-common-secondary-button-background-color", value: "#ffffff" },
      { key: "--fad-common-secondary-button-label-color", value: "#003e7f" },
      { key: "--fad-common-secondary-button-border-color", value: "#003e7f" },
      { key: "--fad-common-button-common-background-color-disabled", value: "#868686" },
      { key: "--fad-common-button-common-label-color-disabled", value: "#ffffff" },
      { key: "--fad-common-button-common-border-radius", value: "15px" },
      { key: "--fad-common-legends-color", value: "#ffffff" },
    ],
  },
  {
    name: "Verde corporativo",
    description: "Alternativa en tonos verdes, mismo esquema de contraste.",
    theme: [
      { key: "--fad-common-primary-color", value: "#0f6b3d" },
      { key: "--fad-common-secondary-color", value: "#3fae6a" },
      { key: "--fad-common-tertiary-color", value: "#8ad1a5" },
      { key: "--fad-common-successful-color", value: "#149c0d" },
      { key: "--fad-common-primary-button-background-color", value: "#0a4d2c" },
      { key: "--fad-common-primary-button-label-color", value: "#ffffff" },
      { key: "--fad-common-secondary-button-background-color", value: "#ffffff" },
      { key: "--fad-common-secondary-button-label-color", value: "#0a4d2c" },
      { key: "--fad-common-secondary-button-border-color", value: "#0a4d2c" },
      { key: "--fad-common-button-common-background-color-disabled", value: "#8a8a8a" },
      { key: "--fad-common-button-common-label-color-disabled", value: "#ffffff" },
      { key: "--fad-common-button-common-border-radius", value: "8px" },
      { key: "--fad-common-legends-color", value: "#ffffff" },
    ],
  },
  {
    name: "Naranja cálido",
    description: "Alto contraste, botones redondeados.",
    theme: [
      { key: "--fad-common-primary-color", value: "#c2540a" },
      { key: "--fad-common-secondary-color", value: "#f28c28" },
      { key: "--fad-common-tertiary-color", value: "#f6b866" },
      { key: "--fad-common-successful-color", value: "#149c0d" },
      { key: "--fad-common-primary-button-background-color", value: "#8f3d06" },
      { key: "--fad-common-primary-button-label-color", value: "#ffffff" },
      { key: "--fad-common-secondary-button-background-color", value: "#ffffff" },
      { key: "--fad-common-secondary-button-label-color", value: "#8f3d06" },
      { key: "--fad-common-secondary-button-border-color", value: "#8f3d06" },
      { key: "--fad-common-button-common-background-color-disabled", value: "#8a8a8a" },
      { key: "--fad-common-button-common-label-color-disabled", value: "#ffffff" },
      { key: "--fad-common-button-common-border-radius", value: "24px" },
      { key: "--fad-common-legends-color", value: "#ffffff" },
    ],
  },
  {
    name: "Oscuro / alto contraste",
    description: "Fondo oscuro con acentos claros, botones cuadrados.",
    theme: [
      { key: "--fad-common-primary-color", value: "#111827" },
      { key: "--fad-common-secondary-color", value: "#374151" },
      { key: "--fad-common-tertiary-color", value: "#6b7280" },
      { key: "--fad-common-successful-color", value: "#22c55e" },
      { key: "--fad-common-primary-button-background-color", value: "#f9fafb" },
      { key: "--fad-common-primary-button-label-color", value: "#111827" },
      { key: "--fad-common-secondary-button-background-color", value: "#111827" },
      { key: "--fad-common-secondary-button-label-color", value: "#f9fafb" },
      { key: "--fad-common-secondary-button-border-color", value: "#f9fafb" },
      { key: "--fad-common-button-common-background-color-disabled", value: "#4b5563" },
      { key: "--fad-common-button-common-label-color-disabled", value: "#9ca3af" },
      { key: "--fad-common-button-common-border-radius", value: "2px" },
      { key: "--fad-common-legends-color", value: "#f9fafb" },
    ],
  },
];
