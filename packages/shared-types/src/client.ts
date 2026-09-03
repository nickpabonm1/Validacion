/**
 * Jerarquía de clientes (multi-tenant): ver `Client` en prisma/schema.prisma. Un cliente puede
 * tener clientes "hijos" (`parentClientId`), cada uno con sus propios usuarios y ambientes,
 * aislados del resto — y su propia marca (logo/color/favicon) que también puede definir para sus
 * hijos.
 */
/** Motor de base de datos EXTERNA que un cliente puede conectar (ver `ClientDto.externalDbEngine`)
 * — a diferencia de `DatabaseEngine`, aquí solo están los dos con soporte funcional real vía
 * driver nativo (sin Prisma): MongoDB y Neo4j. */
export const CLIENT_EXTERNAL_DB_ENGINES = ["MONGODB", "GRAPH_NEO4J"] as const;
export type ClientExternalDbEngine = (typeof CLIENT_EXTERNAL_DB_ENGINES)[number];

export interface ClientDto {
  id: string;
  name: string;
  parentClientId: string | null;
  logoDataUrl: string | null;
  faviconDataUrl: string | null;
  primaryColor: string | null;
  /** Valores PROPIOS del cliente (sin resolver herencia) — `null` = no definió su propia
   * plantilla, hereda la del padre más cercano que sí la tenga (ver `ClientEmailTemplateDto`
   * para la versión ya resuelta, usada al enviar un correo real). */
  emailSubjectTemplate: string | null;
  emailBodyTemplate: string | null;
  /** Conexión a una base de datos EXTERNA propia de este cliente (MongoDB o Neo4j) — no
   * hereda de un cliente padre (a diferencia de marca/plantilla): cada cliente que la necesite
   * la configura para sí mismo. `externalDbEngine: null` = sin conexión externa configurada. */
  externalDbEngine: ClientExternalDbEngine | null;
  externalDbConnectionUri: string | null;
  externalDbUsername: string | null;
  externalDbPasswordConfigured: boolean;
  externalDbDatabaseName: string | null;
  active: boolean;
  userCount: number;
  childCount: number;
  environmentCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Marca del cliente al que pertenece el usuario autenticado — usada por el frontend para
 * aplicar logo/color/favicon al cargar la sesión. `null` en cada campo = usar la marca por
 * defecto de la consola (usuario de plataforma, o cliente sin marca configurada). */
export interface ClientBrandingDto {
  clientId: string | null;
  clientName: string | null;
  logoDataUrl: string | null;
  faviconDataUrl: string | null;
  primaryColor: string | null;
}

/** Plantilla de correo YA RESUELTA (con herencia aplicada, o la plantilla por defecto de la
 * consola si ningún cliente en la cadena definió una propia) — lo que realmente se usa al enviar
 * el enlace de un proceso de validación. */
export interface ClientEmailTemplateDto {
  subject: string;
  bodyHtml: string;
  /** `true` cuando el cliente (o el usuario de plataforma) usa la plantilla por defecto de la
   * consola, sin personalizar nada todavía. */
  isDefault: boolean;
}
