/**
 * Demo mode seed data.
 * When DEMO_MODE=true, seeds a demo company with realistic Singapore clinic data.
 * Used for investor demos and product walkthroughs.
 */

import { db } from "@/lib/db";
import { companies, employees, users, salaryRecords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createHmac } from "crypto";

const DEMO_COMPANY_UEN = "202400001D";
const DEMO_EMAIL = "demo@clinicpay.sg";
const DEMO_PASSWORD = "demo1234";

function hashNric(nric: string): string {
  const key = process.env.NRIC_HMAC_KEY || "0".repeat(64);
  return createHmac("sha256", Buffer.from(key, "hex")).update(nric.toUpperCase()).digest("hex");
}

interface DemoEmployee {
  fullName: string;
  nric: string;
  dob: string;
  gender: string;
  nationality: string;
  citizenshipStatus: "SC" | "PR1" | "PR2" | "PR3" | "FW";
  race: string;
  position: string;
  department: string;
  hireDate: string;
  employmentType: "FT" | "PT" | "CONTRACT" | "LOCUM";
  basicSalaryCents: number;
}

const DEMO_EMPLOYEES: DemoEmployee[] = [
  {
    fullName: "Tan Wei Ming",
    nric: "S8234567A",
    dob: "1982-03-15",
    gender: "Male",
    nationality: "Singaporean",
    citizenshipStatus: "SC",
    race: "Chinese",
    position: "Senior Doctor",
    department: "General Practice",
    hireDate: "2020-01-15",
    employmentType: "FT",
    basicSalaryCents: 1200000,
  },
  {
    fullName: "Sarah Lim",
    nric: "S8534567B",
    dob: "1985-07-22",
    gender: "Female",
    nationality: "Singaporean",
    citizenshipStatus: "SC",
    race: "Chinese",
    position: "Doctor",
    department: "General Practice",
    hireDate: "2021-06-01",
    employmentType: "FT",
    basicSalaryCents: 950000,
  },
  {
    fullName: "Ahmad bin Ismail",
    nric: "S7934567C",
    dob: "1979-11-08",
    gender: "Male",
    nationality: "Singaporean",
    citizenshipStatus: "SC",
    race: "Malay",
    position: "Clinic Manager",
    department: "Administration",
    hireDate: "2019-03-10",
    employmentType: "FT",
    basicSalaryCents: 550000,
  },
  {
    fullName: "Priya Nair",
    nric: "S9034567D",
    dob: "1990-01-25",
    gender: "Female",
    nationality: "Singaporean",
    citizenshipStatus: "SC",
    race: "Indian",
    position: "Staff Nurse",
    department: "Nursing",
    hireDate: "2022-02-14",
    employmentType: "FT",
    basicSalaryCents: 380000,
  },
  {
    fullName: "Emily Chen",
    nric: "S9234567E",
    dob: "1992-09-30",
    gender: "Female",
    nationality: "Singaporean",
    citizenshipStatus: "SC",
    race: "Chinese",
    position: "Reception",
    department: "Administration",
    hireDate: "2023-01-03",
    employmentType: "FT",
    basicSalaryCents: 280000,
  },
  {
    fullName: "David Ong",
    nric: "S8834567F",
    dob: "1988-05-12",
    gender: "Male",
    nationality: "Singaporean",
    citizenshipStatus: "SC",
    race: "Chinese",
    position: "Lab Technician",
    department: "Laboratory",
    hireDate: "2021-09-15",
    employmentType: "FT",
    basicSalaryCents: 340000,
  },
  {
    fullName: "Maria Santos",
    nric: "G1234567N",
    dob: "1995-04-18",
    gender: "Female",
    nationality: "Filipino",
    citizenshipStatus: "FW",
    race: "Other",
    position: "Healthcare Assistant",
    department: "Nursing",
    hireDate: "2023-06-01",
    employmentType: "FT",
    basicSalaryCents: 250000,
  },
  {
    fullName: "Nurul Aisyah",
    nric: "S9134567G",
    dob: "1991-12-05",
    gender: "Female",
    nationality: "Singaporean",
    citizenshipStatus: "SC",
    race: "Malay",
    position: "Staff Nurse",
    department: "Nursing",
    hireDate: "2022-08-01",
    employmentType: "FT",
    basicSalaryCents: 360000,
  },
];

export async function isDemoMode(): Promise<boolean> {
  return process.env.DEMO_MODE === "true";
}

export async function seedDemoData(): Promise<void> {
  if (!(await isDemoMode())) return;

  // Check if demo company already exists
  const [existing] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.uen, DEMO_COMPANY_UEN))
    .limit(1);

  if (existing) return; // Already seeded

  // Create demo company
  const [company] = await db
    .insert(companies)
    .values({
      name: "ClinicPay Demo Clinic",
      uen: DEMO_COMPANY_UEN,
      addressJson: { address: "123 Orchard Road, #04-56, Singapore 238867" },
      bankAccountJson: {
        bankName: "DBS",
        branchCode: "001",
        accountNumber: "1234567890",
        payNowLinked: true,
      },
      cpfSubmissionNumber: "CSN0000001",
      irasTaxRef: "A1234567B",
      payDay: 25,
      prorationMethod: "calendar",
      otMultiplier: "1.5",
    })
    .returning();

  // Create demo admin user
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  await db.insert(users).values({
    companyId: company.id,
    email: DEMO_EMAIL,
    passwordHash,
    name: "Demo Admin",
    role: "owner",
  });

  // Create employees and salary records
  for (const emp of DEMO_EMPLOYEES) {
    const [employee] = await db
      .insert(employees)
      .values({
        companyId: company.id,
        fullName: emp.fullName,
        nricFinHash: hashNric(emp.nric),
        nricLast4: emp.nric.slice(-4),
        dob: emp.dob,
        gender: emp.gender,
        nationality: emp.nationality,
        citizenshipStatus: emp.citizenshipStatus,
        race: emp.race,
        position: emp.position,
        department: emp.department,
        hireDate: emp.hireDate,
        employmentType: emp.employmentType,
        status: "active",
      })
      .returning();

    await db.insert(salaryRecords).values({
      employeeId: employee.id,
      basicSalaryCents: emp.basicSalaryCents,
      allowancesJson: JSON.stringify([
        { name: "Transport", amountCents: 15000, isFixed: true },
        { name: "Meal", amountCents: 10000, isFixed: true },
      ]),
      otEligible: emp.basicSalaryCents <= 450000, // EA threshold
      otRateMultiplier: "1.5",
      awsMonths: "1",
      effectiveDate: emp.hireDate,
    });
  }

  console.log(
    `[demo] Seeded demo company "${company.name}" with ${DEMO_EMPLOYEES.length} employees`,
  );
  console.log(`[demo] Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

export const DEMO_CREDENTIALS = {
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  companyName: "ClinicPay Demo Clinic",
};
