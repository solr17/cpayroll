"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { centsToCurrency } from "@/lib/utils/money";
import { apiFetch } from "@/lib/fetch";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AllowanceItem {
  name: string;
  amountCents: number;
}

interface DeductionItem {
  name: string;
  amountCents: number;
}

interface PayslipData {
  id: string;
  payRunId: string;
  employeeId: string;
  basicSalaryCents: number;
  proratedDays: number | null;
  grossPayCents: number;
  otHours: number;
  otPayCents: number;
  allowancesJson: AllowanceItem[] | null;
  deductionsJson: DeductionItem[] | null;
  employerCpfCents: number;
  employeeCpfCents: number;
  sdlCents: number;
  fwlCents: number;
  netPayCents: number;
  employerTotalCostCents: number;
  createdAt: string;
}

interface EmployeeData {
  fullName: string;
  nricLast4: string;
  position: string | null;
  department: string | null;
  citizenshipStatus: string;
}

interface CpfRecordData {
  owCents: number;
  awCents: number;
  owCappedCents: number;
  awCappedCents: number;
  employerRate: number;
  employeeRate: number;
  totalRate: number;
  employerAmountCents: number;
  employeeAmountCents: number;
  totalAmountCents: number;
  ageBand: string;
  rateTable: string;
  ytdOwCents: number;
  ytdAwCents: number;
}

interface PayRunData {
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
}

interface PayslipResponse {
  payslip: PayslipData;
  employee: EmployeeData;
  cpfRecord: CpfRecordData;
  payRun: PayRunData;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function maskNric(last4: string): string {
  return `\u2022\u2022\u2022\u2022\u2022${last4}`;
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function statusBadgeClasses(status: string): string {
  switch (status.toLowerCase()) {
    case "finalized":
    case "paid":
      return "bg-green-100 text-green-800";
    case "draft":
      return "bg-yellow-100 text-yellow-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
      {children}
    </h2>
  );
}

function LineItem({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between py-1">
      <span className={bold ? "font-semibold text-gray-900" : "text-gray-600"}>{label}</span>
      <span className={bold ? "font-semibold text-gray-900" : "text-gray-900"}>{value}</span>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PayslipViewerPage() {
  const params = useParams();
  const [data, setData] = useState<PayslipResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [payNowSvg, setPayNowSvg] = useState("");
  const [payNowAmount, setPayNowAmount] = useState("");
  const [payNowRef, setPayNowRef] = useState("");
  const [payNowLoading, setPayNowLoading] = useState(false);
  const [payNowError, setPayNowError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/payroll/payslips/${params.id}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error ?? "Failed to load payslip");
        }
      } catch {
        setError("Failed to load payslip");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const handleDownloadHtml = useCallback(async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      const res = await fetch(`/api/payroll/payslips/${params.id}/export`);
      if (!res.ok) {
        throw new Error("Export failed");
      }
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `payslip-${params.id}.html`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Failed to download payslip HTML");
    } finally {
      setDownloading(false);
    }
  }, [params.id]);

  const handlePayNowQr = useCallback(async () => {
    setPayNowLoading(true);
    setPayNowError("");
    try {
      const res = await apiFetch("/api/payroll/paynow", {
        method: "POST",
        body: JSON.stringify({ payslipId: params.id }),
      });
      const json = await res.json();
      if (json.success) {
        setPayNowSvg(json.data.qrSvg);
        setPayNowAmount(`S$${Number(json.data.amount).toFixed(2)}`);
        setPayNowRef(json.data.reference);
      } else {
        setPayNowError(json.error ?? "Failed to generate PayNow QR");
      }
    } catch {
      setPayNowError("Failed to generate PayNow QR");
    } finally {
      setPayNowLoading(false);
    }
  }, [params.id]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <span className="ml-3 text-gray-500">Loading payslip...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8">
        <Link href="/payroll" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Payroll
        </Link>
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <Link href="/payroll" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Payroll
        </Link>
        <div className="mt-4 text-gray-500">Payslip not found</div>
      </div>
    );
  }

  const { payslip, employee, cpfRecord, payRun } = data;

  const allowances: AllowanceItem[] = payslip.allowancesJson ?? [];
  const deductions: DeductionItem[] = payslip.deductionsJson ?? [];
  const totalDeductionsCents =
    payslip.employeeCpfCents + deductions.reduce((sum, d) => sum + d.amountCents, 0);

