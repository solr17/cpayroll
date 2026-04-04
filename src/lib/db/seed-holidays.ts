import { db } from "@/lib/db";
import { publicHolidays } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

interface HolidayEntry {
  date: string;
  name: string;
}

const SG_HOLIDAYS_2026: HolidayEntry[] = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-29", name: "Chinese New Year" },
  { date: "2026-01-30", name: "Chinese New Year" },
  { date: "2026-03-20", name: "Hari Raya Puasa" },
  { date: "2026-04-10", name: "Good Friday" },
  { date: "2026-05-01", name: "Labour Day" },
  { date: "2026-05-12", name: "Vesak Day" },
  { date: "2026-05-27", name: "Hari Raya Haji" },
  { date: "2026-08-09", name: "National Day" },
  { date: "2026-10-24", name: "Deepavali" },
  { date: "2026-12-25", name: "Christmas Day" },
];

/**
 * Seed Singapore gazetted public holidays for a given year.
 * Idempotent — skips holidays that already exist by date + year.
 */
export async function seedPublicHolidays(year: number): Promise<void> {
  const holidays = year === 2026 ? SG_HOLIDAYS_2026 : [];

  if (holidays.length === 0) {
    console.log(`No holiday data available for year ${year}`);
    return;
  }

  for (const holiday of holidays) {
    // Check if this holiday already exists (gazetted, no company-specific)
    const [existing] = await db
      .select({ id: publicHolidays.id })
      .from(publicHolidays)
      .where(
        and(
          eq(publicHolidays.date, holiday.date),
          eq(publicHolidays.year, year),
          eq(publicHolidays.isGazetted, true),
        ),
      )
      .limit(1);

    if (existing) continue;

    await db.insert(publicHolidays).values({
      date: holiday.date,
      name: holiday.name,
      year,
      isGazetted: true,
      companyId: null,
    });
  }

  console.log(`Seeded ${holidays.length} public holidays for ${year}`);
}
