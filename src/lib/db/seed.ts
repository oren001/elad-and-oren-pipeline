import { Client } from "pg";
import * as crypto from "crypto";

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(
    `INSERT INTO leads (id, name, email, business, description, budget, timeline, stage, assigned_to, project_value, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()),
            ($11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      crypto.randomUUID(),
      "The Brick Pit",
      "contact@thebrickpit.com.au",
      "The Brick Pit",
      "Full business management platform — customers, jobs, quoting, invoicing, delivery tracking, supplier payments, and Xero integration. Mobile PWA for yard workers. Phase 1 MVP in progress.",
      "TBD",
      "Phase 1 MVP ASAP",
      "in_build",
      "oren",
      0,
      crypto.randomUUID(),
      "Idan",
      "idan@example.com",
      "Idan Real Estate",
      "Real estate CRM with role-based permissions, multi-tenant architecture, and 6-year data retention compliance. Requirements gathered via voice transcription interviews (English + Hebrew). Build phase TBD.",
      "TBD",
      "Flexible",
      "scoping",
      "elad",
      0,
    ]
  );

  console.log("✓ Seeded 2 projects into Neon.");
  await client.end();
}

seed().catch(console.error);
