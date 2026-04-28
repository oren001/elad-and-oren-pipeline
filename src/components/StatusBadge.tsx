import { cn } from "@/lib/cn";

const map: Record<string, string> = {
  new_lead: "badge-blue",
  scoping: "badge-amber",
  proposal_sent: "badge-purple",
  approved: "badge-green",
  in_build: "badge-blue",
  review: "badge-amber",
  done: "badge-green",
  cancelled: "badge-red",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = map[status] ?? "badge-gray";
  const label = status.replace(/_/g, " ");
  return <span className={cn(cls, "capitalize")}>{label}</span>;
}
