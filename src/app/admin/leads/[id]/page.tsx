export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { STAGES } from "@/lib/db/schema";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { moveStage, addNote, updateLead, deleteLead } from "@/lib/actions/leads";
import { dateShort, dateTime, money } from "@/lib/formatting";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

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

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, id));

  if (!lead) notFound();

  const leadNotes = await db
    .select()
    .from(schema.notes)
    .where(eq(schema.notes.leadId, id))
    .orderBy(asc(schema.notes.createdAt));

  return (
    <div className="flex flex-col h-full">
      <TopBar title={lead.name} subtitle={lead.business ?? lead.email} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          {/* back */}
          <Link href="/admin" className="btn-ghost text-ink-500 -ml-2 -mt-2 inline-flex">
            <ArrowLeft size={16} />
            Pipeline
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left — lead info */}
            <div className="lg:col-span-2 space-y-5">
              {/* Intake details */}
              <div className="card p-5">
                <h2 className="font-semibold text-ink-800 mb-4">Request details</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="label mb-0.5">Name</dt>
                    <dd className="text-sm text-ink-800">{lead.name}</dd>
                  </div>
                  <div>
                    <dt className="label mb-0.5">Email</dt>
                    <dd className="text-sm">
                      <a href={`mailto:${lead.email}`} className="text-brand hover:underline">
                        {lead.email}
                      </a>
                    </dd>
                  </div>
                  {lead.business && (
                    <div>
                      <dt className="label mb-0.5">Business</dt>
                      <dd className="text-sm text-ink-800">{lead.business}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="label mb-0.5">Project description</dt>
                    <dd className="text-sm text-ink-800 whitespace-pre-wrap">{lead.description}</dd>
                  </div>
                  {lead.budget && (
                    <div>
                      <dt className="label mb-0.5">Budget</dt>
                      <dd className="text-sm text-ink-800">{lead.budget}</dd>
                    </div>
                  )}
                  {lead.timeline && (
                    <div>
                      <dt className="label mb-0.5">Timeline</dt>
                      <dd className="text-sm text-ink-800">{lead.timeline}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="label mb-0.5">Received</dt>
                    <dd className="text-sm text-ink-500">{dateShort(lead.createdAt)}</dd>
                  </div>
                </dl>
              </div>

              {/* Admin fields */}
              <div className="card p-5">
                <h2 className="font-semibold text-ink-800 mb-4">Admin fields</h2>
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    const valueStr = fd.get("projectValue") as string;
                    await updateLead(id, {
                      assignedTo: (fd.get("assignedTo") as string) || null,
                      proposalUrl: (fd.get("proposalUrl") as string) || null,
                      contractUrl: (fd.get("contractUrl") as string) || null,
                      projectValue: valueStr
                        ? Math.round(parseFloat(valueStr) * 100)
                        : null,
                    });
                  }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label block mb-1" htmlFor="assignedTo">
                        Assigned to
                      </label>
                      <select
                        id="assignedTo"
                        name="assignedTo"
                        defaultValue={lead.assignedTo ?? ""}
                        className="input"
                      >
                        <option value="">Unassigned</option>
                        <option value="oren">Oren</option>
                        <option value="elad">Elad</option>
                      </select>
                    </div>
                    <div>
                      <label className="label block mb-1" htmlFor="projectValue">
                        Project value (AUD)
                      </label>
                      <input
                        id="projectValue"
                        name="projectValue"
                        type="number"
                        step="0.01"
                        defaultValue={
                          lead.projectValue ? lead.projectValue / 100 : ""
                        }
                        className="input"
                        placeholder="e.g. 5000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label block mb-1" htmlFor="proposalUrl">
                      Proposal URL
                    </label>
                    <input
                      id="proposalUrl"
                      name="proposalUrl"
                      type="url"
                      defaultValue={lead.proposalUrl ?? ""}
                      className="input"
                      placeholder="https://docs.google.com/..."
                    />
                  </div>
                  <div>
                    <label className="label block mb-1" htmlFor="contractUrl">
                      Contract URL
                    </label>
                    <input
                      id="contractUrl"
                      name="contractUrl"
                      type="url"
                      defaultValue={lead.contractUrl ?? ""}
                      className="input"
                      placeholder="https://..."
                    />
                  </div>
                  <button type="submit" className="btn-soft">
                    Save
                  </button>
                </form>

                {lead.projectValue && (
                  <p className="text-sm text-ink-500 mt-3">
                    Value: <span className="font-semibold text-ink-800">{money(lead.projectValue)}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Right — stage + notes */}
            <div className="space-y-5">
              {/* Stage mover */}
              <div className="card p-5">
                <h2 className="font-semibold text-ink-800 mb-3">Stage</h2>
                <div className="mb-3">
                  <StatusBadge status={lead.stage} />
                </div>
                <div className="flex flex-col gap-1.5">
                  {STAGES.map((stage) => (
                    <form key={stage} action={moveStage.bind(null, id, stage)}>
                      <button
                        type="submit"
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                          lead.stage === stage
                            ? "bg-brand text-white font-medium"
                            : "hover:bg-ink-100 text-ink-600"
                        }`}
                      >
                        {STAGE_LABELS[stage]}
                      </button>
                    </form>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="card p-5">
                <h2 className="font-semibold text-ink-800 mb-3">Notes</h2>
                <div className="space-y-3 mb-4">
                  {leadNotes.length === 0 && (
                    <p className="text-xs text-ink-400">No notes yet.</p>
                  )}
                  {leadNotes.map((note) => (
                    <div key={note.id} className="bg-ink-50 rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-ink-600 capitalize">
                          {note.author}
                        </span>
                        <span className="text-[10px] text-ink-400">
                          {dateTime(note.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-ink-700 whitespace-pre-wrap">{note.body}</p>
                    </div>
                  ))}
                </div>
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    const author = fd.get("author") as string;
                    const body = fd.get("body") as string;
                    await addNote(id, author, body);
                  }}
                  className="space-y-2"
                >
                  <select name="author" className="input text-xs" defaultValue="oren">
                    <option value="oren">Oren</option>
                    <option value="elad">Elad</option>
                  </select>
                  <textarea
                    name="body"
                    rows={3}
                    required
                    className="input resize-none text-sm"
                    placeholder="Add a note…"
                  />
                  <button type="submit" className="btn-soft w-full justify-center">
                    Add note
                  </button>
                </form>
              </div>

              {/* Danger */}
              <div className="card p-5 border-red-100">
                <h2 className="font-semibold text-ink-800 mb-3">Danger zone</h2>
                <form action={deleteLead.bind(null, id)}>
                  <button
                    type="submit"
                    className="btn text-red-600 hover:bg-red-50 w-full justify-center"
                  >
                    Mark as cancelled
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
