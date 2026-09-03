/**
 * Jerarquía de clientes (multi-tenant): ver `Client` en prisma/schema.prisma. Un cliente puede
 * tener clientes "hijos" (`parentClientId`), cada uno con sus propios usuarios y ambientes,
 * aislados del resto — y su propia marca (logo/color/favicon) que también puede definir para sus
 * hijos.
 */
export interface ClientDto {
  id: string;
  name: string;
  parentClientId: string | null;
  logoDataUrl: string | null;
  faviconDataUrl: string | null;
  primaryColor: string | null;
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
