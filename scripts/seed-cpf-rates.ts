/**
 * Seed CPF rate tables for 2025 and 2026.
 * Run: npm run seed:cpf-rates
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { cpfRateTables } from "../src/lib/db/schema/cpf-rate-tables";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  // 2025 SC / PR 3rd Year+ rates
  const rates2025 = [
    { ageBandMin: 0, ageBandMax: 55, employerRate: "0.1700", employeeRate: "0.2000", totalRate: "0.3700" },
    { ageBandMin: 56, ageBandMax: 60, employerRate: "0.1550", employeeRate: "0.1700", totalRate: "0.3250" },
    { ageBandMin: 61, ageBandMax: 65, employerRate: "0.1200", employeeRate: "0.1150", totalRate: "0.2350" },
    { ageBandMin: 66, ageBandMax: 70, employerRate: "0.0900", employeeRate: "0.0750", totalRate: "0.1650" },
    { ageBandMin: 71, ageBandMax: 999, employerRate: "0.0750", employeeRate: "0.0500", totalRate: "0.1250" },
  ];

  // 2026 SC / PR 3rd Year+ rates (with changes for 55-65 bands)
  const rates2026 = [
    { ageBandMin: 0, ageBandMax: 55, employerRate: "0.1700", employeeRate: "0.2000", totalRate: "0.3700" },
    { ageBandMin: 56, ageBandMax: 60, employerRate: "0.1600", employeeRate: "0.1800", totalRate: "0.3400" },
    { ageBandMin: 61, ageBandMax: 65, employerRate: "0.1250", employeeRate: "0.1250", totalRate: "0.2500" },
    { ageBandMin: 66, ageBandMax: 70, employerRate: "0.0900", employeeRate: "0.0750", totalRate: "0.1650" },
    { ageBandMin: 71, ageBandMax: 999, employerRate: "0.0750", employeeRate: "0.0500", totalRate: "0.1250" },
  ];

  const statusTypes = ["SC", "PR3"] as const;

  for (const statusType of statusTypes) {
    for (const rate of rates2025) {
      await db.insert(cpfRateTables).values({
        effectiveDate: "2025-01-01",
        statusType,
        ...rate,
      });
    }
    for (const rate of rates2026) {
      await db.insert(cpfRateTables).values({
        effectiveDate: "2026-01-01",
        statusType,
        ...rate,
      });
    }
  }

  console.log("CPF rate tables seeded for 2025 and 2026 (SC and PR3+)");
}

seed().catch(console.error);
