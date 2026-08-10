import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

/**
 * Test-only Drizzle instance backed by an in-memory PGlite database.
 * Never touches `DATABASE_URL` — hermetic by construction.
 */
export async function createTestDb() {
  if (process.env.DATABASE_URL) {
    throw new Error(
      "createTestDb() must never run against a real DATABASE_URL — remove it from the test environment",
    );
  }

  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });

  return db;
}
