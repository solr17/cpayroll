/**
 * Seed database with test company, user, and employees.
 * Run: npm run seed
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import { companies } from "../src/lib/db/schema/companies";
import { users } from "../src/lib/db/schema/users";
import { employees } from "../src/lib/db/schema/employees";
import { salaryRecords } from "../src/lib/db/schema/salary-records";
import { createHmac } from "crypto";

function hashNric(nric: string): string {
  const key = Buffer.from(process.env.NRIC_HMAC_KEY!, "hex");
  return createHmac("sha256", key).update(nric.toUpperCase()).digest("hex");
}

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  // Create company
  const [company] = await db
    .insert(companies)
    .values({
      name: "Sample Medical Clinic",
      uen: "202012345A",
      payDay: 25,
    })
    .returning();

  console.log(`Created company: ${company!.name}`);

  // Create admin user
  const passwordHash = await bcrypt.hash("admin123", 12);
  const [adminUser] = await db
    .insert(users)
    .values({
      companyId: company!.id,
      email: "admin@clinicpay.local",
      passwordHash,
      name: "Clinic Admin",
      role: "owner",
    })
    .returning();

  console.log(`Created admin user: ${adminUser!.email}`);

  // Sample employees — NRIC values are fictional test data
  const testEmployees = [
    {
      nric: "S1234567A",
      name: "Tan Wei Ming",
      dob: "1985-03-15",
      status: "SC" as const,
      dept: "Doctor",
      pos: "Senior Doctor",
      salary: 1200000,
    },
    {
      nric: "S2345678B",
      name: "Lim Mei Ling",
      dob: "1990-07-22",
      status: "SC" as const,
      dept: "Nurse",
      pos: "Staff Nurse",
      salary: 450000,
    },
    {
      nric: "S3456789C",
      name: "Ahmad bin Hassan",
      dob: "1968-11-05",
      status: "SC" as const,
      dept: "Admin",
      pos: "Receptionist",
      salary: 300000,
    },
    {
      nric: "G4567890D",
      name: "Maria Santos",
      dob: "1995-01-30",
      status: "FW" as const,
      dept: "Nurse",
      pos: "Enrolled Nurse",
      salary: 280000,
    },
    {
      nric: "S5678901E",
      name: "Wong Kai Wen",
      dob: "1975-06-18",
      status: "PR3" as const,
      dept: "Doctor",
      pos: "Locum Doctor",
      salary: 800000,
    },
  ];

  for (const emp of testEmployees) {
    const [employee] = await db
      .insert(employees)
      .values({
        companyId: company!.id,
        nricFinHash: hashNric(emp.nric),
        nricLast4: emp.nric.slice(-4),
        fullName: emp.name,
        dob: emp.dob,
        citizenshipStatus: emp.status,
        department: emp.dept,
        position: emp.pos,
        hireDate: "2024-01-01",
        employmentType: "FT",
      })
      .returning();

    await db.insert(salaryRecords).values({
      employeeId: employee!.id,
      effectiveDate: "2024-01-01",
      basicSalaryCents: emp.salary,
    });

    console.log(`Created employee: ${emp.name} (${emp.nric.slice(-4)})`);
  }

  console.log("\nSeed complete. Login with: admin@clinicpay.local / admin123");
}

seed().catch(console.error);
