import Link from "next/link";
import type { Lead } from "@/lib/db/schema";
import { StatusBadge } from "./StatusBadge";
import { dateShort } from "@/lib/formatting";

const STAGE_LABELS: Record<string, string> = {
  new_lead: "New Lead",
  scoping: "Scoping",
  proposal_sent: "Proposal Sent",
  approved: "Approved",
  in_build: "In Build",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

export function StageColumn({ stage, leads }: { stage: string; leads: Lead[] }) {
  return (
    <div className="min-w-[220px] max-w-[220px] flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-ink-600 uppercase tracking-wide">
          {STAGE_LABELS[stage] ?? stage}
        </span>
        {leads.length > 0 && (
          <span className="badge-gray text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
            {leads.length}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/admin/leads/${lead.id}`}
            className="card p-3 hover:shadow-md transition block"
          >
            <div className="font-medium text-sm text-ink-800 truncate">{lead.name}</div>
            {lead.business && (
              <div className="text-xs text-ink-400 truncate mt-0.5">{lead.business}</div>
            )}
            <div className="flex items-center justify-between mt-2 gap-1 flex-wrap">
              {lead.budget && (
                <span className="text-xs text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">
                  {lead.budget}
                </span>
              )}
              <span className="text-[10px] text-ink-400 ml-auto">{dateShort(lead.createdAt)}</span>
            </div>
          </Link>
        ))}
        {leads.length === 0 && (
          <div className="text-xs text-ink-300 text-center py-6 border border-dashed border-ink-200 rounded-lg">
            Empty
          </div>
        )}
      </div>
    </div>
  );
}
