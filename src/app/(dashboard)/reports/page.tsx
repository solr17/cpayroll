"use client";

import { useCallback, useState } from "react";
import { Card, Button, Modal, PageHeader, EmptyState, Table, Select } from "@/components/ui";
import { centsToCurrency } from "@/lib/utils/money";

/** Safe currency formatting — coerces to number to prevent NaN from string values */
function money(cents: unknown): string {
  return centsToCurrency(Number(cents) || 0);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Payslip {
  id: string;
  employeeId: string;
  basicSalaryCents: number;
  grossPayCents: number;
  netPayCents: number;
  employerCpfCents: number;
  employeeCpfCents: number;
  sdlCents: number;
  fwlCents: number;
  otPayCents: number | null;
  otHours: string | null;
  proratedDays: string | null;
  allowancesJson: AllowanceItem[] | null;
  deductionsJson: DeductionItem[] | null;
  employerTotalCostCents: number;
  employeeName?: string;
  department?: string | null;
  bankName?: string | null;
}

interface AllowanceItem {
  name: string;
  amountCents: number;
}

interface DeductionItem {
  name: string;
  amountCents: number;
}

interface PayRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  totalGrossCents: number | null;
  totalNetCents: number | null;
  totalEmployerCpfCents: number | null;
  totalEmployeeCpfCents: number | null;
  totalSdlCents: number | null;
  totalFwlCents: number | null;
}

type ReportType =
  | "payroll-detail"
  | "ytd-summary"
  | "bank-listing"
  | "monthly-reconciliation"
  | "payroll-summary"
  | "cpf-contribution"
  | "statutory-contribution"
  | "variance-report"
  | "ir8a-summary";

interface ReportCard {
  type: ReportType;
  name: string;
  description: string;
  periodType: "month" | "year";
}

interface ReportRow {
  [key: string]: string | number;
}

// ---------------------------------------------------------------------------
// Report definitions
// ---------------------------------------------------------------------------

