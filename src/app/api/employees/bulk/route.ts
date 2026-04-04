import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, salaryRecords } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { hashNric, nricLast4, isValidNric } from "@/lib/crypto/nric";
import { encrypt } from "@/lib/crypto/aes";
import { logAudit } from "@/lib/audit/log";
import type { ApiResponse } from "@/types";

// ---------------------------------------------------------------------------
// CSV template
// ---------------------------------------------------------------------------

const CSV_HEADERS = [
  "fullName",
  "nricFin",
  "dob",
  "gender",
  "nationality",
  "citizenshipStatus",
  "race",
  "religion",
  "email",
  "mobile",
  "position",
  "department",
  "hireDate",
  "employmentType",
  "basicSalaryCents",
  "bankName",
  "branchCode",
  "accountNumber",
] as const;

const EXAMPLE_ROWS = [
  "John Tan,S1234567A,1990-05-15,M,Singaporean,SC,Chinese,Buddhism,john@example.com,91234567,Dental Assistant,Operations,2026-01-01,FT,350000,DBS,001,1234567890",
  "Jane Lim,S7654321B,1988-11-20,F,Singaporean,SC,Chinese,Christianity,jane@example.com,98765432,Clinic Manager,Admin,2026-02-01,FT,500000,OCBC,502,9876543210",
];

const TEMPLATE_CSV = [CSV_HEADERS.join(","), ...EXAMPLE_ROWS].join("\n");

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