  return (
    <>
      {/* Print-friendly styles */}
      <style jsx global>{`
        @media print {
          /* Hide sidebar and non-printable elements */
          aside,
          nav,
          .no-print {
            display: none !important;
          }
          /* Reset layout for print */
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
          .flex.min-h-screen {
            display: block !important;
          }
          /* Clean print styling */
          body {
            font-size: 12pt;
            color: #000;
            background: #fff;
          }
          .print-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
          }
          .payslip-card {
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            break-inside: avoid;
          }
          /* Ensure net pay remains prominent */
          .net-pay-section {
            background-color: #f0fdf4 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="print-container mx-auto max-w-3xl">
        {/* Navigation & actions */}
        <div className="no-print mb-6 flex items-center justify-between">
          <Link
            href={`/payroll/${payslip.payRunId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; Back to Pay Run
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Print Payslip
            </button>
            <button
              onClick={handleDownloadHtml}
              disabled={downloading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {downloading ? "Downloading..." : "Download HTML"}
            </button>
          </div>
          {downloadError && <p className="mt-2 text-sm text-red-600">{downloadError}</p>}
        </div>

        {/* ── Payslip Header ──────────────────────────────────────────── */}
        <div className="payslip-card mb-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payslip</h1>
              <p className="mt-1 text-sm text-gray-500">
                Period: {formatDate(payRun.periodStart)} &ndash; {formatDate(payRun.periodEnd)}
              </p>
              <p className="text-sm text-gray-500">Payment Date: {formatDate(payRun.payDate)}</p>
            </div>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClasses(payRun.status)}`}
            >
              {payRun.status}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Employee</p>
              <p className="font-semibold text-gray-900">{employee.fullName}</p>
              <p className="text-sm text-gray-500">NRIC: {maskNric(employee.nricLast4)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Position</p>
              <p className="font-medium text-gray-900">{employee.position ?? "—"}</p>
              <p className="text-sm text-gray-500">
                {employee.department ?? "—"} &middot; {employee.citizenshipStatus}
              </p>
            </div>
          </div>
        </div>

        {/* ── Earnings ────────────────────────────────────────────────── */}
        <div className="payslip-card mb-6 rounded-xl bg-white p-6 shadow-sm">
          <SectionHeading>Earnings</SectionHeading>

          <LineItem label="Basic Salary" value={centsToCurrency(payslip.basicSalaryCents)} />

          {payslip.proratedDays !== null && (
            <div className="py-1 text-sm text-gray-500 italic">
              Pro-rated: {payslip.proratedDays} days
            </div>
          )}

          {allowances.map((a, i) => (
            <LineItem key={i} label={a.name} value={centsToCurrency(a.amountCents)} />
          ))}

          {payslip.otHours > 0 && (
            <LineItem
              label={`Overtime (${payslip.otHours}h)`}
              value={centsToCurrency(payslip.otPayCents)}
            />
          )}

          <div className="mt-2 border-t border-gray-200 pt-2">
            <LineItem label="Gross Pay" value={centsToCurrency(payslip.grossPayCents)} bold />
          </div>
        </div>

        {/* ── Deductions ──────────────────────────────────────────────── */}
        <div className="payslip-card mb-6 rounded-xl bg-white p-6 shadow-sm">
          <SectionHeading>Deductions</SectionHeading>

          <LineItem
            label="Employee CPF Contribution"
            value={centsToCurrency(payslip.employeeCpfCents)}
          />

          {deductions.map((d, i) => (
            <LineItem key={i} label={d.name} value={centsToCurrency(d.amountCents)} />
          ))}

          <div className="mt-2 border-t border-gray-200 pt-2">
            <LineItem label="Total Deductions" value={centsToCurrency(totalDeductionsCents)} bold />
          </div>
        </div>

        {/* ── Net Pay ─────────────────────────────────────────────────── */}
        <div className="net-pay-section payslip-card mb-6 rounded-xl bg-green-50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-green-900">Net Pay</span>
            <span className="text-3xl font-bold text-green-700">
              {centsToCurrency(payslip.netPayCents)}
            </span>
          </div>
        </div>

        {/* ── Employer Contributions (for reference) ──────────────────── */}
        <div className="payslip-card mb-6 rounded-xl bg-white p-6 shadow-sm">
          <SectionHeading>Employer Contributions</SectionHeading>

          <LineItem label="Employer CPF" value={centsToCurrency(payslip.employerCpfCents)} />
          <LineItem
            label="Skills Development Levy (SDL)"
            value={centsToCurrency(payslip.sdlCents)}
          />
          <LineItem label="Foreign Worker Levy (FWL)" value={centsToCurrency(payslip.fwlCents)} />

          <div className="mt-2 border-t border-gray-200 pt-2">
            <LineItem
              label="Employer Total Cost"
              value={centsToCurrency(payslip.employerTotalCostCents)}
              bold
            />
          </div>
        </div>

        {/* ── CPF Breakdown ───────────────────────────────────────────── */}
        <div className="payslip-card mb-6 rounded-xl bg-white p-6 shadow-sm">
          <SectionHeading>CPF Breakdown</SectionHeading>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Wages */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-500">Wages</h3>
              <div className="space-y-1">
                <LineItem label="Ordinary Wages (OW)" value={centsToCurrency(cpfRecord.owCents)} />
                <LineItem label="OW (Capped)" value={centsToCurrency(cpfRecord.owCappedCents)} />
                <LineItem
                  label="Additional Wages (AW)"
                  value={centsToCurrency(cpfRecord.awCents)}
                />
                <LineItem label="AW (Capped)" value={centsToCurrency(cpfRecord.awCappedCents)} />
              </div>
            </div>

            {/* Rates */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-500">Rates &amp; Classification</h3>
              <div className="space-y-1">
                <LineItem label="Employer Rate" value={formatRate(cpfRecord.employerRate)} />
                <LineItem label="Employee Rate" value={formatRate(cpfRecord.employeeRate)} />
                <LineItem label="Total Rate" value={formatRate(cpfRecord.totalRate)} />
                <LineItem label="Age Band" value={cpfRecord.ageBand} />
                <LineItem label="Rate Table" value={cpfRecord.rateTable} />
              </div>
            </div>
          </div>

          {/* CPF Amounts */}
          <div className="mt-4 border-t border-gray-200 pt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-500">Contribution Amounts</h3>
            <LineItem label="Employer CPF" value={centsToCurrency(cpfRecord.employerAmountCents)} />
            <LineItem label="Employee CPF" value={centsToCurrency(cpfRecord.employeeAmountCents)} />
            <LineItem label="Total CPF" value={centsToCurrency(cpfRecord.totalAmountCents)} bold />
          </div>

          {/* YTD */}
          <div className="mt-4 border-t border-gray-200 pt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-500">Year-to-Date</h3>
            <LineItem label="YTD Ordinary Wages" value={centsToCurrency(cpfRecord.ytdOwCents)} />
            <LineItem label="YTD Additional Wages" value={centsToCurrency(cpfRecord.ytdAwCents)} />
          </div>
        </div>

        {/* ── PayNow QR ────────────────────────────────────────────────── */}
        <div className="payslip-card mb-6 rounded-xl bg-white p-6 shadow-sm">
          <SectionHeading>PayNow QR Code</SectionHeading>

          {!payNowSvg && !payNowLoading && (
            <div className="text-center">
              <p className="mb-4 text-sm text-gray-500">
                Generate a PayNow QR code for this payslip. Employees can scan it with their banking
                app to verify payment details.
              </p>
              <button
                onClick={handlePayNowQr}
                disabled={payNowLoading}
                className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
              >
                Generate PayNow QR
              </button>
            </div>
          )}

          {payNowLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
              <span className="ml-3 text-gray-500">Generating QR code...</span>
            </div>
          )}

          {payNowError && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{payNowError}</div>
          )}

          {payNowSvg && (
            <div className="flex flex-col items-center gap-4">
              <div
                className="rounded-lg border border-gray-200 bg-white p-4"
                dangerouslySetInnerHTML={{ __html: payNowSvg }}
              />
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">{payNowAmount}</p>
                <p className="text-sm text-gray-500">Ref: {payNowRef}</p>
              </div>
              <p className="text-xs text-gray-400">
                Scan with any Singapore banking app that supports PayNow
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="mb-8 text-center text-xs text-gray-400">
          <p>Generated by ClinicPay &middot; Payslip ID: {payslip.id}</p>
          <p>Generated on: {formatDate(payslip.createdAt)}</p>
        </div>
      </div>
    </>
  );
}
