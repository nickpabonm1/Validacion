import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";

interface FieldChildProps {
  id?: string;
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const control =
    isValidElement<FieldChildProps>(children) && !children.props.id
      ? cloneElement(children as ReactElement<FieldChildProps>, { id })
      : children;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {control}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function InlineSwitchField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
