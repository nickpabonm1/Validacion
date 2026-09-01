import { useNavigate } from "react-router-dom";
import { CompassIcon } from "lucide-react";
import { EmptyState } from "../components/ui/misc";
import { Button } from "../components/ui/button";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={<CompassIcon className="h-8 w-8" />}
      title="Página no encontrada"
      description="La ruta que buscas no existe o fue movida."
      action={<Button onClick={() => navigate("/")}>Volver al inicio</Button>}
    />
  );
}
