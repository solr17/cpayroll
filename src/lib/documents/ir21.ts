/**
 * IR21 Report Generation — Tax Clearance for Foreign Employees.
 *
 * When a foreign employee ceases employment or leaves Singapore,
 * the employer must file IR21 with IRAS at least one month before
 * the employee's cessation date or departure date, whichever is earlier.
 *
 * This generates a structured CSV report containing all fields required
 * to complete the IRAS IR21 form. The employer can use this data to
 * fill the IR21 form online via myTax Portal or submit on paper.
 *
 * NRIC is masked — only last 4 chars stored per PDPA rules.
 * All monetary values are integer cents internally.
 */

import { centsToDisplay } from "@/lib/utils/money";

interface Ir21EmployeeData {
  fullName: string;
  nricLast4: string;
  nationality: string;
  dob: string; // YYYY-MM-DD
  cessationDate: string; // YYYY-MM-DD
  lastDayInSingapore: string; // YYYY-MM-DD
  grossSalaryCents: number;
  bonusCents: number;
  employeeCpfCents: number;
  companyName: string;
  companyUen: string;
}

interface Ir21Result {
  filename: string;
  content: string;
}

/** Format integer cents to dollar string without commas: 123456 -> "1234.56" */
function toDollars(cents: number): string {
  return centsToDisplay(cents).replace(/,/g, "");
}

/**
 * Generate IR21 tax clearance report for a foreign employee leaving Singapore.
 *
 * Output is a CSV with field labels and values that map directly to IRAS IR21 form sections.
 */
export function generateIr21Data(employee: Ir21EmployeeData): Ir21Result {
  const totalIncomeCents = employee.grossSalaryCents + employee.bonusCents;
  const netIncomeCents = totalIncomeCents - employee.employeeCpfCents;

  const rows: [string, string][] = [
    // --- Section A: Employer Particulars ---
    ["Section", "A - Employer Particulars"],
    ["Employer Name", employee.companyName],
    ["Employer UEN / Tax Ref", employee.companyUen],
    ["", ""],

    // --- Section B: Employee Particulars ---
    ["Section", "B - Employee Particulars"],
    ["Employee Name", employee.fullName],
    ["NRIC/FIN (Last 4)", `XXXXX${employee.nricLast4}`],
    ["Nationality", employee.nationality],
    ["Date of Birth", employee.dob],
    ["", ""],

    // --- Section C: Employment Details ---
    ["Section", "C - Employment Details"],
    ["Date of Cessation of Employment", employee.cessationDate],
    ["Last Day in Singapore", employee.lastDayInSingapore],
    ["Reason for Filing", "Employee ceasing employment / leaving Singapore permanently"],
    ["", ""],

    // --- Section D: Income Details ---
    ["Section", "D - Income Details"],
    ["Gross Salary (S$)", toDollars(employee.grossSalaryCents)],
    ["Bonus / Variable Pay (S$)", toDollars(employee.bonusCents)],
    ["Total Gross Income (S$)", toDollars(totalIncomeCents)],
    ["Employee CPF Contributions (S$)", toDollars(employee.employeeCpfCents)],
    ["Net Income After CPF (S$)", toDollars(netIncomeCents)],
    ["", ""],

    // --- Section E: Tax Withheld ---
    ["Section", "E - Tax Clearance"],
    [
      "Note",
      "Employer must withhold all monies due to employee from the date of notice " +
        "of cessation until tax clearance is obtained from IRAS.",
    ],
    ["Amount to Withhold (S$)", toDollars(netIncomeCents)],
    ["", ""],

    // --- Section F: Additional Information ---
    ["Section", "F - Additional Information"],
    [
      "Filing Deadline",
      "At least 1 month before the cessation date or departure date, " + "whichever is earlier.",
    ],
    [
      "Submission Method",
      "Submit via IRAS myTax Portal (https://mytax.iras.gov.sg) " + "or paper Form IR21.",
    ],
  ];

  const csvLines = rows.map((row) => {
    if (row[0] === "" && row[1] === "") return "";
    return row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",");
  });

  const filename = `IR21_${employee.companyUen}_XXXXX${employee.nricLast4}_${employee.cessationDate}.csv`;

  return {
    filename,
    content: csvLines.join("\r\n"),
  };
}
