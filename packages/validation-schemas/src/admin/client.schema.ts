import { z } from "zod";
import { CLIENT_EXTERNAL_DB_ENGINES } from "@fad-console/shared-types";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DATA_URL_IMAGE = /^data:image\/(png|jpe?g|svg\+xml|webp|x-icon);base64,/;

export const CreateClientInputSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(150),
  parentClientId: z.string().min(1).optional().nullable(),
});
export type CreateClientInput = z.infer<typeof CreateClientInputSchema>;

export const UpdateClientInputSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  active: z.boolean().optional(),
});
export type UpdateClientInput = z.infer<typeof UpdateClientInputSchema>;

/** Vacío (`""`) borra el logo/favicon actual; `undefined` = no cambiar. */
export const UpdateClientBrandingInputSchema = z.object({
  logoDataUrl: z.union([z.literal(""), z.string().regex(DATA_URL_IMAGE, "Debe ser una imagen codificada en base64")]).optional(),
  faviconDataUrl: z.union([z.literal(""), z.string().regex(DATA_URL_IMAGE, "Debe ser una imagen codificada en base64")]).optional(),
  primaryColor: z.union([z.literal(""), z.string().regex(HEX_COLOR, "Debe ser un color hex, p. ej. #1d4ed8")]).optional(),
});
export type UpdateClientBrandingInput = z.infer<typeof UpdateClientBrandingInputSchema>;

/** Vacío (`""`) borra la plantilla propia del cliente (vuelve a heredar); `undefined` = no
 * cambiar. */
export const UpdateClientEmailTemplateInputSchema = z.object({
  emailSubjectTemplate: z.union([z.literal(""), z.string().min(1).max(300)]).optional(),
  emailBodyTemplate: z.union([z.literal(""), z.string().min(1).max(20000)]).optional(),
});
export type UpdateClientEmailTemplateInput = z.infer<typeof UpdateClientEmailTemplateInputSchema>;

/** Conexión a la base de datos EXTERNA propia de un cliente (MongoDB o Neo4j) — `engine: null`
 * borra la conexión configurada (el cliente deja de tener una). `password` vacío = no cambiar la
 * ya guardada, igual que otras credenciales de esta consola. */
export const UpdateClientDatabaseConnectionInputSchema = z.object({
  engine: z.enum(CLIENT_EXTERNAL_DB_ENGINES).nullable(),
  connectionUri: z.string().min(1).max(2000).optional().nullable(),
  username: z.string().max(300).optional().nullable(),
  password: z.string().max(500).optional(),
  databaseName: z.string().max(300).optional().nullable(),
});
export type UpdateClientDatabaseConnectionInput = z.infer<typeof UpdateClientDatabaseConnectionInputSchema>;

/** Igual forma, para "Probar conexión" sin necesariamente guardar. */
export const TestClientDatabaseConnectionInputSchema = z.object({
  engine: z.enum(CLIENT_EXTERNAL_DB_ENGINES),
  connectionUri: z.string().min(1).max(2000).optional().nullable(),
  username: z.string().max(300).optional().nullable(),
  password: z.string().max(500).optional(),
  databaseName: z.string().max(300).optional().nullable(),
});
export type TestClientDatabaseConnectionInput = z.infer<typeof TestClientDatabaseConnectionInputSchema>;
