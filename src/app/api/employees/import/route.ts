import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, salaryRecords } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { hashNric, nricLast4, isValidNric } from "@/lib/crypto/nric";
import { encrypt } from "@/lib/crypto/aes";
import { logAudit } from "@/lib/audit/log";
import type { ApiResponse } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ColumnMapping {
  [sourceColumn: string]: string;
}

interface ImportRequestBody {
  action: "preview" | "apply";
  csv: string;
  mapping: ColumnMapping;
  hasHeader: boolean;
}

interface ValidatedRow {
  rowNum: number;
  fullName: string;
  nricFin: string;
  dob: string;
  gender: string;
  nationality: string;
  citizenshipStatus: string;
  race: string;
  religion: string;
  email: string;
  mobile: string;
  position: string;
  department: string;
  hireDate: string;
  employmentType: string;
  basicSalaryCents: number;
  bankName: string;
  branchCode: string;
  accountNumber: string;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CITIZENSHIP = new Set(["SC", "PR1", "PR2", "PR3", "FW"]);
const VALID_EMPLOYMENT_TYPE = new Set(["FT", "PT", "CONTRACT", "LOCUM"]);

/** Maps friendly citizenship labels to internal codes */
const CITIZENSHIP_ALIASES: Record<string, string> = {
  singaporean: "SC",
  "singapore citizen": "SC",
  citizen: "SC",
  sc: "SC",
  pr: "PR1",
  "permanent resident": "PR1",
  pr1: "PR1",
  "pr year 1": "PR1",
  "pr (1st year)": "PR1",
  pr2: "PR2",
  "pr year 2": "PR2",
  "pr (2nd year)": "PR2",
  pr3: "PR3",
  "pr year 3": "PR3",
  "pr (3rd year)": "PR3",
  foreigner: "FW",
  foreign: "FW",
  "foreign worker": "FW",
  fw: "FW",
};

/** Maps friendly employment type labels to internal codes */
const EMPLOYMENT_TYPE_ALIASES: Record<string, string> = {
  "full-time": "FT",
  "full time": "FT",
  fulltime: "FT",
  ft: "FT",
  "part-time": "PT",
  "part time": "PT",
  parttime: "PT",
  pt: "PT",
  contract: "CONTRACT",
  locum: "LOCUM",
};

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Date parsing — accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
// ---------------------------------------------------------------------------

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed; // already correct format
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1]!.padStart(2, "0");
    const month = dmyMatch[2]!.padStart(2, "0");
    const year = dmyMatch[3]!;
    return `${year}-${month}-${day}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Normalize citizenship status
// ---------------------------------------------------------------------------

function normalizeCitizenship(raw: string): string {
  const trimmed = raw.trim();
  const lookup = CITIZENSHIP_ALIASES[trimmed.toLowerCase()];
  if (lookup) return lookup;
  // If it's already a valid code, return uppercased
  if (VALID_CITIZENSHIP.has(trimmed.toUpperCase())) return trimmed.toUpperCase();
  return trimmed;
}

function normalizeEmploymentType(raw: string): string {
  const trimmed = raw.trim();
  const lookup = EMPLOYMENT_TYPE_ALIASES[trimmed.toLowerCase()];
  if (lookup) return lookup;
  if (VALID_EMPLOYMENT_TYPE.has(trimmed.toUpperCase())) return trimmed.toUpperCase();
  return trimmed;
}

// ---------------------------------------------------------------------------
// Parse salary — accepts cents (integer) or dollar amounts (with $ sign, commas)
// ---------------------------------------------------------------------------

function parseSalaryCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/[$,\s]/g, "");
  if (!trimmed) return null;

  // If it contains a decimal point, treat as dollars
  if (trimmed.includes(".")) {
    const dollars = parseFloat(trimmed);
    if (isNaN(dollars) || dollars < 0) return null;
    return Math.round(dollars * 100);
  }

  // Otherwise treat as cents
  const cents = parseInt(trimmed, 10);
  if (isNaN(cents) || cents < 0) return null;
  return cents;
}

// ---------------------------------------------------------------------------
// Apply mapping to CSV row
// ---------------------------------------------------------------------------

function applyMapping(
  csvColumns: string[],
  fields: string[],
  mapping: ColumnMapping,
  hasHeader: boolean,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [sourceKey, targetField] of Object.entries(mapping)) {
    if (!targetField || targetField === "" || targetField === "skip") continue;

    let colIndex: number;
    if (hasHeader) {
      // sourceKey is the header name; find its index
      colIndex = csvColumns.indexOf(sourceKey);
    } else {
      // sourceKey is the column index as string
      colIndex = parseInt(sourceKey, 10);
    }

    if (colIndex >= 0 && colIndex < fields.length) {
      result[targetField] = fields[colIndex]?.trim() ?? "";
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Validate a mapped row
// ---------------------------------------------------------------------------

function validateMappedRow(
  row: Record<string, string>,
  rowNum: number,
): { valid: ValidatedRow | null; errors: RowError[] } {
  const errs: RowError[] = [];

  // Required: fullName
  if (!row.fullName?.trim()) {
    errs.push({ row: rowNum, field: "fullName", message: "Full name is required" });
  }

  // Required: nricFin
  if (!row.nricFin?.trim()) {
    errs.push({ row: rowNum, field: "nricFin", message: "NRIC/FIN is required" });
  } else if (!isValidNric(row.nricFin.trim())) {
    errs.push({
      row: rowNum,
      field: "nricFin",
      message: "Invalid NRIC/FIN format (e.g. S1234567A)",
    });
  }

  // Required: dob
  const parsedDob = parseDate(row.dob ?? "");
  if (!row.dob?.trim()) {
    errs.push({ row: rowNum, field: "dob", message: "Date of birth is required" });
  } else if (!parsedDob) {
    errs.push({
      row: rowNum,
      field: "dob",
      message: "Invalid date format. Use YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY",
    });
  }

  // Required: citizenshipStatus
  const normalizedCitizenship = normalizeCitizenship(row.citizenshipStatus ?? "");
  if (!row.citizenshipStatus?.trim()) {
    errs.push({
      row: rowNum,
      field: "citizenshipStatus",
      message: "Citizenship status is required",
    });
  } else if (!VALID_CITIZENSHIP.has(normalizedCitizenship)) {
    errs.push({
      row: rowNum,
      field: "citizenshipStatus",
      message: "Must be SC, PR1, PR2, PR3, or FW (or Singaporean, PR, Foreigner)",
    });
  }

  // Required: hireDate
  const parsedHireDate = parseDate(row.hireDate ?? "");
  if (!row.hireDate?.trim()) {
    errs.push({ row: rowNum, field: "hireDate", message: "Hire date is required" });
  } else if (!parsedHireDate) {
    errs.push({
      row: rowNum,
      field: "hireDate",
      message: "Invalid date format. Use YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY",
    });
  }

  // Required: basicSalaryCents
  const salaryCents = parseSalaryCents(row.basicSalaryCents ?? "");
  if (!row.basicSalaryCents?.trim()) {
    errs.push({ row: rowNum, field: "basicSalaryCents", message: "Basic salary is required" });
  } else if (salaryCents === null) {
    errs.push({ row: rowNum, field: "basicSalaryCents", message: "Invalid salary amount" });
  }

  // Optional: employmentType
  const normalizedType = normalizeEmploymentType(row.employmentType ?? "FT");
  if (row.employmentType?.trim() && !VALID_EMPLOYMENT_TYPE.has(normalizedType)) {
    errs.push({
      row: rowNum,
      field: "employmentType",
      message: "Must be FT, PT, CONTRACT, or LOCUM",
    });
  }

  // Optional: email
  if (row.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    errs.push({ row: rowNum, field: "email", message: "Invalid email format" });
  }

  // Optional: gender
  if (row.gender?.trim()) {
    const g = row.gender.trim().toUpperCase();
    if (g !== "M" && g !== "F" && g !== "MALE" && g !== "FEMALE") {
      errs.push({ row: rowNum, field: "gender", message: "Gender must be M or F" });
    }
  }

  if (errs.length > 0) {
    return { valid: null, errors: errs };
  }

  // Normalize gender
  let gender = (row.gender ?? "").trim().toUpperCase();
  if (gender === "MALE") gender = "M";
  if (gender === "FEMALE") gender = "F";

  return {
    valid: {
      rowNum,
      fullName: (row.fullName ?? "").trim(),
      nricFin: (row.nricFin ?? "").trim().toUpperCase(),
      dob: parsedDob!,
      gender,
      nationality: (row.nationality ?? "").trim(),
      citizenshipStatus: normalizedCitizenship,
      race: (row.race ?? "").trim(),
      religion: (row.religion ?? "").trim(),
      email: (row.email ?? "").trim(),
      mobile: (row.mobile ?? "").trim(),
      position: (row.position ?? "").trim(),
      department: (row.department ?? "").trim(),
      hireDate: parsedHireDate!,
      employmentType: normalizedType || "FT",
      basicSalaryCents: salaryCents!,
      bankName: (row.bankName ?? "").trim(),
      branchCode: (row.branchCode ?? "").trim(),
      accountNumber: (row.accountNumber ?? "").trim(),
    },
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body: ImportRequestBody = await request.json();

    const { action, csv, mapping, hasHeader } = body;

    if (!csv || !mapping || typeof mapping !== "object") {
      return NextResponse.json(
        { success: false, error: "Missing required fields: csv, mapping" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    if (action !== "preview" && action !== "apply") {
      return NextResponse.json(
        { success: false, error: "Action must be 'preview' or 'apply'" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Parse CSV lines
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return NextResponse.json({ success: false, error: "Empty CSV" } satisfies ApiResponse, {
        status: 400,
      });
    }

    // Extract column headers (first row if hasHeader)
    const firstLineFields = parseCsvLine(lines[0] ?? "");
    const csvColumns = hasHeader ? firstLineFields.map((f) => f.trim()) : [];
    const dataStartIndex = hasHeader ? 1 : 0;

    const validRows: ValidatedRow[] = [];
    const allErrors: RowError[] = [];

    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const fields = parseCsvLine(line);
      const rowNum = i + 1; // 1-indexed

      const mapped = applyMapping(csvColumns, fields, mapping, hasHeader);
      const { valid, errors } = validateMappedRow(mapped, rowNum);

      if (valid) {
        validRows.push(valid);
      }
      if (errors.length > 0) {
        allErrors.push(...errors);
      }
    }

    // ---------------------------------------------------------------------------
    // PREVIEW
    // ---------------------------------------------------------------------------
    if (action === "preview") {
      // Mask NRIC in preview response — only show last 4
      const safeValid = validRows.map((r) => ({
        ...r,
        nricFin: undefined,
        nricLast4: r.nricFin.slice(-4),
      }));

      return NextResponse.json({
        success: true,
        data: {
          valid: safeValid,
          errors: allErrors,
          totalRows: lines.length - dataStartIndex,
        },
      } satisfies ApiResponse);
    }

    // ---------------------------------------------------------------------------
    // APPLY
    // ---------------------------------------------------------------------------
    let imported = 0;
    const applyErrors: { row: number; message: string }[] = [];

    for (const row of validRows) {
      try {
        const nricHash = hashNric(row.nricFin);
        const last4 = nricLast4(row.nricFin);

        let bankJsonEncrypted: string | undefined;
        if (row.bankName && row.accountNumber) {
          bankJsonEncrypted = encrypt(
            JSON.stringify({
              bankName: row.bankName,
              branchCode: row.branchCode,
              accountNumber: row.accountNumber,
            }),
          );
        }

        const [newEmployee] = await db
          .insert(employees)
          .values({
            companyId: session.companyId,
            nricFinHash: nricHash,
            nricLast4: last4,
            fullName: row.fullName,
            dob: row.dob,
            gender: row.gender || null,
            nationality: row.nationality || null,
            citizenshipStatus: row.citizenshipStatus as "SC" | "PR1" | "PR2" | "PR3" | "FW",
            race: row.race || null,
            religion: row.religion || null,
            email: row.email || null,
            mobile: row.mobile || null,
            position: row.position || null,
            department: row.department || null,
            hireDate: row.hireDate,
            employmentType: (row.employmentType || "FT") as "FT" | "PT" | "CONTRACT" | "LOCUM",
            bankJsonEncrypted,
          })
          .returning({ id: employees.id });

        if (!newEmployee) {
          applyErrors.push({ row: row.rowNum, message: "Failed to insert employee" });
          continue;
        }

        await db.insert(salaryRecords).values({
          employeeId: newEmployee.id,
          effectiveDate: row.hireDate,
          basicSalaryCents: row.basicSalaryCents,
          createdBy: session.id,
        });

        imported++;
      } catch (insertErr) {
        const msg = insertErr instanceof Error ? insertErr.message : "Insert failed";
        applyErrors.push({ row: row.rowNum, message: msg });
      }
    }

    // Audit log
    await logAudit({
      userId: session.id,
      action: "import_employees",
      entityType: "employee",
      newValue: {
        imported,
        errorCount: applyErrors.length + allErrors.length,
        totalRows: lines.length - dataStartIndex,
        validationErrors: allErrors.length,
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { imported, errors: applyErrors },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
