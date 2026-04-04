"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { Card, Button, Badge, PageHeader } from "@/components/ui";
import { centsToDisplay } from "@/lib/utils/money";
import { apiFetch } from "@/lib/fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = "upload" | "mapping" | "preview" | "results";

interface PreviewRow {
  rowNum: number;
  fullName: string;
  nricLast4: string;
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

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

// ---------------------------------------------------------------------------
// ClinicPay target fields
// ---------------------------------------------------------------------------

const CLINICPAY_FIELDS: { value: string; label: string; required: boolean }[] = [
  { value: "fullName", label: "Full Name", required: true },
  { value: "nricFin", label: "NRIC/FIN", required: true },
  { value: "dob", label: "Date of Birth", required: true },
  { value: "citizenshipStatus", label: "Citizenship Status", required: true },
  { value: "hireDate", label: "Hire Date", required: true },
  { value: "basicSalaryCents", label: "Basic Salary", required: true },
  { value: "gender", label: "Gender", required: false },
  { value: "nationality", label: "Nationality", required: false },
  { value: "email", label: "Email", required: false },
  { value: "mobile", label: "Mobile", required: false },
  { value: "position", label: "Position", required: false },
  { value: "department", label: "Department", required: false },
  { value: "employmentType", label: "Employment Type", required: false },
  { value: "bankName", label: "Bank Name", required: false },
  { value: "branchCode", label: "Branch Code", required: false },
  { value: "accountNumber", label: "Account Number", required: false },
  { value: "race", label: "Race", required: false },
  { value: "religion", label: "Religion", required: false },
];

// ---------------------------------------------------------------------------
// Mapping presets
// ---------------------------------------------------------------------------

type MappingPreset = "auto" | "gpayroll" | "talenox" | "custom";

/** GPayroll common column headers -> ClinicPay fields */
const GPAYROLL_MAPPING: Record<string, string> = {
  "employee name": "fullName",
  "full name": "fullName",
  name: "fullName",
  "nric/fin": "nricFin",
  nric: "nricFin",
  fin: "nricFin",
  "nric no": "nricFin",
  "nric no.": "nricFin",
  "id number": "nricFin",
  "date of birth": "dob",
  dob: "dob",
  "birth date": "dob",
  birthday: "dob",
  gender: "gender",
  sex: "gender",
  nationality: "nationality",
  citizenship: "citizenshipStatus",
  "citizenship status": "citizenshipStatus",
  "citizen status": "citizenshipStatus",
  "residency status": "citizenshipStatus",
  "pr status": "citizenshipStatus",
  race: "race",
  religion: "religion",
  email: "email",
  "email address": "email",
  mobile: "mobile",
  "mobile no": "mobile",
  "mobile no.": "mobile",
  phone: "mobile",
  "phone no": "mobile",
  "contact number": "mobile",
  "contact no": "mobile",
  position: "position",
  "job title": "position",
  designation: "position",
  title: "position",
  department: "department",
  dept: "department",
  "hire date": "hireDate",
  "join date": "hireDate",
  "date joined": "hireDate",
  "start date": "hireDate",
  "commencement date": "hireDate",
  "date of joining": "hireDate",
  "employment type": "employmentType",
  "emp type": "employmentType",
  type: "employmentType",
  "basic salary": "basicSalaryCents",
  "basic pay": "basicSalaryCents",
  salary: "basicSalaryCents",
  "monthly salary": "basicSalaryCents",
  "base salary": "basicSalaryCents",
  "bank name": "bankName",
  bank: "bankName",
  "branch code": "branchCode",
  "account number": "accountNumber",
  "account no": "accountNumber",
  "account no.": "accountNumber",
  "bank account": "accountNumber",
  "bank account no": "accountNumber",
};

/** Talenox uses slightly different naming */
const TALENOX_MAPPING: Record<string, string> = {
  ...GPAYROLL_MAPPING,
  "legal name": "fullName",
  "preferred name": "fullName",
  "identification number": "nricFin",
  "nric / fin": "nricFin",
  "nric/fin no": "nricFin",
  "nric/fin number": "nricFin",
  "date of commencement": "hireDate",
  "joining date": "hireDate",
  "work email": "email",
  "personal email": "email",
  "mobile number": "mobile",
  "cell phone": "mobile",
  "job designation": "position",
  "monthly basic": "basicSalaryCents",
  "basic monthly": "basicSalaryCents",
  "gross salary": "basicSalaryCents",
};

// ---------------------------------------------------------------------------
// CSV parsing (client-side)
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

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const allRows = lines.map((line) => parseCsvLine(line));
  return { headers: allRows[0] ?? [], rows: allRows.slice(1) };
}

// ---------------------------------------------------------------------------
// Auto-detect mapping from header names
// ---------------------------------------------------------------------------

