"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, Button, PageHeader, Badge } from "@/components/ui";
import { centsToDisplay } from "@/lib/utils/money";
import { apiFetch } from "@/lib/fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedRow {
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
  basicSalaryCents: string;
  bankName: string;
  branchCode: string;
  accountNumber: string;
  errors: string[];
}

interface ImportResult {
  created: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

// ---------------------------------------------------------------------------
// CSV parsing
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
];

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

const VALID_CITIZENSHIP = new Set(["SC", "PR1", "PR2", "PR3", "FW"]);
const VALID_EMPLOYMENT_TYPE = new Set(["FT", "PT", "CONTRACT", "LOCUM"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NRIC_RE = /^[STFGM]\d{7}[A-Z]$/i;

function validateRow(row: Record<string, string>): string[] {
  const errs: string[] = [];
  if (!row.fullName) errs.push("Full name is required");
  if (!row.nricFin) errs.push("NRIC/FIN is required");
  else if (!NRIC_RE.test(row.nricFin.trim())) errs.push("Invalid NRIC/FIN format");
  if (!row.dob) errs.push("DOB is required");
  else if (!DATE_RE.test(row.dob)) errs.push("DOB must be YYYY-MM-DD");
  if (!row.citizenshipStatus) errs.push("Citizenship status is required");
  else if (!VALID_CITIZENSHIP.has(row.citizenshipStatus.toUpperCase()))
    errs.push("Invalid citizenship status");
  if (!row.hireDate) errs.push("Hire date is required");
  else if (!DATE_RE.test(row.hireDate)) errs.push("Hire date must be YYYY-MM-DD");
  if (row.employmentType && !VALID_EMPLOYMENT_TYPE.has(row.employmentType.toUpperCase()))
    errs.push("Invalid employment type");
  if (!row.basicSalaryCents) errs.push("Basic salary is required");
  else if (isNaN(parseInt(row.basicSalaryCents, 10)) || parseInt(row.basicSalaryCents, 10) < 0)
    errs.push("Invalid salary");
  return errs;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Skip header row
  const dataLines = lines.slice(1);
  const rows: ParsedRow[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line) continue;
    const fields = parseCsvLine(line);
    const row: Record<string, string> = {};
    CSV_HEADERS.forEach((h, idx) => {
      row[h] = fields[idx]?.trim() ?? "";
    });

    const errors = validateRow(row);

    rows.push({
      rowNum: i + 2,
      fullName: row["fullName"] ?? "",
      nricFin: row["nricFin"] ?? "",
      dob: row["dob"] ?? "",
      gender: row["gender"] ?? "",
      nationality: row["nationality"] ?? "",
      citizenshipStatus: row["citizenshipStatus"] ?? "",
      race: row["race"] ?? "",
      religion: row["religion"] ?? "",
      email: row["email"] ?? "",
      mobile: row["mobile"] ?? "",
      position: row["position"] ?? "",
      department: row["department"] ?? "",
      hireDate: row["hireDate"] ?? "",
      employmentType: row["employmentType"] || "FT",
      basicSalaryCents: row["basicSalaryCents"] ?? "",
      bankName: row["bankName"] ?? "",
      branchCode: row["branchCode"] ?? "",
      accountNumber: row["accountNumber"] ?? "",
      errors,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BulkUploadPage() {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const invalidRows = parsedRows.filter((r) => r.errors.length > 0);

  const handleFile = useCallback((file: File) => {
    setError("");
    setResult(null);
    setParsedRows([]);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setError(
          "No data rows found in CSV. Make sure the file has a header row and at least one data row.",
        );
        return;
      }
      setParsedRows(rows);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const res = await apiFetch("/api/employees/bulk");
      if (!res.ok) {
        setError("Failed to download template");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "employee_bulk_template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download template");
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (validRows.length === 0) return;

    setImporting(true);
    setError("");
    setResult(null);

    try {
      // Rebuild CSV with only valid rows
      const csvLines = [CSV_HEADERS.join(",")];
      for (const row of validRows) {
        const line = CSV_HEADERS.map((h) => {
          const val = row[h as keyof ParsedRow] ?? "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(",");
        csvLines.push(line);
      }

      const res = await apiFetch("/api/employees/bulk", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csvLines.join("\n"),
      });
      const data = await res.json();

      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error ?? "Import failed");
      }
    } catch {
      setError("Failed to import employees");
    } finally {
      setImporting(false);
    }
  }, [validRows]);

  const handleReset = useCallback(() => {
    setParsedRows([]);
    setFileName("");
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Mask NRIC for preview
  function maskNric(nric: string): string {
    if (nric.length <= 4) return nric;
    return "\u2022".repeat(nric.length - 4) + nric.slice(-4);
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/employees" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Employees
        </Link>
      </div>

      <PageHeader
        title="Bulk Upload Employees"
        subtitle="Upload a CSV file to create multiple employees at once"
      />

      {/* Results summary */}
      {result && (
        <div className="mt-6">
          <Card>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Import Complete</h3>
              <p className="mt-1 text-sm text-gray-500">
                {result.created} employee{result.created !== 1 ? "s" : ""} created successfully
                {result.errors.length > 0 && (
                  <span className="text-red-600">
                    , {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}
                  </span>
                )}
              </p>

              {result.errors.length > 0 && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
                  <p className="mb-2 text-sm font-medium text-red-800">Server-side errors:</p>
                  <ul className="space-y-1 text-sm text-red-700">
                    {result.errors.map((err, i) => (
                      <li key={i}>
                        Row {err.row}: [{err.field}] {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex justify-center gap-3">
                <Button variant="secondary" onClick={handleReset}>
                  Upload More
                </Button>
                <Link href="/employees">
                  <Button>View Employees</Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Upload area */}
      {!result && (
        <>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={handleDownloadTemplate}>
              Download Template
            </Button>
          </div>

          <div className="mt-6">
            <Card>
              <div
                className={
                  "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors " +
                  (dragOver
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-300 bg-gray-50 hover:border-gray-400")
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <svg
                  className="mb-3 h-10 w-10 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="mb-1 text-sm font-medium text-gray-700">
                  {fileName ? fileName : "Drag & drop your CSV file here"}
                </p>
                <p className="mb-3 text-xs text-gray-500">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                  id="csv-upload"
                />
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Choose File
                </Button>
              </div>
            </Card>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Preview table */}
          {parsedRows.length > 0 && (
            <div className="mt-6">
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Preview ({parsedRows.length} rows)
                    </h3>
                    <p className="text-sm text-gray-500">
                      <span className="font-medium text-green-600">{validRows.length} valid</span>
                      {invalidRows.length > 0 && (
                        <span className="font-medium text-red-600">
                          {" "}
                          / {invalidRows.length} with errors
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" size="sm" onClick={handleReset}>
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleImport}
                      loading={importing}
                      disabled={validRows.length === 0}
                    >
                      Import {validRows.length} Employee{validRows.length !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                          Row
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                          NRIC
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                          DOB
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                          Citizenship
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                          Position
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                          Department
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                          Hire Date
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium tracking-wide text-gray-500 uppercase">
                          Basic Salary
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                          Errors
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {parsedRows.map((row) => {
                        const hasErrors = row.errors.length > 0;
                        return (
                          <tr
                            key={row.rowNum}
                            className={hasErrors ? "bg-red-50" : "hover:bg-gray-50"}
                          >
                            <td className="px-3 py-2 text-gray-500">{row.rowNum}</td>
                            <td className="px-3 py-2">
                              {hasErrors ? (
                                <Badge variant="danger">Error</Badge>
                              ) : (
                                <Badge variant="success">Valid</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-900">{row.fullName}</td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-500">
                              {maskNric(row.nricFin)}
                            </td>
                            <td className="px-3 py-2 text-gray-700">{row.dob}</td>
                            <td className="px-3 py-2 text-gray-700">{row.citizenshipStatus}</td>
                            <td className="px-3 py-2 text-gray-700">{row.position}</td>
                            <td className="px-3 py-2 text-gray-700">{row.department}</td>
                            <td className="px-3 py-2 text-gray-700">{row.hireDate}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">
                              {row.basicSalaryCents
                                ? `S$${centsToDisplay(parseInt(row.basicSalaryCents, 10) || 0)}`
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {hasErrors && (
                                <ul className="list-inside list-disc text-xs text-red-600">
                                  {row.errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