const REPORTS: ReportCard[] = [
  {
    type: "payroll-detail",
    name: "Payroll Detail",
    description: "Per-employee breakdown for a selected month",
    periodType: "month",
  },
  {
    type: "ytd-summary",
    name: "Year-to-Date Summary",
    description: "Cumulative earnings per employee for the year",
    periodType: "year",
  },
  {
    type: "bank-listing",
    name: "Bank Listing",
    description: "Payment instruction summary by bank",
    periodType: "month",
  },
  {
    type: "monthly-reconciliation",
    name: "Monthly Reconciliation",
    description: "Month-over-month comparison",
    periodType: "month",
  },
  {
    type: "payroll-summary",
    name: "Payroll Summary",
    description: "Company/department-level totals",
    periodType: "month",
  },
  {
    type: "cpf-contribution",
    name: "CPF Contribution",
    description: "Employer + employee CPF per person",
    periodType: "month",
  },
  {
    type: "statutory-contribution",
    name: "Statutory Contribution",
    description: "CPF + SDL + FWL combined",
    periodType: "month",
  },
  {
    type: "variance-report",
    name: "Variance Report",
    description: "Flags changes from previous month",
    periodType: "month",
  },
  {
    type: "ir8a-summary",
    name: "IR8A Summary",
    description: "Annual tax filing data per employee",
    periodType: "year",
  },
];

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function buildYearOptions(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  const options: { value: string; label: string }[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    options.push({ value: String(y), label: String(y) });
  }
  return options;
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

function exportCsv(headers: string[], rows: ReportRow[], filename: string): void {
  const csvLines: string[] = [headers.join(",")];
  for (const row of rows) {
    const line = headers.map((h) => {
      const val = row[h];
      if (val === undefined || val === null) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvLines.push(line.join(","));
  }

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Report generation logic
// ---------------------------------------------------------------------------

function generatePayrollDetail(payslips: Payslip[]): { headers: string[]; rows: ReportRow[] } {
  const headers = [
    "Employee",
    "Basic",
    "Allowances",
    "OT Pay",
    "Gross",
    "Employee CPF",
    "Deductions",
    "Net Pay",
  ];
  const rows: ReportRow[] = payslips.map((ps) => {
    const totalAllowances = (ps.allowancesJson ?? []).reduce((s, a) => s + a.amountCents, 0);
    const totalDeductions = (ps.deductionsJson ?? []).reduce((s, d) => s + d.amountCents, 0);
    return {
      Employee: ps.employeeName ?? ps.employeeId,
      Basic: money(ps.basicSalaryCents),
      Allowances: money(totalAllowances),
      "OT Pay": money(ps.otPayCents ?? 0),
      Gross: money(ps.grossPayCents),
      "Employee CPF": money(ps.employeeCpfCents),
      Deductions: money(totalDeductions),
      "Net Pay": money(ps.netPayCents),
    };
  });
  return { headers, rows };
}

function generatePayrollSummary(payslips: Payslip[]): { headers: string[]; rows: ReportRow[] } {
  const headers = [
    "Department",
    "Headcount",
    "Total Gross",
    "Total Employee CPF",
    "Total Employer CPF",
    "Total Net Pay",
  ];
  const deptMap = new Map<
    string,
    { count: number; gross: number; empCpf: number; erCpf: number; net: number }
  >();

  for (const ps of payslips) {
    const dept = ps.department ?? "Unassigned";
    const current = deptMap.get(dept) ?? { count: 0, gross: 0, empCpf: 0, erCpf: 0, net: 0 };
    current.count += 1;
    current.gross += Number(ps.grossPayCents) || 0;
    current.empCpf += Number(ps.employeeCpfCents) || 0;
    current.erCpf += Number(ps.employerCpfCents) || 0;
    current.net += Number(ps.netPayCents) || 0;
    deptMap.set(dept, current);
  }

  const rows: ReportRow[] = Array.from(deptMap.entries()).map(([dept, data]) => ({
    Department: dept,
    Headcount: data.count,
    "Total Gross": money(data.gross),
    "Total Employee CPF": money(data.empCpf),
    "Total Employer CPF": money(data.erCpf),
    "Total Net Pay": money(data.net),
  }));
  return { headers, rows };
}

function generateCpfContribution(payslips: Payslip[]): { headers: string[]; rows: ReportRow[] } {
  const headers = ["Employee", "Employer CPF", "Employee CPF", "Total CPF"];
  const rows: ReportRow[] = payslips.map((ps) => ({
    Employee: ps.employeeName ?? ps.employeeId,
    "Employer CPF": money(ps.employerCpfCents),
    "Employee CPF": money(ps.employeeCpfCents),
    "Total CPF": money((Number(ps.employerCpfCents) || 0) + (Number(ps.employeeCpfCents) || 0)),
  }));
  return { headers, rows };
}

function generateStatutoryContribution(payslips: Payslip[]): {
  headers: string[];
  rows: ReportRow[];
} {
  const headers = ["Employee", "Employer CPF", "Employee CPF", "SDL", "FWL", "Total Statutory"];
  const rows: ReportRow[] = payslips.map((ps) => ({
    Employee: ps.employeeName ?? ps.employeeId,
    "Employer CPF": money(ps.employerCpfCents),
    "Employee CPF": money(ps.employeeCpfCents),
    SDL: money(ps.sdlCents),
    FWL: money(ps.fwlCents),
    "Total Statutory": money(
      (Number(ps.employerCpfCents) || 0) +
        (Number(ps.employeeCpfCents) || 0) +
        (Number(ps.sdlCents) || 0) +
        (Number(ps.fwlCents) || 0),
    ),
  }));
  return { headers, rows };
}

function generateBankListing(payslips: Payslip[]): { headers: string[]; rows: ReportRow[] } {
  const headers = ["Bank", "Employee Count", "Total Net Pay"];
  const bankMap = new Map<string, { count: number; totalNet: number }>();

  for (const ps of payslips) {
    const bank = ps.bankName ?? "Unknown";
    const current = bankMap.get(bank) ?? { count: 0, totalNet: 0 };
    current.count += 1;
    current.totalNet += Number(ps.netPayCents) || 0;
    bankMap.set(bank, current);
  }

  const rows: ReportRow[] = Array.from(bankMap.entries()).map(([bank, data]) => ({
    Bank: bank,
    "Employee Count": data.count,
    "Total Net Pay": money(data.totalNet),
  }));
  return { headers, rows };
}

function generateYtdSummary(allPayslips: Payslip[]): { headers: string[]; rows: ReportRow[] } {
  const headers = [
    "Employee",
    "Total Gross",
    "Total Employee CPF",
    "Total Employer CPF",
    "Total SDL",
    "Total Net Pay",
  ];
  const empMap = new Map<
    string,
    { name: string; gross: number; empCpf: number; erCpf: number; sdl: number; net: number }
  >();

  for (const ps of allPayslips) {
    const key = ps.employeeId;
    const current = empMap.get(key) ?? {
      name: ps.employeeName ?? ps.employeeId,
      gross: 0,
      empCpf: 0,
      erCpf: 0,
      sdl: 0,
      net: 0,
    };
    current.gross += Number(ps.grossPayCents) || 0;
    current.empCpf += Number(ps.employeeCpfCents) || 0;
    current.erCpf += Number(ps.employerCpfCents) || 0;
    current.sdl += Number(ps.sdlCents) || 0;
    current.net += Number(ps.netPayCents) || 0;
    empMap.set(key, current);
  }

  const rows: ReportRow[] = Array.from(empMap.values()).map((data) => ({
    Employee: data.name,
    "Total Gross": money(data.gross),
    "Total Employee CPF": money(data.empCpf),
    "Total Employer CPF": money(data.erCpf),
    "Total SDL": money(data.sdl),
    "Total Net Pay": money(data.net),
  }));
  return { headers, rows };
}

function generateVarianceReport(
  currentPayslips: Payslip[],
  previousPayslips: Payslip[],
): { headers: string[]; rows: ReportRow[] } {
  const headers = [
    "Employee",
    "Current Gross",
    "Previous Gross",
    "Variance",
    "Current Net",
    "Previous Net",
    "Net Variance",
  ];

  const prevMap = new Map<string, Payslip>();
  for (const ps of previousPayslips) {
    prevMap.set(ps.employeeId, ps);
  }

  const rows: ReportRow[] = currentPayslips.map((ps) => {
    const prev = prevMap.get(ps.employeeId);
    const prevGross = Number(prev?.grossPayCents) || 0;
    const prevNet = Number(prev?.netPayCents) || 0;
    const curGross = Number(ps.grossPayCents) || 0;
    const curNet = Number(ps.netPayCents) || 0;
    return {
      Employee: ps.employeeName ?? ps.employeeId,
      "Current Gross": money(curGross),
      "Previous Gross": prev ? money(prevGross) : "N/A",
      Variance: prev ? money(curGross - prevGross) : "New",
      "Current Net": money(curNet),
      "Previous Net": prev ? money(prevNet) : "N/A",
      "Net Variance": prev ? money(curNet - prevNet) : "New",
    };
  });
  return { headers, rows };
}

function generateIr8aSummary(allPayslips: Payslip[]): { headers: string[]; rows: ReportRow[] } {
  // IR8A is the same aggregation as YTD — annual totals per employee
  return generateYtdSummary(allPayslips);
}

function generateReconciliation(
  currentPayslips: Payslip[],
  previousPayslips: Payslip[],
): { headers: string[]; rows: ReportRow[] } {
  const headers = ["Metric", "Current Month", "Previous Month", "Change"];

  const sumField = (slips: Payslip[], field: keyof Payslip): number =>
    slips.reduce((s, ps) => s + (Number(ps[field]) || 0), 0);

  const metrics = [
    { label: "Headcount", current: currentPayslips.length, previous: previousPayslips.length },
    {
      label: "Total Gross",
      current: sumField(currentPayslips, "grossPayCents"),
      previous: sumField(previousPayslips, "grossPayCents"),
    },
    {
      label: "Total Net Pay",
      current: sumField(currentPayslips, "netPayCents"),
      previous: sumField(previousPayslips, "netPayCents"),
    },
    {
      label: "Total Employer CPF",
      current: sumField(currentPayslips, "employerCpfCents"),
      previous: sumField(previousPayslips, "employerCpfCents"),
    },
    {
      label: "Total Employee CPF",
      current: sumField(currentPayslips, "employeeCpfCents"),
      previous: sumField(previousPayslips, "employeeCpfCents"),
    },
    {
      label: "Total SDL",
      current: sumField(currentPayslips, "sdlCents"),
      previous: sumField(previousPayslips, "sdlCents"),
    },
  ];

  const rows: ReportRow[] = metrics.map((m) => {
    const isCurrency = m.label !== "Headcount";
    return {
      Metric: m.label,
      "Current Month": isCurrency ? money(m.current) : String(m.current),
      "Previous Month": isCurrency ? money(m.previous) : String(m.previous),
      Change: isCurrency ? money(m.current - m.previous) : String(m.current - m.previous),
    };
  });
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportCard | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportHeaders, setReportHeaders] = useState<string[]>([]);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportTitle, setReportTitle] = useState("");

  const yearOptions = buildYearOptions();

  const openModal = useCallback((report: ReportCard) => {
    setSelectedReport(report);
    setError("");
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedReport(null);
  }, []);

  // Fetch all pay runs then filter by period
  const fetchPayRunsForPeriod = useCallback(
    async (year: string, month?: string): Promise<PayRun[]> => {
      const res = await fetch("/api/payroll/pay-runs");
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to fetch pay runs");

      const runs = (data.data as PayRun[]).filter((r) => {
        const start = r.periodStart;
        if (month) {
          return start.startsWith(`${year}-${month}`);
        }
        return start.startsWith(year);
      });
      return runs;
    },
    [],
  );

  // Fetch payslips for a single pay run
  const fetchPayslips = useCallback(async (payRunId: string): Promise<Payslip[]> => {
    const res = await fetch(`/api/payroll/pay-runs/${payRunId}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? "Failed to fetch payslips");
    const runData = data.data;
    // API returns { payslip: {...}, employeeName, nricLast4, department, ... }[]
    // Flatten into Payslip[] with numeric coercion for safety
    const rawSlips = runData.payslips ?? [];
    return rawSlips.map(
      (row: {
        payslip: Record<string, unknown>;
        employeeName: string;
        nricLast4: string;
        department: string | null;
      }) => ({
        id: String(row.payslip.id ?? ""),
        employeeId: String(row.payslip.employeeId ?? ""),
        basicSalaryCents: Number(row.payslip.basicSalaryCents ?? 0),
        grossPayCents: Number(row.payslip.grossPayCents ?? 0),
        netPayCents: Number(row.payslip.netPayCents ?? 0),
        employerCpfCents: Number(row.payslip.employerCpfCents ?? 0),
        employeeCpfCents: Number(row.payslip.employeeCpfCents ?? 0),
        sdlCents: Number(row.payslip.sdlCents ?? 0),
        fwlCents: Number(row.payslip.fwlCents ?? 0),
        otPayCents: row.payslip.otPayCents != null ? Number(row.payslip.otPayCents) : null,
        otHours: row.payslip.otHours != null ? String(row.payslip.otHours) : null,
        proratedDays: row.payslip.proratedDays != null ? String(row.payslip.proratedDays) : null,
        allowancesJson: (row.payslip.allowancesJson as AllowanceItem[] | null) ?? null,
        deductionsJson: (row.payslip.deductionsJson as DeductionItem[] | null) ?? null,
        employerTotalCostCents: Number(row.payslip.employerTotalCostCents ?? 0),
        employeeName: row.employeeName,
        department: row.department,
      }),
    );
  }, []);

  // Fetch payslips for all runs in a period
  const fetchAllPayslipsForPeriod = useCallback(
    async (year: string, month?: string): Promise<Payslip[]> => {
      const runs = await fetchPayRunsForPeriod(year, month);
      if (runs.length === 0) return [];
      const allSlips: Payslip[] = [];
      for (const run of runs) {
        const slips = await fetchPayslips(run.id);
        allSlips.push(...slips);
      }
      return allSlips;
    },
    [fetchPayRunsForPeriod, fetchPayslips],
  );

  // Get previous month string
  const getPreviousMonth = useCallback(
    (year: string, month: string): { year: string; month: string } => {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (m === 1) return { year: String(y - 1), month: "12" };
      return { year: String(y), month: String(m - 1).padStart(2, "0") };
    },
    [],
  );

  const handleGenerate = useCallback(async () => {
    if (!selectedReport) return;
    setLoading(true);
    setError("");
    setReportHeaders([]);
    setReportRows([]);

    try {
      let result: { headers: string[]; rows: ReportRow[] };

      switch (selectedReport.type) {
        case "payroll-detail": {
          const slips = await fetchAllPayslipsForPeriod(selectedYear, selectedMonth);
          if (slips.length === 0) throw new Error("No payslip data found for the selected period");
          result = generatePayrollDetail(slips);
          break;
        }
        case "payroll-summary": {
          const slips = await fetchAllPayslipsForPeriod(selectedYear, selectedMonth);
          if (slips.length === 0) throw new Error("No payslip data found for the selected period");
          result = generatePayrollSummary(slips);
          break;
        }
        case "cpf-contribution": {
          const slips = await fetchAllPayslipsForPeriod(selectedYear, selectedMonth);
          if (slips.length === 0) throw new Error("No payslip data found for the selected period");
          result = generateCpfContribution(slips);
          break;
        }
        case "statutory-contribution": {
          const slips = await fetchAllPayslipsForPeriod(selectedYear, selectedMonth);
          if (slips.length === 0) throw new Error("No payslip data found for the selected period");
          result = generateStatutoryContribution(slips);
          break;
        }
        case "bank-listing": {
          const slips = await fetchAllPayslipsForPeriod(selectedYear, selectedMonth);
          if (slips.length === 0) throw new Error("No payslip data found for the selected period");
          result = generateBankListing(slips);
          break;
        }
        case "ytd-summary": {
          const slips = await fetchAllPayslipsForPeriod(selectedYear);
          if (slips.length === 0) throw new Error("No payslip data found for the selected year");
          result = generateYtdSummary(slips);
          break;
        }
        case "ir8a-summary": {
          const slips = await fetchAllPayslipsForPeriod(selectedYear);
          if (slips.length === 0) throw new Error("No payslip data found for the selected year");
          result = generateIr8aSummary(slips);
          break;
        }
        case "variance-report": {
          const currentSlips = await fetchAllPayslipsForPeriod(selectedYear, selectedMonth);
          const prev = getPreviousMonth(selectedYear, selectedMonth);
          const previousSlips = await fetchAllPayslipsForPeriod(prev.year, prev.month);
          if (currentSlips.length === 0)
            throw new Error("No payslip data found for the current period");
          result = generateVarianceReport(currentSlips, previousSlips);
          break;
        }
        case "monthly-reconciliation": {
          const currentSlips = await fetchAllPayslipsForPeriod(selectedYear, selectedMonth);
          const prev = getPreviousMonth(selectedYear, selectedMonth);
          const previousSlips = await fetchAllPayslipsForPeriod(prev.year, prev.month);
          if (currentSlips.length === 0)
            throw new Error("No payslip data found for the current period");
          result = generateReconciliation(currentSlips, previousSlips);
          break;
        }
        default:
          throw new Error("Unknown report type");
      }

      const periodLabel =
        selectedReport.periodType === "year"
          ? selectedYear
          : `${MONTHS.find((m) => m.value === selectedMonth)?.label ?? selectedMonth} ${selectedYear}`;
      setReportTitle(`${selectedReport.name} — ${periodLabel}`);
      setReportHeaders(result.headers);
      setReportRows(result.rows);
      setModalOpen(false);
      setSelectedReport(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }, [selectedReport, selectedYear, selectedMonth, fetchAllPayslipsForPeriod, getPreviousMonth]);

  const handleExportCsv = useCallback(() => {
    if (reportHeaders.length === 0 || reportRows.length === 0) return;
    const safeName = reportTitle.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    exportCsv(reportHeaders, reportRows, `${safeName}.csv`);
  }, [reportHeaders, reportRows, reportTitle]);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and export payroll reports" />

      {/* Report cards grid */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => (
          <Card key={report.type}>
            <h3 className="text-base font-semibold text-gray-900">{report.name}</h3>
            <p className="mt-1 text-sm text-gray-500">{report.description}</p>
            <div className="mt-4">
              <Button size="sm" variant="secondary" onClick={() => openModal(report)}>
                Generate
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Report generation modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={selectedReport ? `Generate ${selectedReport.name}` : "Generate Report"}
      >
        <div className="space-y-4">
          {selectedReport?.periodType === "month" && (
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Month"
                id="report-month"
                options={MONTHS}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
              <Select
                label="Year"
                id="report-year"
                options={yearOptions}
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              />
            </div>
          )}

          {selectedReport?.periodType === "year" && (
            <Select
              label="Year"
              id="report-year"
              options={yearOptions}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} loading={loading}>
              Generate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Report display area */}
      {reportHeaders.length > 0 && (
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{reportTitle}</h2>
            <Button size="sm" variant="secondary" onClick={handleExportCsv}>
              Export CSV
            </Button>
          </div>

          <Table>
            <Table.Head>
              <tr>
                {reportHeaders.map((header) => (
                  <Table.HeadCell key={header}>{header}</Table.HeadCell>
                ))}
              </tr>
            </Table.Head>
            <Table.Body>
              {reportRows.map((row, idx) => (
                <Table.Row key={idx}>
                  {reportHeaders.map((header) => (
                    <Table.Cell key={header}>{String(row[header] ?? "")}</Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          <p className="mt-3 text-xs text-gray-400">
            {reportRows.length} {reportRows.length === 1 ? "row" : "rows"}
          </p>
        </div>
      )}

      {reportHeaders.length === 0 && !loading && (
        <div className="mt-10">
          <EmptyState message="Select a report above and click Generate to view data." />
        </div>
      )}
    </div>
  );
}
