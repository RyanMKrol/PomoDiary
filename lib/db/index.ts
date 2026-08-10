import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let db: Db | undefined;

export function getDb(): Db {
  if (process.env.VITEST) {
    throw new Error(
      "getDb() must not be called under vitest — use lib/db/test-db.ts's PGlite harness instead",
    );
  }
  if (!db) {
    const sql = neon(process.env.DATABASE_URL!);
    db = drizzle(sql, { schema });
  }
  return db;
}
