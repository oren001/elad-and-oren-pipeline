import { db, schema } from "./index";

async function seed() {
  await db.insert(schema.leads).values([
    {
      id: crypto.randomUUID(),
      name: "The Brick Pit",
      email: "contact@thebrickpit.com.au",
      business: "The Brick Pit",
      description:
        "Full business management platform — customers, jobs, quoting, invoicing, delivery tracking, supplier payments, and Xero integration. Mobile PWA for yard workers. Phase 1 MVP in progress.",
      budget: "TBD",
      timeline: "Phase 1 MVP ASAP",
      stage: "in_build",
      assignedTo: "oren",
      projectValue: 0,
    },
    {
      id: crypto.randomUUID(),
      name: "Idan",
      email: "idan@example.com",
      business: "Idan Real Estate",
      description:
        "Real estate CRM with role-based permissions, multi-tenant architecture, and 6-year data retention compliance. Requirements gathered via voice transcription interviews (English + Hebrew). Build phase TBD.",
      budget: "TBD",
      timeline: "Flexible",
      stage: "scoping",
      assignedTo: "elad",
      projectValue: 0,
    },
  ]);

  console.log("Seeded 2 projects.");
}

seed().catch(console.error);
