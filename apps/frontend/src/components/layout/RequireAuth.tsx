import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { useBootstrapStatus } from "../../features/auth/useBootstrapStatus";
import { FullPageSpinner } from "./FullPageSpinner";
import { AppShell } from "./AppShell";

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const bootstrap = useBootstrapStatus();

  if (isLoading || bootstrap.isLoading) return <FullPageSpinner />;
  if (bootstrap.data?.needsBootstrap) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;

  return <AppShell />;
}
