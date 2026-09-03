import { z } from "zod";
import { USER_ROLES } from "@fad-console/shared-types";

const PASSWORD_MIN = 10;

export const CreateUserInputSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(150),
  email: z.string().email("Correo inválido").max(200),
  password: z.string().min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`),
  role: z.enum(USER_ROLES),
  active: z.boolean().default(true),
  /** `null`/ausente = usuario de plataforma (solo un ADMIN de plataforma puede crear uno así;
   * ver clients/client-scope.ts). Con un valor, el usuario queda confinado a ese cliente. */
  clientId: z.string().min(1).optional().nullable(),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const UpdateUserInputSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  role: z.enum(USER_ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(PASSWORD_MIN).optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const BootstrapAdminInputSchema = CreateUserInputSchema.omit({ role: true, active: true });
export type BootstrapAdminInput = z.infer<typeof BootstrapAdminInputSchema>;

export const ForgotPasswordInputSchema = z.object({
  email: z.string().email("Correo inválido"),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  password: z.string().min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
