import type { UserRole } from "@fad-console/shared-types";
import {
  LayoutDashboard,
  Blocks,
  FileText,
  PlayCircle,
  ListChecks,
  SlidersHorizontal,
  Webhook,
  Server,
  BookOpen,
  Users,
  Building2,
  ShieldCheck,
  Settings,
  Gauge,
  Mail,
  Database,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, roles: ["ADMIN", "OPERATOR", "AUDITOR", "LAUNCHER"] },
  { to: "/builder", label: "Constructor", icon: Blocks, roles: ["ADMIN", "OPERATOR"] },
  { to: "/templates", label: "Plantillas", icon: FileText, roles: ["ADMIN", "OPERATOR"] },
  { to: "/executions/new", label: "Nueva ejecución", icon: PlayCircle, roles: ["ADMIN", "OPERATOR", "LAUNCHER"] },
  { to: "/executions", label: "Validaciones", icon: ListChecks, roles: ["ADMIN", "OPERATOR", "AUDITOR", "LAUNCHER"] },
  { to: "/response-designer", label: "Diseñador de respuestas", icon: SlidersHorizontal, roles: ["ADMIN"] },
  { to: "/response-scoring", label: "Configuración de la respuesta", icon: Gauge, roles: ["ADMIN"] },
  { to: "/webhooks", label: "Webhooks", icon: Webhook, roles: ["ADMIN", "OPERATOR", "AUDITOR"] },
  { to: "/environments", label: "Ambientes", icon: Server, roles: ["ADMIN"] },
  { to: "/catalogs", label: "Catálogos", icon: BookOpen, roles: ["ADMIN"] },
  { to: "/clients", label: "Clientes", icon: Building2, roles: ["ADMIN"] },
  { to: "/users", label: "Usuarios", icon: Users, roles: ["ADMIN"] },
  { to: "/audit", label: "Auditoría", icon: ShieldCheck, roles: ["ADMIN", "AUDITOR"] },
  { to: "/messaging", label: "Mensajería", icon: Mail, roles: ["ADMIN"] },
  { to: "/database", label: "Base de datos", icon: Database, roles: ["ADMIN"] },
  { to: "/settings", label: "Configuración", icon: Settings, roles: ["ADMIN"] },
];
