import { Spinner } from "../ui/misc";

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Spinner className="h-6 w-6 text-primary" />
    </div>
  );
}
