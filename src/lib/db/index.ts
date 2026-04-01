/* eslint-disable @typescript-eslint/no-require-imports */
import * as schema from "./schema";

// Use PGlite for local development, Neon for production
function createDb() {
  if (process.env.DATABASE_URL) {
    // Production: use Neon serverless
    const { neon } = require("@neondatabase/serverless");
    const { drizzle } = require("drizzle-orm/neon-http");
    const sql = neon(process.env.DATABASE_URL);
    return drizzle(sql, { schema });
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  } else {
    // Local development: use PGlite (embedded PostgreSQL)
    const { PGlite } = require("@electric-sql/pglite");
    const { drizzle } = require("drizzle-orm/pglite");
    const client = new PGlite("./data/clinicpay");
    return drizzle(client, { schema });
  }
}

const db = createDb();

export { db };
