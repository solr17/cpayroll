/* eslint-disable @typescript-eslint/no-require-imports */
import * as schema from "./schema";

// Use PGlite for local development, Neon for production
function createDb() {
  if (process.env.DATABASE_URL) {
    const { neon } = require("@neondatabase/serverless");
    const { drizzle } = require("drizzle-orm/neon-http");
    const sql = neon(process.env.DATABASE_URL);
    return drizzle(sql, { schema });
  } else {
    // Local development: use PGlite (embedded PostgreSQL)
    const { PGlite } = require("@electric-sql/pglite");
    const { drizzle } = require("drizzle-orm/pglite");
    const client = new PGlite("./data/clinicpay");
    return drizzle(client, { schema });
  }
}

// Lazy initialization — avoids running during Next.js build phase
let _db: ReturnType<typeof createDb> | null = null;

const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    if (!_db) _db = createDb();
    return (_db as Record<string | symbol, unknown>)[prop];
  },
});

export { db };
