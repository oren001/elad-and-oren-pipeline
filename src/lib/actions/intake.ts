"use server";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";

export async function submitLead(formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();

  if (!name || !email || !description) return;

  const id = crypto.randomUUID();
  await db.insert(schema.leads).values({
    id,
    name,
    email,
    business: (formData.get("business") as string | null)?.trim() || null,
    description,
    budget: (formData.get("budget") as string | null)?.trim() || null,
    timeline: (formData.get("timeline") as string | null)?.trim() || null,
  });

  redirect("/submitted");
}
