import { useEffect, useState } from "react";
import { Textarea } from "../../components/ui/input";

interface JsonTextEditorProps {
  label: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function JsonTextEditor({ label, value, onChange }: JsonTextEditorProps) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <Textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          try {
            const parsed = text.trim() === "" ? {} : JSON.parse(text);
            if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
              setError("Debe ser un objeto JSON (por ejemplo: {})");
              return;
            }
            setError(null);
            onChange(parsed as Record<string, unknown>);
          } catch {
            setError("JSON inválido");
          }
        }}
        spellCheck={false}
        className="text-xs"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
