import type { ReactNode } from "react";
import type { UserRole } from "@fad-console/shared-types";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { EmptyState } from "../ui/misc";

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-8 w-8" />}
        title="No tienes permisos para ver esta sección"
        description={`Se requiere el rol: ${roles.join(" o ")}.`}
      />
    );
  }
  return <>{children}</>;
}
