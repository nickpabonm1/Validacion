import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@fad-console/ui";

type ToastTone = "success" | "warning" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const toneClasses: Record<ToastTone, string> = {
  success: "border-success/30 text-success",
  warning: "border-warning/30 text-warning",
  error: "border-destructive/30 text-destructive",
  info: "border-accent/30 text-accent",
};

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = ++counter;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {toasts.map((toast) => {
          const Icon = icons[toast.tone];
          return (
            <ToastPrimitive.Root
              key={toast.id}
              className={cn(
                "grid grid-cols-[auto_1fr] gap-3 rounded-lg border bg-card p-4 shadow-lg",
                "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-2",
                toneClasses[toast.tone],
              )}
              onOpenChange={(open) => {
                if (!open) setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }}
            >
              <Icon className="h-5 w-5" />
              <div>
                <ToastPrimitive.Title className="text-sm font-semibold text-foreground">
                  {toast.title}
                </ToastPrimitive.Title>
                {toast.description ? (
                  <ToastPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                    {toast.description}
                  </ToastPrimitive.Description>
                ) : null}
              </div>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
