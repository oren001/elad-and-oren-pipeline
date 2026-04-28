import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const id = () => text("id").primaryKey();
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export type Stage =
  | "new_lead"
  | "scoping"
  | "proposal_sent"
  | "approved"
  | "in_build"
  | "review"
  | "done"
  | "cancelled";

export const STAGES: Stage[] = [
  "new_lead",
  "scoping",
  "proposal_sent",
  "approved",
  "in_build",
  "review",
  "done",
  "cancelled",
];

export const leads = sqliteTable("leads", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  business: text("business"),
  description: text("description").notNull(),
  budget: text("budget"),
  timeline: text("timeline"),
  stage: text("stage", {
    enum: [
      "new_lead",
      "scoping",
      "proposal_sent",
      "approved",
      "in_build",
      "review",
      "done",
      "cancelled",
    ],
  })
    .notNull()
    .default("new_lead"),
  assignedTo: text("assigned_to"),
  proposalUrl: text("proposal_url"),
  contractUrl: text("contract_url"),
  projectValue: integer("project_value"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const notes = sqliteTable("notes", {
  id: id(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  author: text("author").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export type Lead = typeof leads.$inferSelect;
export type Note = typeof notes.$inferSelect;
