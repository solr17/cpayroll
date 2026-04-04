import { seedDefaultPayItems } from "./seed-pay-items";
import { seedDefaultGlAccounts } from "./seed-gl-accounts";
import { seedPublicHolidays } from "./seed-holidays";

/**
 * Master seed function — seeds all default data for a company.
 * Safe to call multiple times (all sub-functions are idempotent).
 */
export async function seedAll(companyId: string): Promise<void> {
  console.log(`Seeding data for company ${companyId}...`);

  await seedDefaultPayItems(companyId);
  console.log("  - Pay items seeded");

  await seedDefaultGlAccounts(companyId);
  console.log("  - GL accounts seeded");

  await seedPublicHolidays(2026);
  console.log("  - Public holidays seeded");

  console.log("Seed complete.");
}
