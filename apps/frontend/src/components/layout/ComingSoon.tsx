import { Construction } from "lucide-react";
import { PageHeader } from "../ui/misc";
import { EmptyState } from "../ui/misc";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState icon={<Construction className="h-8 w-8" />} title="En construcción" description={description} />
    </div>
  );
}