const VALID_GENDERS = new Set(["M", "F"]);
const VALID_CITIZENSHIP = new Set(["SC", "PR1", "PR2", "PR3", "FW"]);
const VALID_EMPLOYMENT_TYPE = new Set(["FT", "PT", "CONTRACT", "LOCUM"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface RowError {
  row: number;
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// GET — Download CSV template
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    await requireRole("owner", "admin");

    return new NextResponse(TEMPLATE_CSV, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="employee_bulk_template.csv"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

// ---------------------------------------------------------------------------
// POST — Import CSV
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const csvText = await request.text();

    if (!csvText.trim()) {
      return NextResponse.json({ success: false, error: "Empty CSV body" } satisfies ApiResponse, {
        status: 400,
      });
    }

    // Parse CSV
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "CSV must contain a header row and at least one data row",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Validate header row
    const headerLine = lines[0] ?? "";
    const headers = parseCsvLine(headerLine);
    const headerCheck = CSV_HEADERS.every(
      (h, idx) => headers[idx]?.trim().toLowerCase() === h.toLowerCase(),
    );
    if (!headerCheck) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid CSV headers. Expected: ${CSV_HEADERS.join(",")}`,
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const dataLines = lines.slice(1);
    const errors: RowError[] = [];
    let created = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const rowNum = i + 2; // 1-indexed, skip header
      const line = dataLines[i];
      if (!line) continue;
      const fields = parseCsvLine(line);

      if (fields.length < CSV_HEADERS.length) {
        errors.push({
          row: rowNum,
          field: "row",
          message: `Expected ${CSV_HEADERS.length} columns, got ${fields.length}`,
        });
        continue;
      }

      const row: Record<string, string> = Object.fromEntries(
        CSV_HEADERS.map((h, idx) => [h, fields[idx]?.trim() ?? ""]),
      );

      // Validate required fields
      const rowErrors = validateRow(row, rowNum);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      // Safe accessor for row fields (validated above so these exist)
      const get = (key: string): string => row[key] ?? "";

      try {
        // Hash NRIC, extract last 4
        const nricHash = hashNric(get("nricFin"));
        const last4 = nricLast4(get("nricFin"));

        // Encrypt bank details if provided
        let bankJsonEncrypted: string | undefined;
        if (get("bankName") && get("accountNumber")) {
          bankJsonEncrypted = encrypt(
            JSON.stringify({
              bankName: get("bankName"),
              branchCode: get("branchCode"),
              accountNumber: get("accountNumber"),
            }),
          );
        }

        // Insert employee
        const [newEmployee] = await db
          .insert(employees)
          .values({
            companyId: session.companyId,
            nricFinHash: nricHash,
            nricLast4: last4,
            fullName: get("fullName"),
            dob: get("dob"),
            gender: get("gender") || null,
            nationality: get("nationality") || null,
            citizenshipStatus: get("citizenshipStatus") as "SC" | "PR1" | "PR2" | "PR3" | "FW",
            race: get("race") || null,
            religion: get("religion") || null,
            email: get("email") || null,
            mobile: get("mobile") || null,
            position: get("position") || null,
            department: get("department") || null,
            hireDate: get("hireDate"),
            employmentType: (get("employmentType") || "FT") as "FT" | "PT" | "CONTRACT" | "LOCUM",
            bankJsonEncrypted,
          })
          .returning({ id: employees.id });

        if (!newEmployee) {
          errors.push({ row: rowNum, field: "row", message: "Failed to insert employee" });
          continue;
        }

        // Insert salary record
        const salaryCents = parseInt(get("basicSalaryCents"), 10);
        await db.insert(salaryRecords).values({
          employeeId: newEmployee.id,
          effectiveDate: get("hireDate"),
          basicSalaryCents: salaryCents,
          createdBy: session.id,
        });

        created++;
      } catch (insertErr) {
        const msg = insertErr instanceof Error ? insertErr.message : "Insert failed";
        errors.push({ row: rowNum, field: "row", message: msg });
      }
    }

    // Audit log
    await logAudit({
      userId: session.id,
      action: "bulk_upload_employees",
      entityType: "employee",
      newValue: { created, errorCount: errors.length, totalRows: dataLines.length },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { created, errors },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateRow(row: Record<string, string>, rowNum: number): RowError[] {
  const errs: RowError[] = [];

  if (!row.fullName) {
    errs.push({ row: rowNum, field: "fullName", message: "Full name is required" });
  }

  if (!row.nricFin) {
    errs.push({ row: rowNum, field: "nricFin", message: "NRIC/FIN is required" });
  } else if (!isValidNric(row.nricFin)) {
    errs.push({
      row: rowNum,
      field: "nricFin",
      message: "Invalid NRIC/FIN format (e.g. S1234567A)",
    });
  }

  if (!row.dob) {
    errs.push({ row: rowNum, field: "dob", message: "Date of birth is required" });
  } else if (!DATE_RE.test(row.dob)) {
    errs.push({ row: rowNum, field: "dob", message: "DOB must be YYYY-MM-DD" });
  }

  if (row.gender && !VALID_GENDERS.has(row.gender.toUpperCase())) {
    errs.push({ row: rowNum, field: "gender", message: "Gender must be M or F" });
  }

  if (!row.citizenshipStatus) {
    errs.push({
      row: rowNum,
      field: "citizenshipStatus",
      message: "Citizenship status is required",
    });
  } else if (!VALID_CITIZENSHIP.has(row.citizenshipStatus.toUpperCase())) {
    errs.push({
      row: rowNum,
      field: "citizenshipStatus",
      message: "Must be SC, PR1, PR2, PR3, or FW",
    });
  }

  if (!row.hireDate) {
    errs.push({ row: rowNum, field: "hireDate", message: "Hire date is required" });
  } else if (!DATE_RE.test(row.hireDate)) {
    errs.push({ row: rowNum, field: "hireDate", message: "Hire date must be YYYY-MM-DD" });
  }

  if (row.employmentType && !VALID_EMPLOYMENT_TYPE.has(row.employmentType.toUpperCase())) {
    errs.push({
      row: rowNum,
      field: "employmentType",
      message: "Must be FT, PT, CONTRACT, or LOCUM",
    });
  }

  if (!row.basicSalaryCents) {
    errs.push({
      row: rowNum,
      field: "basicSalaryCents",
      message: "Basic salary (cents) is required",
    });
  } else {
    const cents = parseInt(row.basicSalaryCents, 10);
    if (isNaN(cents) || cents < 0) {
      errs.push({
        row: rowNum,
        field: "basicSalaryCents",
        message: "Salary must be a non-negative integer (in cents)",
      });
    }
  }

  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errs.push({ row: rowNum, field: "email", message: "Invalid email format" });
  }

  return errs;
}

/** Simple CSV line parser that handles quoted fields */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}
