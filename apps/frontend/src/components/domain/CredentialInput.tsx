import { useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";

interface CredentialInputProps {
  id: string;
  label: string;
  configured: boolean;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  hint?: string;
}

/** Campo de credencial: nunca recibe el valor guardado desde el backend (solo `configured`).
 * Vacío al editar = "conservar la credencial existente" (ver docs/security-decisions.md). */
export function CredentialInput({ id, label, configured, value, onChange, onClear, hint }: CredentialInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <Badge tone={configured ? "success" : "neutral"}>{configured ? "Configurado" : "No configurado"}</Badge>
      </div>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Input
            id={id}
            type={visible ? "text" : "password"}
            placeholder={configured ? "•••••••• (dejar vacío para conservar)" : "Sin configurar"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pr-9"
            autoComplete="off"
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar valor" : "Mostrar valor"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {configured && onClear ? (
          <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar ${label}`} onClick={onClear}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
