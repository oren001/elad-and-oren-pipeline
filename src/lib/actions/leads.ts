"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Stage } from "@/lib/db/schema";

export async function moveStage(leadId: string, stage: Stage) {
  const db = getDb();
  await db
    .update(schema.leads)
    .set({ stage, updatedAt: new Date() })
    .where(eq(schema.leads.id, leadId));
  revalidatePath("/admin");
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function addNote(leadId: string, author: string, body: string) {
  if (!body.trim()) return;
  const db = getDb();
  await db.insert(schema.notes).values({
    id: crypto.randomUUID(),
    leadId,
    author,
    body: body.trim(),
  });
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function updateLead(
  leadId: string,
  data: {
    assignedTo?: string | null;
    proposalUrl?: string | null;
    contractUrl?: string | null;
    projectValue?: number | null;
  }
) {
  const db = getDb();
  await db
    .update(schema.leads)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.leads.id, leadId));
  revalidatePath("/admin");
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function deleteLead(leadId: string) {
  const db = getDb();
  await db
    .update(schema.leads)
    .set({ stage: "cancelled", updatedAt: new Date() })
    .where(eq(schema.leads.id, leadId));
  redirect("/admin");
}
