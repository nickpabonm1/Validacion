import { z } from "zod";

const CSS_COLOR_OR_SIZE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|\d+(\.\d+)?(px|rem|em|%))$/;

export const ThemeVariableSchema = z.object({
  key: z.string().regex(/^--fad-[a-z0-9-]+$/, "Debe ser una variable CSS --fad-*"),
  value: z.string().min(1).regex(CSS_COLOR_OR_SIZE, "Valor CSS inválido (color o medida)"),
});
export type ThemeVariable = z.infer<typeof ThemeVariableSchema>;

export const HeaderItemSchema = z.object({
  type: z.literal("IMG"),
  content: z.string().url("Debe ser una URL válida"),
});
export type HeaderItem = z.infer<typeof HeaderItemSchema>;

export const CustomizationSchema = z.object({
  theme: z.array(ThemeVariableSchema).default([]),
  header: z.array(HeaderItemSchema).default([]),
});
export type Customization = z.infer<typeof CustomizationSchema>;
