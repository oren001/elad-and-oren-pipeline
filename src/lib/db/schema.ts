import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey();
const createdAt = () => timestamp("created_at").notNull().defaultNow();
const updatedAt = () => timestamp("updated_at").notNull().defaultNow();

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

export const leads = pgTable("leads", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  business: text("business"),
  description: text("description").notNull(),
  budget: text("budget"),
  timeline: text("timeline"),
  stage: text("stage").$type<Stage>().notNull().default("new_lead"),
  assignedTo: text("assigned_to"),
  proposalUrl: text("proposal_url"),
  contractUrl: text("contract_url"),
  projectValue: integer("project_value"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const notes = pgTable("notes", {
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