function autoDetectMapping(
  headers: string[],
  presetMap: Record<string, string>,
): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    const match = presetMap[normalized];
    if (match) {
      mapping[header] = match;
    } else {
      // Fuzzy: try partial matches
      for (const [key, value] of Object.entries(presetMap)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          if (!mapping[header]) {
            mapping[header] = value;
          }
        }
      }
    }
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportWizardPage() {
  // Wizard state
  const [step, setStep] = useState<WizardStep>("upload");

  // Step 1: Upload
  const [rawCsv, setRawCsv] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Mapping
  const [preset, setPreset] = useState<MappingPreset>("auto");
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Step 3: Preview
  const [previewValid, setPreviewValid] = useState<PreviewRow[]>([]);
  const [previewErrors, setPreviewErrors] = useState<ValidationError[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  // Step 4: Results
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  // Derived: column labels for mapping step
  const columnLabels = useMemo(() => {
    if (hasHeader && csvHeaders.length > 0) {
      return csvHeaders;
    }
    return csvHeaders.map((_h, i) => `Column ${i + 1}`);
  }, [hasHeader, csvHeaders]);

  // Derived: sample values for each column (first 3 data rows)
  const sampleValues = useMemo(() => {
    const samples: Record<string, string[]> = {};
    const labels = hasHeader ? csvHeaders : csvHeaders.map((_h, i) => `Column ${i + 1}`);
    for (let ci = 0; ci < labels.length; ci++) {
      const label = labels[ci] ?? `Column ${ci + 1}`;
      samples[label] = [];
      const dataRows = hasHeader ? csvRows : [csvHeaders, ...csvRows];
      for (let ri = 0; ri < Math.min(3, dataRows.length); ri++) {
        const val = dataRows[ri]?.[ci]?.trim() ?? "";
        if (val) samples[label].push(val);
      }
    }
    return samples;
  }, [csvHeaders, csvRows, hasHeader]);

  // Check if all required fields are mapped
  const requiredFields = CLINICPAY_FIELDS.filter((f) => f.required).map((f) => f.value);
  const mappedTargets = new Set(Object.values(mapping).filter((v) => v && v !== "skip"));
  const missingRequired = requiredFields.filter((f) => !mappedTargets.has(f));

  // -------------------------------------------------------------------------
  // Step 1: Upload handlers
  // -------------------------------------------------------------------------

  const handleFile = useCallback((file: File) => {
    setError("");
    setResult(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawCsv(text);

      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) {
        setError("No data found in CSV file");
        return;
      }

      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-detect if first row is a header (heuristic: if it contains common header words)
      const firstRowLower = headers.map((h) => h.toLowerCase().trim());
      const headerKeywords = [
        "name",
        "nric",
        "date",
        "salary",
        "email",
        "phone",
        "department",
        "position",
        "gender",
        "bank",
      ];
      const looksLikeHeader = firstRowLower.some((h) =>
        headerKeywords.some((kw) => h.includes(kw)),
      );
      setHasHeader(looksLikeHeader);

      // Auto-detect mapping
      if (looksLikeHeader) {
        const detected = autoDetectMapping(headers, GPAYROLL_MAPPING);
        setMapping(detected);
        setPreset("auto");
      } else {
        setMapping({});
        setPreset("custom");
      }
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

  // -------------------------------------------------------------------------
  // Step 2: Mapping handlers
  // -------------------------------------------------------------------------

  const handlePresetChange = useCallback(
    (newPreset: MappingPreset) => {
      setPreset(newPreset);
      const headers = hasHeader ? csvHeaders : csvHeaders.map((_h, i) => `Column ${i + 1}`);

      if (newPreset === "gpayroll") {
        setMapping(autoDetectMapping(headers, GPAYROLL_MAPPING));
      } else if (newPreset === "talenox") {
        setMapping(autoDetectMapping(headers, TALENOX_MAPPING));
      } else if (newPreset === "auto") {
        setMapping(autoDetectMapping(headers, GPAYROLL_MAPPING));
      } else {
        // custom — keep current mapping
      }
    },
    [csvHeaders, hasHeader],
  );

  const handleMappingChange = useCallback((columnLabel: string, targetField: string) => {
    setMapping((prev) => ({ ...prev, [columnLabel]: targetField }));
    setPreset("custom");
  }, []);

  // -------------------------------------------------------------------------
  // Step 3: Preview — call API
  // -------------------------------------------------------------------------

  const handlePreview = useCallback(async () => {
    setPreviewing(true);
    setError("");
    setPreviewValid([]);
    setPreviewErrors([]);

    try {
      // Build the mapping to send: use column headers or indices as keys
      const apiMapping: Record<string, string> = {};
      const labels = columnLabels;
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i] ?? "";
        const target = mapping[label];
        if (target && target !== "skip") {
          // If hasHeader, use original header name; otherwise use index
          const key = hasHeader ? (csvHeaders[i] ?? String(i)) : String(i);
          apiMapping[key] = target;
        }
      }

      const res = await apiFetch("/api/employees/import", {
        method: "POST",
        body: JSON.stringify({
          action: "preview",
          csv: rawCsv,
          mapping: apiMapping,
          hasHeader,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setPreviewValid(data.data.valid);
        setPreviewErrors(data.data.errors);
        setPreviewTotal(data.data.totalRows);
        setStep("preview");
      } else {
        setError(data.error ?? "Preview failed");
      }
    } catch {
      setError("Failed to preview import");
    } finally {
      setPreviewing(false);
    }
  }, [rawCsv, mapping, hasHeader, csvHeaders, columnLabels]);

  // -------------------------------------------------------------------------
  // Step 4: Apply — call API
  // -------------------------------------------------------------------------

  const handleImport = useCallback(async () => {
    setImporting(true);
    setError("");

    try {
      const apiMapping: Record<string, string> = {};
      const labels = columnLabels;
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i] ?? "";
        const target = mapping[label];
        if (target && target !== "skip") {
          const key = hasHeader ? (csvHeaders[i] ?? String(i)) : String(i);
          apiMapping[key] = target;
        }
      }

      const res = await apiFetch("/api/employees/import", {
        method: "POST",
        body: JSON.stringify({
          action: "apply",
          csv: rawCsv,
          mapping: apiMapping,
          hasHeader,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setResult(data.data);
        setStep("results");
      } else {
        setError(data.error ?? "Import failed");
      }
    } catch {
      setError("Failed to import employees");
    } finally {
      setImporting(false);
    }
  }, [rawCsv, mapping, hasHeader, csvHeaders, columnLabels]);

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  const handleReset = useCallback(() => {
    setStep("upload");
    setRawCsv("");
    setCsvHeaders([]);
    setCsvRows([]);
    setHasHeader(true);
    setFileName("");
    setMapping({});
    setPreset("auto");
    setPreviewValid([]);
    setPreviewErrors([]);
    setPreviewTotal(0);
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // -------------------------------------------------------------------------
  // Step indicator
  // -------------------------------------------------------------------------

  const steps: { key: WizardStep; label: string; num: number }[] = [
    { key: "upload", label: "Upload", num: 1 },
    { key: "mapping", label: "Map Columns", num: 2 },
    { key: "preview", label: "Preview", num: 3 },
    { key: "results", label: "Results", num: 4 },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  // Preview rows for upload step (first 5)
  const uploadPreviewRows = useMemo(() => {
    if (!hasHeader) {
      return [csvHeaders, ...csvRows].slice(0, 5);
    }
    return csvRows.slice(0, 5);
  }, [csvHeaders, csvRows, hasHeader]);

  return (
    <div>
      <div className="mb-4">
        <Link href="/employees" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Employees
        </Link>
      </div>

      <PageHeader
        title="Import Employees"
        subtitle="Import employees from GPayroll, Talenox, or other payroll systems"
      />

      {/* Step indicator */}
      <div className="mt-6 mb-8">
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold " +
                  (i < stepIndex
                    ? "bg-green-100 text-green-700"
                    : i === stepIndex
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-400")
                }
              >
                {i < stepIndex ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              <span
                className={
                  "ml-2 text-sm font-medium " +
                  (i === stepIndex ? "text-gray-900" : "text-gray-400")
                }
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div
                  className={"mx-3 h-0.5 w-8 " + (i < stepIndex ? "bg-green-300" : "bg-gray-200")}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 1: Upload                                                     */}
      {/* ================================================================= */}
      {step === "upload" && (
        <>
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
              <p className="mb-3 text-xs text-gray-500">
                Supports exports from GPayroll, Talenox, and other payroll systems
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                id="csv-import-upload"
              />
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                Choose File
              </Button>
            </div>
          </Card>

          {/* Header detection toggle */}
          {csvHeaders.length > 0 && (
            <div className="mt-4">
              <Card>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(e) => setHasHeader(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">First row is a header</span>
                  </label>
                </div>

                {/* Preview table */}
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    Preview (first {Math.min(5, uploadPreviewRows.length)} data rows)
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      {hasHeader && (
                        <thead className="bg-gray-50">
                          <tr>
                            {csvHeaders.map((h, i) => (
                              <th
                                key={i}
                                className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {uploadPreviewRows.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-2 whitespace-nowrap text-gray-700">
                                {cell.trim()}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => {
                      // Re-run auto-detect when moving to mapping
                      if (hasHeader) {
                        const detected = autoDetectMapping(csvHeaders, GPAYROLL_MAPPING);
                        setMapping(detected);
                        setPreset("auto");
                      } else {
                        setMapping({});
                        setPreset("custom");
                      }
                      setStep("mapping");
                    }}
                  >
                    Next: Map Columns
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* STEP 2: Map Columns                                                */}
      {/* ================================================================= */}
      {step === "mapping" && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Column Mapping</h3>
              <p className="text-sm text-gray-500">
                Map each column from your CSV to a ClinicPay field
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Preset:</span>
              <select
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value as MappingPreset)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              >
                <option value="auto">Auto-detect</option>
                <option value="gpayroll">GPayroll Export</option>
                <option value="talenox">Talenox Export</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Missing required fields warning */}
          {missingRequired.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <span className="font-medium">Missing required fields:</span>{" "}
              {missingRequired
                .map((f) => CLINICPAY_FIELDS.find((cf) => cf.value === f)?.label ?? f)
                .join(", ")}
            </div>
          )}

          <div className="space-y-3">
            {columnLabels.map((colLabel, colIndex) => {
              const currentTarget = mapping[colLabel] ?? "";
              const samples = sampleValues[colLabel] ?? [];

              return (
                <div
                  key={colIndex}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="min-w-[160px]">
                    <p className="text-sm font-medium text-gray-900">{colLabel}</p>
                    {samples.length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        e.g. {samples.slice(0, 2).join(", ")}
                      </p>
                    )}
                  </div>
                  <svg
                    className="h-4 w-4 shrink-0 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                  <select
                    value={currentTarget}
                    onChange={(e) => handleMappingChange(colLabel, e.target.value)}
                    className={
                      "rounded-lg border px-3 py-1.5 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none " +
                      (currentTarget
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-500")
                    }
                  >
                    <option value="">-- Skip this column --</option>
                    {CLINICPAY_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                        {f.required ? " *" : ""}
                      </option>
                    ))}
                  </select>
                  {currentTarget && (
                    <Badge
                      variant={
                        CLINICPAY_FIELDS.find((f) => f.value === currentTarget)?.required
                          ? "info"
                          : "neutral"
                      }
                    >
                      {CLINICPAY_FIELDS.find((f) => f.value === currentTarget)?.required
                        ? "Required"
                        : "Optional"}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button
              onClick={handlePreview}
              loading={previewing}
              disabled={missingRequired.length > 0}
            >
              Next: Preview & Validate
            </Button>
          </div>
        </Card>
      )}

      {/* ================================================================= */}
      {/* STEP 3: Preview & Validate                                         */}
      {/* ================================================================= */}
      {step === "preview" && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Validation Results</h3>
              <p className="text-sm text-gray-500">
                {previewTotal} total rows &middot;{" "}
                <span className="font-medium text-green-600">{previewValid.length} valid</span>
                {previewErrors.length > 0 && (
                  <span className="font-medium text-red-600">
                    {" "}
                    &middot; {previewErrors.length} error{previewErrors.length !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Errors */}
          {previewErrors.length > 0 && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="mb-2 text-sm font-medium text-red-800">Validation Errors</p>
              <div className="max-h-48 overflow-y-auto">
                <ul className="space-y-1 text-sm text-red-700">
                  {previewErrors.map((err, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-xs text-red-400">Row {err.row}</span>
                      <span>[{err.field}]</span>
                      <span>{err.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Valid rows table */}
          {previewValid.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
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
                      Hire Date
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                      Position
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium tracking-wide text-gray-500 uppercase">
                      Basic Salary
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {previewValid.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <Badge variant="success">Valid</Badge>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{row.fullName}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">
                        {"\u2022\u2022\u2022\u2022\u2022" + row.nricLast4}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{row.dob}</td>
                      <td className="px-3 py-2 text-gray-700">{row.citizenshipStatus}</td>
                      <td className="px-3 py-2 text-gray-700">{row.hireDate}</td>
                      <td className="px-3 py-2 text-gray-700">{row.position || "\u2014"}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-900">
                        S${centsToDisplay(row.basicSalaryCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep("mapping")}>
              Back to Mapping
            </Button>
            <Button onClick={handleImport} loading={importing} disabled={previewValid.length === 0}>
              Import {previewValid.length} Employee{previewValid.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </Card>
      )}

      {/* ================================================================= */}
      {/* STEP 4: Results                                                    */}
      {/* ================================================================= */}
      {step === "results" && result && (
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
              {result.imported} employee{result.imported !== 1 ? "s" : ""} imported successfully
              {result.errors.length > 0 && (
                <span className="text-red-600">, {result.errors.length} failed</span>
              )}
            </p>

            {result.errors.length > 0 && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
                <p className="mb-2 text-sm font-medium text-red-800">Failed rows:</p>
                <ul className="space-y-1 text-sm text-red-700">
                  {result.errors.map((err, i) => (
                    <li key={i}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={handleReset}>
                Import More
              </Button>
              <Link href="/employees">
                <Button>Go to Employees</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
