export const dynamic = "force-dynamic";

import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { STAGES } from "@/lib/db/schema";
import { TopBar } from "@/components/TopBar";
import { StageColumn } from "@/components/StageColumn";

export default async function PipelinePage() {
  const db = getDb();
  const allLeads = await db
    .select()
    .from(schema.leads)
    .orderBy(desc(schema.leads.updatedAt));

  const byStage = STAGES.reduce(
    (acc, stage) => {
      acc[stage] = allLeads.filter((l) => l.stage === stage);
      return acc;
    },
    {} as Record<string, typeof allLeads>
  );

  const activeCount = allLeads.filter(
    (l) => l.stage !== "done" && l.stage !== "cancelled"
  ).length;
  const newCount = byStage["new_lead"]?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Pipeline"
        subtitle={`${activeCount} active lead${activeCount !== 1 ? "s" : ""}${newCount > 0 ? ` · ${newCount} new` : ""}`}
      />
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {STAGES.map((stage) => (
            <StageColumn key={stage} stage={stage} leads={byStage[stage] ?? []} />
          ))}
        </div>
      </div>
    </div>
  );
}
