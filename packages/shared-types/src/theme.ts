/**
 * Variables de personalización visual del proceso (sección 12 del brief). Los valores por
 * defecto se dejan vacíos: el administrador los define en el editor de tema. Los `sampleValue`
 * mostrados aquí replican el ejemplo real observado en la colección Postman UATHA (colores de
 * marca, no secretos) y sirven únicamente como referencia visual en el theme builder.
 */
export interface ThemeVariableDefinition {
  key: string;
  label: string;
  description: string;
  sampleValue: string;
  /** Agrupación visual usada por el editor de tema (Constructor > Tema) para mostrar las 13
   * variables en secciones en vez de una lista plana larga. */
  group: string;
}

export const THEME_VARIABLES: readonly ThemeVariableDefinition[] = [
  {
    key: "--fad-common-primary-color",
    label: "Color primario",
    description: "Color principal de la interfaz del proceso.",
    sampleValue: "#005b95",
    group: "Colores principales",
  },
  {
    key: "--fad-common-secondary-color",
    label: "Color secundario",
    description: "Color de acento secundario.",
    sampleValue: "#00b5e1",
    group: "Colores principales",
  },
  {
    key: "--fad-common-tertiary-color",
    label: "Color terciario",
    description: "Color de acento terciario.",
    sampleValue: "#55b7e5",
    group: "Colores principales",
  },
  {
    key: "--fad-common-successful-color",
    label: "Color de éxito",
    description: "Color usado para estados exitosos.",
    sampleValue: "#149c0d",
    group: "Colores principales",
  },
  {
    key: "--fad-common-primary-button-background-color",
    label: "Fondo botón primario",
    description: "Color de fondo del botón principal.",
    sampleValue: "#003e7f",
    group: "Botón primario",
  },
  {
    key: "--fad-common-primary-button-label-color",
    label: "Texto botón primario",
    description: "Color del texto del botón principal.",
    sampleValue: "#FFFFFF",
    group: "Botón primario",
  },
  {
    key: "--fad-common-secondary-button-background-color",
    label: "Fondo botón secundario",
    description: "Color de fondo del botón secundario.",
    sampleValue: "#FFFFFF",
    group: "Botón secundario",
  },
  {
    key: "--fad-common-secondary-button-label-color",
    label: "Texto botón secundario",
    description: "Color del texto del botón secundario.",
    sampleValue: "#003e7f",
    group: "Botón secundario",
  },
  {
    key: "--fad-common-secondary-button-border-color",
    label: "Borde botón secundario",
    description: "Color de borde del botón secundario.",
    sampleValue: "#003e7f",
    group: "Botón secundario",
  },
  {
    key: "--fad-common-button-common-background-color-disabled",
    label: "Fondo botón deshabilitado",
    description: "Color de fondo de botones deshabilitados.",
    sampleValue: "#868686",
    group: "Botones deshabilitados",
  },
  {
    key: "--fad-common-button-common-label-color-disabled",
    label: "Texto botón deshabilitado",
    description: "Color del texto de botones deshabilitados.",
    sampleValue: "#FFFFFF",
    group: "Botones deshabilitados",
  },
  {
    key: "--fad-common-button-common-border-radius",
    label: "Radio de borde de botones",
    description: "Radio de esquina aplicado a los botones (ej. 15px).",
    sampleValue: "15px",
    group: "Otros",
  },
  {
    key: "--fad-common-legends-color",
    label: "Color de leyendas",
    description: "Color de textos secundarios/leyendas.",
    sampleValue: "#ffffff",
    group: "Otros",
  },
] as const;

/**
 * Valores iniciales sugeridos, NO una relación fija proveedor↔ID: el propio PDF se contradice
 * (el texto dice "Acuant siempre será 1" y "Regula siempre será 1", pero el JSON de ejemplo de
 * la sección 3.3 usa `providerId: 2` para Acuant y el de la sección 3.4 usa `providerId: 1`
 * para Regula). Se usan los valores de los ejemplos JSON (evidencia más concreta) como
 * semilla, pero un administrador debe poder cambiarlos en Catálogos sin tocar código.
 */
export const DEFAULT_PROVIDER_CATALOG = [
  {
    providerKey: "acuant",
    providerLabel: "Acuant",
    providerType: "captureId",
    defaultProviderId: 2,
    enabled: true,
  },
  {
    providerKey: "regula",
    providerLabel: "Regula",
    providerType: "captureId",
    defaultProviderId: 1,
    enabled: true,
  },
] as const;
