import * as schema from "./schema";

// Use PGlite for local development, Neon for production
let db: ReturnType<typeof createDb>;

function createDb() {
  if (process.env.DATABASE_URL) {
    // Production: use Neon serverless
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

db = createDb();

export { db };
