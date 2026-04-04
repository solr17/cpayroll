"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Button,
  Badge,
  PageHeader,
  Spinner,
  EmptyState,
  Table,
  StatCard,
  Select,
} from "@/components/ui";
import { centsToCurrency } from "@/lib/utils/money";
import { apiFetch } from "@/lib/fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  employeeName?: string;
}

interface PayRunWithPayslips extends PayRun {
  payslips: Payslip[];
}

type FilingStatus = "pending" | "generated" | "submitted";

interface FilingRecord {
  payRunId: string;
  period: string;
  status: FilingStatus;
  totalCpfCents: number;
  totalSdlCents: number;
  payRunStatus: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFilingDeadline(year: number, month: number): string {
  // CPF filing deadline is the 14th of the next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `14 ${new Date(nextYear, nextMonth - 1).toLocaleString("en-SG", { month: "long" })} ${nextYear}`;
}

function formatPeriod(periodStart: string): string {
  const date = new Date(periodStart);
  return date.toLocaleString("en-SG", { month: "long", year: "numeric" });
}

function getFilingStatusFromPayRun(status: string): FilingStatus {
  if (status === "filed") return "submitted";
  if (["calculated", "reviewed", "approved", "paid"].includes(status)) return "generated";
  return "pending";
}

function buildYearOptions(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  const options: { value: string; label: string }[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    options.push({ value: String(y), label: String(y) });
  }
  return options;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CpfFilingPage() {
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Generate filing state
  const [selectedPayRunId, setSelectedPayRunId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [previewLines, setPreviewLines] = useState<string[]>([]);

  // IR8A state
  const [ir8aYear, setIr8aYear] = useState(String(new Date().getFullYear()));
  const [ir8aLoading, setIr8aLoading] = useState(false);
  const [ir8aEmployees, setIr8aEmployees] = useState<
    { name: string; gross: number; empCpf: number; erCpf: number }[]
  >([]);
  const [ir8aError, setIr8aError] = useState("");

  const yearOptions = buildYearOptions();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Fetch pay runs
  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/payroll/pay-runs");
        const data = await res.json();
        if (data.success) {
          setPayRuns(data.data as PayRun[]);
        } else {
          setError(data.error ?? "Failed to load pay runs");
        }
      } catch {
        setError("Failed to load pay runs");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Current month's pay run data
  const currentMonthRuns = payRuns.filter((r) => {
    const start = r.periodStart;
    const prefix = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    return start.startsWith(prefix);
  });

  const currentMonthTotalCpf = currentMonthRuns.reduce(
    (sum, r) => sum + (r.totalEmployerCpfCents ?? 0) + (r.totalEmployeeCpfCents ?? 0),
    0,
  );
  const currentMonthTotalSdl = currentMonthRuns.reduce((sum, r) => sum + (r.totalSdlCents ?? 0), 0);

  const currentMonthFilingStatus: FilingStatus =
    currentMonthRuns.length === 0
      ? "pending"
      : currentMonthRuns.some((r) => r.status === "filed")
        ? "submitted"
        : currentMonthRuns.some((r) =>
              ["calculated", "reviewed", "approved", "paid"].includes(r.status),
            )
          ? "generated"
          : "pending";

  // Filing records for the table
  const filingRecords: FilingRecord[] = payRuns
    .filter((r) => r.status !== "draft")
    .map((r) => ({
      payRunId: r.id,
      period: formatPeriod(r.periodStart),
      status: getFilingStatusFromPayRun(r.status),
      totalCpfCents: (r.totalEmployerCpfCents ?? 0) + (r.totalEmployeeCpfCents ?? 0),
      totalSdlCents: r.totalSdlCents ?? 0,
      payRunStatus: r.status,
    }))
    .sort((a, b) => (a.period > b.period ? -1 : 1));

  // Eligible pay runs for CPF file generation
  const eligibleRuns = payRuns.filter((r) =>
    ["calculated", "reviewed", "approved", "paid", "filed"].includes(r.status),
  );

  const payRunOptions = [
    { value: "", label: "Select a pay run..." },
    ...eligibleRuns.map((r) => ({
      value: r.id,
      label: `${formatPeriod(r.periodStart)} (${r.status})`,
    })),
  ];

  // Generate CPF EZPay file
  const handleGenerateCpfFile = useCallback(async () => {
    if (!selectedPayRunId) return;
    setGenerating(true);
    setGenerateError("");
    setPreviewLines([]);

    try {
      const res = await fetch(`/api/payroll/pay-runs/${selectedPayRunId}/export?type=cpf`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error ?? "Failed to generate CPF file");
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/csv")) {
        const csvText = await res.text();

        // Show preview
        const lines = csvText.split("\n").filter((l) => l.trim().length > 0);
        setPreviewLines(lines);

        // Trigger download
        const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const disposition = res.headers.get("content-disposition") ?? "";
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
        a.download = filenameMatch?.[1] ?? "cpf-ezpay.csv";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // JSON error response
        const data = await res.json();
        throw new Error(data.error ?? "Unexpected response format");
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate CPF file");
    } finally {
      setGenerating(false);
    }
  }, [selectedPayRunId]);

  // CPF FTP Submission state
  const [cpfFtpGenerating, setCpfFtpGenerating] = useState(false);
  const [cpfFtpError, setCpfFtpError] = useState("");
  const [cpfFtpPreview, setCpfFtpPreview] = useState<string[]>([]);

  // Load IR8A annual data
  const handleLoadIr8a = useCallback(async () => {
    setIr8aLoading(true);
    setIr8aError("");
    setIr8aEmployees([]);

    try {
      const res = await apiFetch("/api/payroll/pay-runs");
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to fetch pay runs");

      const yearRuns = (data.data as PayRun[]).filter(
        (r) => r.periodStart.startsWith(ir8aYear) && r.status !== "draft",
      );

      if (yearRuns.length === 0) {
        setIr8aError("No completed pay runs found for the selected year");
        return;
      }

      // Fetch payslips for each run and aggregate by employee
      const empMap = new Map<
        string,
        { name: string; gross: number; empCpf: number; erCpf: number }
      >();

      for (const run of yearRuns) {
        const runRes = await fetch(`/api/payroll/pay-runs/${run.id}`);
        const runData = await runRes.json();
        if (!runData.success) continue;

        const payslips = (runData.data as PayRunWithPayslips).payslips ?? [];
        for (const ps of payslips) {
          const key = ps.employeeId;
          const current = empMap.get(key) ?? {
            name: ps.employeeName ?? ps.employeeId,
            gross: 0,
            empCpf: 0,
            erCpf: 0,
          };
          current.gross += ps.grossPayCents;
          current.empCpf += ps.employeeCpfCents;
          current.erCpf += ps.employerCpfCents;
          empMap.set(key, current);
        }
      }

      setIr8aEmployees(Array.from(empMap.values()));
    } catch (err) {
      setIr8aError(err instanceof Error ? err.message : "Failed to load IR8A data");
    } finally {
      setIr8aLoading(false);
    }
  }, [ir8aYear]);

  // Download IR8A AIS text file
  const handleDownloadIr8aText = useCallback(async () => {
    setIr8aLoading(true);
    setIr8aError("");

    try {
      const res = await fetch(`/api/reports/ir8a?year=${ir8aYear}&format=text`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error ?? "Failed to generate IR8A file");
      }

      const text = await res.text();
      const disposition = res.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `IR8A_AIS_YA${Number(ir8aYear) + 1}.txt`;

      const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setIr8aError(err instanceof Error ? err.message : "Failed to download IR8A file");
    } finally {
      setIr8aLoading(false);
    }
  }, [ir8aYear]);

  // Generate CPF FTP Submission file
  const handleGenerateCpfFtp = useCallback(async () => {
    if (!selectedPayRunId) return;
    setCpfFtpGenerating(true);
    setCpfFtpError("");
    setCpfFtpPreview([]);

    try {
      const res = await fetch(`/api/payroll/pay-runs/${selectedPayRunId}/export?type=cpf-ftp`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error ?? "Failed to generate CPF submission file");
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/plain")) {
        const fileText = await res.text();

        const lines = fileText.split("\n").filter((l) => l.trim().length > 0);
        setCpfFtpPreview(lines);

        const blob = new Blob([fileText], { type: "text/plain;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const disposition = res.headers.get("content-disposition") ?? "";
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
        a.download = filenameMatch?.[1] ?? "cpf-submission.txt";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        throw new Error(data.error ?? "Unexpected response format");
      }
    } catch (err) {
      setCpfFtpError(err instanceof Error ? err.message : "Failed to generate CPF submission file");
    } finally {
      setCpfFtpGenerating(false);
    }
  }, [selectedPayRunId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="CPF Filing" />
        <div className="mt-8">
          <Card>
            <p className="text-sm text-red-600">{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="CPF Filing" subtitle="Manage CPF and statutory filings" />

      {/* Filing status overview */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Filing Status"
          value={
            currentMonthFilingStatus === "submitted"
              ? "Submitted"
              : currentMonthFilingStatus === "generated"
                ? "Ready"
                : "Pending"
          }
        />
        <StatCard
          label="Total CPF (This Month)"
          value={currentMonthTotalCpf > 0 ? centsToCurrency(currentMonthTotalCpf) : "--"}
        />
        <StatCard
          label="Total SDL (This Month)"
          value={currentMonthTotalSdl > 0 ? centsToCurrency(currentMonthTotalSdl) : "--"}
        />
        <StatCard label="Filing Deadline" value={getFilingDeadline(currentYear, currentMonth)} />
      </div>

      {/* Generate CPF Filing */}
      <div className="mt-10">
        <Card title="Generate CPF EZPay File">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Select a completed pay run to generate the CPF EZPay CSV file for submission to the
              CPF Board.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Select
                label="Pay Run"
                id="cpf-pay-run"
                options={payRunOptions}
                value={selectedPayRunId}
                onChange={(e) => {
                  setSelectedPayRunId(e.target.value);
                  setPreviewLines([]);
                  setGenerateError("");
                }}
                className="sm:w-80"
              />
              <Button
                onClick={handleGenerateCpfFile}
                loading={generating}
                disabled={!selectedPayRunId}
              >
                Generate CPF EZPay File
              </Button>
            </div>

            {generateError && <p className="text-sm text-red-600">{generateError}</p>}

            {/* File preview */}
            {previewLines.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-medium text-gray-700">File Preview</h4>
                <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <pre className="text-xs text-gray-600">
                    {previewLines.map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Monthly filing list */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Filing History</h2>

        {filingRecords.length === 0 ? (
          <EmptyState message="No filing records yet. Complete a payroll run to see filings here." />
        ) : (
          <Table>
            <Table.Head>
              <tr>
                <Table.HeadCell>Period</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Total CPF</Table.HeadCell>
                <Table.HeadCell>Total SDL</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </tr>
            </Table.Head>
            <Table.Body>
              {filingRecords.map((record) => (
                <Table.Row key={record.payRunId}>
                  <Table.Cell>{record.period}</Table.Cell>
                  <Table.Cell>
                    <Badge
                      variant={
                        record.status === "submitted"
                          ? "success"
                          : record.status === "generated"
                            ? "info"
                            : "warning"
                      }
                    >
                      {record.status === "submitted"
                        ? "Submitted"
                        : record.status === "generated"
                          ? "Generated"
                          : "Pending"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="font-mono">
                    {centsToCurrency(record.totalCpfCents)}
                  </Table.Cell>
                  <Table.Cell className="font-mono">
                    {centsToCurrency(record.totalSdlCents)}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedPayRunId(record.payRunId);
                        setPreviewLines([]);
                        setGenerateError("");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Download
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* CPF Board FTP Submission */}
      <div className="mt-10">
        <Card title="CPF Board Submission File (FTP Format)">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Generate a fixed-width CPF Board FTP submission file for e-Submit@CPF. This is the
              formal bulk submission format, as opposed to the simpler EZPay CSV above.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Select
                label="Pay Run"
                id="cpf-ftp-pay-run"
                options={payRunOptions}
                value={selectedPayRunId}
                onChange={(e) => {
                  setSelectedPayRunId(e.target.value);
                  setCpfFtpPreview([]);
                  setCpfFtpError("");
                }}
                className="sm:w-80"
              />
              <Button
                onClick={handleGenerateCpfFtp}
                loading={cpfFtpGenerating}
                disabled={!selectedPayRunId}
              >
                Generate CPF Submission File
              </Button>
            </div>

            {cpfFtpError && <p className="text-sm text-red-600">{cpfFtpError}</p>}

            {cpfFtpPreview.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-medium text-gray-700">File Preview</h4>
                <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <pre className="text-xs text-gray-600">
                    {cpfFtpPreview.map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* IR8A Annual Filing */}
      <div className="mt-10">
        <Card title="IR8A Annual Filing">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Generate annual IR8A tax filing data for IRAS submission. Download the AIS text file
              for electronic submission to IRAS, or load annual totals to review before filing.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Select
                label="Year"
                id="ir8a-year"
                options={yearOptions}
                value={ir8aYear}
                onChange={(e) => {
                  setIr8aYear(e.target.value);
                  setIr8aEmployees([]);
                  setIr8aError("");
                }}
                className="sm:w-48"
              />
              <Button onClick={handleLoadIr8a} loading={ir8aLoading} variant="secondary">
                Load Annual Totals
              </Button>
              <Button onClick={handleDownloadIr8aText} loading={ir8aLoading}>
                Download IR8A AIS File
              </Button>
            </div>

            {ir8aError && <p className="text-sm text-red-600">{ir8aError}</p>}

            {ir8aEmployees.length > 0 && (
              <div className="mt-4">
                <Table>
                  <Table.Head>
                    <tr>
                      <Table.HeadCell>Employee</Table.HeadCell>
                      <Table.HeadCell>Gross Remuneration</Table.HeadCell>
                      <Table.HeadCell>Employee CPF</Table.HeadCell>
                      <Table.HeadCell>Employer CPF</Table.HeadCell>
                      <Table.HeadCell>Total CPF</Table.HeadCell>
                    </tr>
                  </Table.Head>
                  <Table.Body>
                    {ir8aEmployees.map((emp, idx) => (
                      <Table.Row key={idx}>
                        <Table.Cell>{emp.name}</Table.Cell>
                        <Table.Cell className="font-mono">{centsToCurrency(emp.gross)}</Table.Cell>
                        <Table.Cell className="font-mono">{centsToCurrency(emp.empCpf)}</Table.Cell>
                        <Table.Cell className="font-mono">{centsToCurrency(emp.erCpf)}</Table.Cell>
                        <Table.Cell className="font-mono">
                          {centsToCurrency(emp.empCpf + emp.erCpf)}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                    {/* Totals row */}
                    <Table.Row className="bg-gray-50 font-semibold">
                      <Table.Cell>Total ({ir8aEmployees.length} employees)</Table.Cell>
                      <Table.Cell className="font-mono">
                        {centsToCurrency(ir8aEmployees.reduce((s, e) => s + e.gross, 0))}
                      </Table.Cell>
                      <Table.Cell className="font-mono">
                        {centsToCurrency(ir8aEmployees.reduce((s, e) => s + e.empCpf, 0))}
                      </Table.Cell>
                      <Table.Cell className="font-mono">
                        {centsToCurrency(ir8aEmployees.reduce((s, e) => s + e.erCpf, 0))}
                      </Table.Cell>
                      <Table.Cell className="font-mono">
                        {centsToCurrency(ir8aEmployees.reduce((s, e) => s + e.empCpf + e.erCpf, 0))}
                      </Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
