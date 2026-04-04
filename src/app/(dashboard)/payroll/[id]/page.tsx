"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Button, Badge, StatusBadge, Modal, Spinner, Table } from "@/components/ui";
import { centsToCurrency } from "@/lib/utils/money";
import type { PayRunStatus } from "@/types";
import { apiFetch } from "@/lib/fetch";
import { trackEvent } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VarianceAlertData {
  employeeId: string;
  employeeName: string;
  type: "high_variance" | "new_hire" | "termination" | "age_band_change" | "first_payroll";
  message: string;
  severity: "warning" | "info";
  currentCents?: number;
  previousCents?: number;
  changePercent?: number;
}

interface Payslip {
  id: string;
  basicSalaryCents: number;
  grossPayCents: number;
  otHours: string | null;
  otPayCents: number | null;
  allowancesJson: AllowanceItem[] | null;
  deductionsJson: DeductionItem[] | null;
  employerCpfCents: number;
  employeeCpfCents: number;
  sdlCents: number;
  fwlCents: number;
  netPayCents: number;
  employerTotalCostCents: number;
  proratedDays: number | null;
}

interface AllowanceItem {
  name: string;
  amountCents: number;
  isFixed: boolean;
}

interface DeductionItem {
  name: string;
  amountCents: number;
}

interface PayslipRow {
  payslip: Payslip;
  employeeName: string;
  nricLast4: string;
  department: string | null;
  position: string | null;
  citizenshipStatus: string;
}

interface PayRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayRunStatus;
  totalGrossCents: number;
  totalNetCents: number;
  totalEmployerCpfCents: number;
  totalEmployeeCpfCents: number;
  totalSdlCents: number;
  totalFwlCents: number;
  employeeCount: number;
  payslips: PayslipRow[];
  requiresDualApproval: boolean;
  firstApprovedBy: string | null;
  firstApprovedAt: string | null;
  secondApprovedBy: string | null;
  secondApprovedAt: string | null;
  // Populated by the API join for display
  firstApproverName?: string | null;
  secondApproverName?: string | null;
}

interface VariableItems {
  otHours?: number;
  bonusCents?: number;
  commissionCents?: number;
  awsCents?: number;
  unpaidLeaveDays?: number;
}

// ---------------------------------------------------------------------------
// Wizard steps configuration
// ---------------------------------------------------------------------------

const STEPS = [
  { key: "enter", label: "Enter Data" },
  { key: "calculate", label: "Calculate" },
  { key: "review", label: "Review" },
  { key: "approve", label: "Approve" },
  { key: "pay", label: "Pay" },
] as const;

function getStepIndex(status: PayRunStatus): number {
  switch (status) {
    case "draft":
      return 0;
    case "calculated":
    case "reviewed":
      return 2;
    case "approved":
      return 3;
    case "paid":
      return 4;
    case "filed":
      return 4;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Helper: format date
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav className="mb-8" aria-label="Payroll wizard progress">
      <ol className="flex items-center">
        {STEPS.map((step, idx) => {
          const isComplete = idx < currentStep;
          const isCurrent = idx === currentStep;
          return (
            <li key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold " +
                    (isComplete
                      ? "bg-blue-600 text-white"
                      : isCurrent
                        ? "border-2 border-blue-600 text-blue-600"
                        : "border-2 border-gray-300 text-gray-400")
                  }
                >
                  {isComplete ? (
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
                    idx + 1
                  )}
                </div>
                <span
                  className={
                    "text-xs font-medium " +
                    (isComplete || isCurrent ? "text-blue-600" : "text-gray-400")
                  }
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={
                    "mx-2 h-0.5 flex-1 " + (idx < currentStep ? "bg-blue-600" : "bg-gray-200")
                  }
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Summary Cards
// ---------------------------------------------------------------------------

function SummaryCards({ payRun }: { payRun: PayRun }) {
  const cards = [
    { label: "Total Gross", value: payRun.totalGrossCents },
    { label: "Total Net", value: payRun.totalNetCents },
    { label: "Employer CPF", value: payRun.totalEmployerCpfCents },
    { label: "Employee CPF", value: payRun.totalEmployeeCpfCents },
    { label: "Total SDL", value: payRun.totalSdlCents },
    { label: "Total FWL", value: payRun.totalFwlCents },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">{c.label}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-gray-900">
            {centsToCurrency(c.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function PayRunDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [payRun, setPayRun] = useState<PayRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // Variable items state for Step 1
  const [variableItems, setVariableItems] = useState<Record<string, VariableItems>>({});

  // Employees for draft step (loaded separately since payslips don't exist yet)
  const [draftEmployees, setDraftEmployees] = useState<
    {
      id: string;
      fullName: string;
      nricLast4: string;
      citizenshipStatus: string;
      department: string | null;
      position: string | null;
      basicSalaryCents: number;
    }[]
  >([]);

  // Expanded payslip rows for review
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Variance alerts
  const [varianceAlerts, setVarianceAlerts] = useState<VarianceAlertData[]>([]);
  const [varianceLoading, setVarianceLoading] = useState(false);
  const [varianceOpen, setVarianceOpen] = useState(true);

  // Email payslips state
  const [emailResult, setEmailResult] = useState<{
    sent: number;
    failed: number;
    skipped: number;
    total: number;
  } | null>(null);

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const loadPayRun = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/payroll/pay-runs/${id}`);
      const data = await res.json();
      if (data.success) {
        setPayRun(data.data);
      } else {
        setError(data.error ?? "Failed to load pay run");
      }
    } catch {
      setError("Failed to load pay run");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load employees for draft state (before payslips exist)
  const loadEmployees = useCallback(async () => {
    try {
      const [empRes] = await Promise.all([apiFetch("/api/employees")]);
      const empData = await empRes.json();
      if (empData.success) {
        // Fetch salary info for each employee
        const empsWithSalary = await Promise.all(
          empData.data.map(
            async (emp: {
              id: string;
              fullName: string;
              nricLast4: string;
              citizenshipStatus: string;
              department: string | null;
              position: string | null;
            }) => {
              const salRes = await fetch(`/api/salary?employeeId=${emp.id}`);
              const salData = await salRes.json();
              const latestSalary =
                salData.success && salData.data.length > 0 ? salData.data[0] : null;
              return {
                id: emp.id,
                fullName: emp.fullName,
                nricLast4: emp.nricLast4,
                citizenshipStatus: emp.citizenshipStatus,
                department: emp.department,
                position: emp.position,
                basicSalaryCents: latestSalary?.basicSalaryCents ?? 0,
              };
            },
          ),
        );
        setDraftEmployees(empsWithSalary);
      }
    } catch {
      // Silently fail — employees tab will be empty
    }
  }, []);

  // Load variance alerts for calculated/reviewed/approved/paid runs
  const loadVarianceAlerts = useCallback(async () => {
    try {
      setVarianceLoading(true);
      const res = await fetch(`/api/payroll/pay-runs/${id}/variance`);
      const data = await res.json();
      if (data.success) {
        setVarianceAlerts(data.data);
      }
    } catch {
      // Silently fail — variance alerts are supplementary
    } finally {
      setVarianceLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPayRun();
    loadEmployees();
  }, [loadPayRun, loadEmployees]);

  // Load variance alerts when pay run is loaded and not draft
  useEffect(() => {
    if (payRun && payRun.status !== "draft") {
      loadVarianceAlerts();
    }
  }, [payRun?.status, loadVarianceAlerts]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Variable items helpers (Step 1)
  // -------------------------------------------------------------------------

  function getVariable(employeeId: string, field: keyof VariableItems): string {
    const items = variableItems[employeeId];
    if (!items) return "";
    const val = items[field];
    if (val === undefined || val === 0) return "";
    // For cents fields, convert to dollars for display
    if (field === "bonusCents" || field === "commissionCents" || field === "awsCents") {
      return (val / 100).toFixed(2);
    }
    return String(val);
  }

  function setVariable(employeeId: string, field: keyof VariableItems, rawValue: string) {
    setVariableItems((prev) => {
      const existing = prev[employeeId] ?? {};
      let parsedValue: number;

      if (field === "bonusCents" || field === "commissionCents" || field === "awsCents") {
        // Dollar input -> convert to cents
        const dollars = parseFloat(rawValue);
        parsedValue = isNaN(dollars) ? 0 : Math.round(dollars * 100);
      } else {
        parsedValue = parseFloat(rawValue);
        parsedValue = isNaN(parsedValue) ? 0 : parsedValue;
      }

      return {
        ...prev,
        [employeeId]: { ...existing, [field]: parsedValue },
      };
    });
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async function handleCalculate() {
    setActionLoading(true);
    setActionError("");
    try {
      // Filter out empty variable items
      const filtered: Record<string, VariableItems> = {};
      for (const [empId, items] of Object.entries(variableItems)) {
        const hasValues = Object.values(items).some((v) => v !== undefined && v !== 0);
        if (hasValues) {
          filtered[empId] = items;
        }
      }

      const res = await fetch(`/api/payroll/pay-runs/${id}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variableItems: Object.keys(filtered).length > 0 ? filtered : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        trackEvent("payroll_calculated");
        await loadPayRun();
      } else {
        setActionError(data.error ?? "Calculation failed");
      }
    } catch {
      setActionError("Failed to calculate payroll");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTransition(newStatus: string, confirmMessage?: string) {
    if (confirmMessage) {
      setConfirmModal({
        open: true,
        title: `Confirm ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        message: confirmMessage,
        onConfirm: () => {
          setConfirmModal((prev) => ({ ...prev, open: false }));
          doTransition(newStatus);
        },
      });
      return;
    }
    await doTransition(newStatus);
  }

  // Dual approval message shown after first approval
  const [dualApprovalMessage, setDualApprovalMessage] = useState("");

  async function doTransition(newStatus: string) {
    setActionLoading(true);
    setActionError("");
    setDualApprovalMessage("");
    try {
      const res = await fetch(`/api/payroll/pay-runs/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        if (newStatus === "approved") {
          trackEvent("payroll_approved");
        }
        // Check if this was a first approval in dual workflow (status stayed "reviewed")
        if (data.data?.dualApproval?.awaitingSecond) {
          setDualApprovalMessage(data.data.message);
        }
        await loadPayRun();
      } else {
        setActionError(data.error ?? "Transition failed");
      }
    } catch {
      setActionError("Failed to update pay run status");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRecalculate() {
    // Transition back to draft, then user can re-enter data
    await doTransition("draft");
  }

  async function handleExport(exportType: string) {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/payroll/pay-runs/${id}/export?type=${exportType}`);
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error ?? "Export failed");
        return;
      }

      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        // Payslips HTML export returns JSON
        const data = await res.json();
        if (!data.success) {
          setActionError(data.error ?? "Export failed");
          return;
        }
        // For JSON payslip exports, create HTML blob
        const htmlContent = (data.data.payslips as string[]).join("\n<hr>\n");
        const blob = new Blob([htmlContent], { type: "text/html" });
        downloadBlob(blob, `payslips-${payRun?.periodStart ?? "export"}.html`);
      } else {
        // CSV/text file download
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const filenameMatch = disposition.match(/filename="(.+?)"/);
        const filename = filenameMatch?.[1] ?? `${exportType}-export.csv`;
        downloadBlob(blob, filename);
      }
    } catch {
      setActionError("Export failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEmailPayslips() {
    setActionLoading(true);
    setActionError("");
    setEmailResult(null);
    try {
      const res = await fetch(`/api/payroll/pay-runs/${id}/email`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setEmailResult(data.data);
      } else {
        setActionError(data.error ?? "Failed to email payslips");
      }
    } catch {
      setActionError("Failed to email payslips");
    } finally {
      setActionLoading(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function toggleRow(payslipId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(payslipId)) {
        next.delete(payslipId);
      } else {
        next.add(payslipId);
      }
      return next;
    });
  }

  // -------------------------------------------------------------------------
  // Variance detection: flag if gross pay differs > 10% from basic salary
  // -------------------------------------------------------------------------

  function hasVariance(row: PayslipRow): boolean {
    const basic = row.payslip.basicSalaryCents;
    if (basic === 0) return false;
    const diff = Math.abs(row.payslip.grossPayCents - basic);
    return diff / basic > 0.1;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error || !payRun) {
    return (
      <div>
        <div className="mb-4">
          <Link href="/payroll" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Payroll
          </Link>
        </div>
        <Card>
          <p className="text-red-600">{error || "Pay run not found"}</p>
        </Card>
      </div>
    );
  }

  const currentStep = getStepIndex(payRun.status);
  const periodLabel = `${formatDate(payRun.periodStart)} - ${formatDate(payRun.periodEnd)}`;

  return (
    <div>
      <div className="mb-4">
        <Link href="/payroll" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Payroll
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Pay Run</h1>
          <p className="mt-1 text-sm text-gray-500">
            {periodLabel} &middot; Pay Date: {formatDate(payRun.payDate)}
          </p>
        </div>
        <StatusBadge status={payRun.status} />
      </div>

      <StepIndicator currentStep={currentStep} />

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Variance Alerts */}
      {payRun.status !== "draft" && (varianceAlerts.length > 0 || varianceLoading) && (
        <div className="mb-6">
          <button
            onClick={() => setVarianceOpen(!varianceOpen)}
            className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100"
          >
            <svg
              className={
                "h-4 w-4 text-amber-600 transition-transform " + (varianceOpen ? "rotate-90" : "")
              }
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-medium text-amber-800">Variance Alerts</span>
            {!varianceLoading && (
              <span className="ml-1 inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {varianceAlerts.length}
              </span>
            )}
            {varianceLoading && <Spinner className="ml-1 h-4 w-4 text-amber-600" />}
          </button>

          {varianceOpen && !varianceLoading && varianceAlerts.length > 0 && (
            <div className="mt-2 space-y-2">
              {varianceAlerts.map((alert, idx) => (
                <div
                  key={`${alert.employeeId}-${alert.type}-${idx}`}
                  className={
                    "flex items-start gap-3 rounded-lg border px-4 py-3 " +
                    (alert.severity === "warning"
                      ? "border-amber-200 bg-amber-50"
                      : "border-blue-200 bg-blue-50")
                  }
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {alert.severity === "warning" ? (
                      <svg
                        className="h-4 w-4 text-amber-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4 text-blue-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        "text-sm font-medium " +
                        (alert.severity === "warning" ? "text-amber-800" : "text-blue-800")
                      }
                    >
                      {alert.employeeName}
                    </p>
                    <p
                      className={
                        "text-sm " +
                        (alert.severity === "warning" ? "text-amber-700" : "text-blue-700")
                      }
                    >
                      {alert.message}
                    </p>
                    {alert.currentCents !== undefined && alert.previousCents !== undefined && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        Current: {centsToCurrency(alert.currentCents)} | Previous:{" "}
                        {centsToCurrency(alert.previousCents)}
                        {alert.changePercent !== undefined && (
                          <span
                            className={alert.changePercent > 0 ? "text-red-600" : "text-green-600"}
                          >
                            {" "}
                            ({alert.changePercent > 0 ? "+" : ""}
                            {alert.changePercent}%)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <Badge variant={alert.severity === "warning" ? "warning" : "neutral"}>
                    {alert.type.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Enter Data (draft) */}
      {payRun.status === "draft" && (
        <EnterDataStep
          payslips={payRun.payslips}
          draftEmployees={draftEmployees}
          getVariable={getVariable}
          setVariable={setVariable}
          onCalculate={handleCalculate}
          loading={actionLoading}
        />
      )}

      {/* Step 3: Review (calculated / reviewed) */}
      {(payRun.status === "calculated" || payRun.status === "reviewed") && (
        <ReviewStep
          payRun={payRun}
          expandedRows={expandedRows}
          toggleRow={toggleRow}
          hasVariance={hasVariance}
          onApprove={() =>
            handleTransition(
              payRun.status === "calculated" ? "reviewed" : "approved",
              payRun.status === "reviewed"
                ? "Are you sure you want to approve this pay run? This action cannot be undone."
                : undefined,
            )
          }
          onRecalculate={handleRecalculate}
          loading={actionLoading}
          status={payRun.status}
          dualApprovalMessage={dualApprovalMessage}
        />
      )}

      {/* Step 4: Approve (approved) */}
      {payRun.status === "approved" && (
        <PayStep
          payRun={payRun}
          onExport={handleExport}
          onMarkPaid={() =>
            handleTransition("paid", "Confirm that all salary payments have been made?")
          }
          onEmailPayslips={() =>
            setConfirmModal({
              open: true,
              title: "Email Payslips",
              message:
                "This will generate PDF payslips and email them to all employees with an email address on file. Continue?",
              onConfirm: () => {
                setConfirmModal((prev) => ({ ...prev, open: false }));
                handleEmailPayslips();
              },
            })
          }
          emailResult={emailResult}
          loading={actionLoading}
          isPaid={false}
        />
      )}

      {/* Step 5: Paid / Filed */}
      {(payRun.status === "paid" || payRun.status === "filed") && (
        <PayStep
          payRun={payRun}
          onExport={handleExport}
          onMarkPaid={() => {}}
          onGenerateCpf={() => handleExport("cpf")}
          onMarkFiled={() => handleTransition("filed", "Confirm CPF filing is complete?")}
          onEmailPayslips={() =>
            setConfirmModal({
              open: true,
              title: "Email Payslips",
              message:
                "This will generate PDF payslips and email them to all employees with an email address on file. Continue?",
              onConfirm: () => {
                setConfirmModal((prev) => ({ ...prev, open: false }));
                handleEmailPayslips();
              },
            })
          }
          emailResult={emailResult}
          loading={actionLoading}
          isPaid={true}
          isFiled={payRun.status === "filed"}
        />
      )}

      {/* Confirmation Modal */}
      <Modal
        open={confirmModal.open}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        title={confirmModal.title}
        size="sm"
      >
        <p className="mb-6 text-sm text-gray-600">{confirmModal.message}</p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
          >
            Cancel
          </Button>
          <Button onClick={confirmModal.onConfirm}>Confirm</Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Enter Data
// ---------------------------------------------------------------------------

function EnterDataStep({
  payslips,
  draftEmployees,
  getVariable,
  setVariable,
  onCalculate,
  loading,
}: {
  payslips: PayslipRow[];
  draftEmployees: {
    id: string;
    fullName: string;
    nricLast4: string;
    citizenshipStatus: string;
    department: string | null;
    position: string | null;
    basicSalaryCents: number;
  }[];
  getVariable: (employeeId: string, field: keyof VariableItems) => string;
  setVariable: (employeeId: string, field: keyof VariableItems, value: string) => void;
  onCalculate: () => void;
  loading: boolean;
}) {
  // Build a unified employee list: use payslips if available (recalculation), otherwise use draftEmployees
  const rows =
    payslips.length > 0
      ? payslips.map((row) => ({
          id: row.payslip.id,
          name: row.employeeName,
          nricLast4: row.nricLast4,
          citizenship: row.citizenshipStatus,
          salaryCents: row.payslip.basicSalaryCents,
        }))
      : draftEmployees.map((emp) => ({
          id: emp.id,
          name: emp.fullName,
          nricLast4: emp.nricLast4,
          citizenship: emp.citizenshipStatus,
          salaryCents: emp.basicSalaryCents,
        }));

  if (rows.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center py-8 text-center">
          <Spinner className="mb-4 h-6 w-6 text-slate-400" />
          <p className="text-sm text-slate-500">Loading employees...</p>
        </div>
      </Card>
    );
  }

  const inputClass =
    "w-20 rounded border border-slate-200 px-2 py-1.5 text-center text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none";
  const inputClassWide =
    "w-24 rounded border border-slate-200 px-2 py-1.5 text-center text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none";

  return (
    <div>
      <Card title="Variable Pay Items">
        <p className="mb-4 text-sm text-slate-500">
          Enter overtime, bonuses, and other variable items for each employee. Leave blank for zero.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Employee
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Basic Salary
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  OT Hours
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Bonus ($)
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Commission ($)
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  AWS ($)
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Unpaid Leave
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-sky-50/30">
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <div className="text-xs text-slate-400">
                      ****{row.nricLast4} &middot; {row.citizenship}
                    </div>
                  </td>
                  <td className="tabular px-3 py-3 font-mono text-sm">
                    {centsToCurrency(row.salaryCents)}
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="0"
                      value={getVariable(row.id, "otHours")}
                      onChange={(e) => setVariable(row.id, "otHours", e.target.value)}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={getVariable(row.id, "bonusCents")}
                      onChange={(e) => setVariable(row.id, "bonusCents", e.target.value)}
                      className={inputClassWide}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={getVariable(row.id, "commissionCents")}
                      onChange={(e) => setVariable(row.id, "commissionCents", e.target.value)}
                      className={inputClassWide}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={getVariable(row.id, "awsCents")}
                      onChange={(e) => setVariable(row.id, "awsCents", e.target.value)}
                      className={inputClassWide}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={getVariable(row.id, "unpaidLeaveDays")}
                      onChange={(e) => setVariable(row.id, "unpaidLeaveDays", e.target.value)}
                      className={inputClass}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button onClick={onCalculate} loading={loading} size="lg">
          Calculate Payroll
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Review
// ---------------------------------------------------------------------------

function ReviewStep({
  payRun,
  expandedRows,
  toggleRow,
  hasVariance,
  onApprove,
  onRecalculate,
  loading,
  status,
  dualApprovalMessage,
}: {
  payRun: PayRun;
  expandedRows: Set<string>;
  toggleRow: (id: string) => void;
  hasVariance: (row: PayslipRow) => boolean;
  onApprove: () => void;
  onRecalculate: () => void;
  loading: boolean;
  status: PayRunStatus;
  dualApprovalMessage?: string;
}) {
  const hasDualApproval = payRun.requiresDualApproval;
  const awaitingSecond = hasDualApproval && payRun.firstApprovedBy && !payRun.secondApprovedBy;

  return (
    <div>
      <SummaryCards payRun={payRun} />

      {/* Dual Approval Status Banner */}
      {hasDualApproval && status === "reviewed" && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <h4 className="text-sm font-semibold text-blue-800">Dual Approval Required</h4>
          {payRun.firstApprovedBy && (
            <p className="mt-1 text-sm text-blue-700">
              First approval by {payRun.firstApproverName ?? "User"} at{" "}
              {payRun.firstApprovedAt
                ? new Date(payRun.firstApprovedAt).toLocaleString("en-SG")
                : "N/A"}
            </p>
          )}
          {awaitingSecond && (
            <p className="mt-1 text-sm font-medium text-amber-700">
              Awaiting second approval from a different user.
            </p>
          )}
        </div>
      )}

      {/* Message from the last transition attempt */}
      {dualApprovalMessage && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {dualApprovalMessage}
        </div>
      )}

      <Card title="Payslip Details">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Employee
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                  NRIC
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Basic Salary
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Gross Pay
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Employee CPF
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Net Pay
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium tracking-wide text-gray-500 uppercase">
                  Flags
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {payRun.payslips.map((row) => {
                const expanded = expandedRows.has(row.payslip.id);
                const variance = hasVariance(row);
                return (
                  <PayslipTableRow
                    key={row.payslip.id}
                    row={row}
                    expanded={expanded}
                    variance={variance}
                    onToggle={() => toggleRow(row.payslip.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 flex justify-between">
        <Button variant="secondary" onClick={onRecalculate} loading={loading}>
          Recalculate
        </Button>
        <Button onClick={onApprove} loading={loading} size="lg">
          {status === "calculated"
            ? "Mark as Reviewed"
            : awaitingSecond
              ? "Provide Second Approval"
              : "Approve Pay Run"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payslip Table Row (expandable)
// ---------------------------------------------------------------------------

function PayslipTableRow({
  row,
  expanded,
  variance,
  onToggle,
}: {
  row: PayslipRow;
  expanded: boolean;
  variance: boolean;
  onToggle: () => void;
}) {
  const { payslip } = row;
  const allowances = payslip.allowancesJson ?? [];
  const deductions = payslip.deductionsJson ?? [];

  return (
    <>
      <tr className="cursor-pointer transition-colors hover:bg-gray-50" onClick={onToggle}>
        <td className="px-3 py-3 text-gray-400">
          <svg
            className={"h-4 w-4 transition-transform " + (expanded ? "rotate-90" : "")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </td>
        <td className="px-3 py-3 font-medium text-gray-900">{row.employeeName}</td>
        <td className="px-3 py-3 font-mono text-xs text-gray-500">****{row.nricLast4}</td>
        <td className="px-3 py-3 text-right font-mono">
          {centsToCurrency(payslip.basicSalaryCents)}
        </td>
        <td className="px-3 py-3 text-right font-mono">{centsToCurrency(payslip.grossPayCents)}</td>
        <td className="px-3 py-3 text-right font-mono">
          {centsToCurrency(payslip.employeeCpfCents)}
        </td>
        <td className="px-3 py-3 text-right font-mono font-semibold">
          {centsToCurrency(payslip.netPayCents)}
        </td>
        <td className="px-3 py-3 text-center">
          {variance && <Badge variant="warning">&gt;10% variance</Badge>}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="bg-gray-50 px-6 py-4">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <BreakdownSection title="Earnings">
                <BreakdownLine label="Basic Salary" value={payslip.basicSalaryCents} />
                {payslip.otPayCents != null && payslip.otPayCents > 0 && (
                  <BreakdownLine
                    label={`OT Pay (${payslip.otHours ?? "0"} hrs)`}
                    value={payslip.otPayCents}
                  />
                )}
                {allowances.map((a, i) => (
                  <BreakdownLine key={i} label={a.name} value={a.amountCents} />
                ))}
              </BreakdownSection>

              <BreakdownSection title="Deductions">
                <BreakdownLine label="Employee CPF" value={payslip.employeeCpfCents} />
                {deductions.map((d, i) => (
                  <BreakdownLine key={i} label={d.name} value={d.amountCents} />
                ))}
              </BreakdownSection>

              <BreakdownSection title="Employer Contributions">
                <BreakdownLine label="Employer CPF" value={payslip.employerCpfCents} />
                <BreakdownLine label="SDL" value={payslip.sdlCents} />
                <BreakdownLine label="FWL" value={payslip.fwlCents} />
              </BreakdownSection>

              <BreakdownSection title="Totals">
                <BreakdownLine label="Gross Pay" value={payslip.grossPayCents} bold />
                <BreakdownLine label="Net Pay" value={payslip.netPayCents} bold />
                <BreakdownLine
                  label="Employer Total Cost"
                  value={payslip.employerTotalCostCents}
                  bold
                />
              </BreakdownSection>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function BreakdownSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function BreakdownLine({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={bold ? "font-medium text-gray-900" : "text-gray-600"}>{label}</span>
      <span className={"font-mono " + (bold ? "font-semibold text-gray-900" : "text-gray-700")}>
        {centsToCurrency(value)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Pay / Export
// ---------------------------------------------------------------------------

function PayStep({
  payRun,
  onExport,
  onMarkPaid,
  onGenerateCpf,
  onMarkFiled,
  onEmailPayslips,
  emailResult,
  loading,
  isPaid,
  isFiled = false,
}: {
  payRun: PayRun;
  onExport: (type: string) => void;
  onMarkPaid: () => void;
  onGenerateCpf?: () => void;
  onMarkFiled?: () => void;
  onEmailPayslips?: () => void;
  emailResult?: { sent: number; failed: number; skipped: number; total: number } | null;
  loading: boolean;
  isPaid: boolean;
  isFiled?: boolean;
}) {
  return (
    <div>
      <SummaryCards payRun={payRun} />

      <Card title="Export Files">
        <p className="mb-4 text-sm text-gray-500">
          Download bank payment files and CPF submission files for this pay run.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => onExport("bank-dbs")} loading={loading}>
            Download DBS File
          </Button>
          <Button variant="secondary" onClick={() => onExport("bank-ocbc")} loading={loading}>
            Download OCBC File
          </Button>
          <Button variant="secondary" onClick={() => onExport("bank-uob")} loading={loading}>
            Download UOB File
          </Button>
          <Button variant="secondary" onClick={() => onExport("cpf")} loading={loading}>
            Download CPF File
          </Button>
          <Button variant="secondary" onClick={() => onExport("payslips")} loading={loading}>
            Download Payslips
          </Button>
        </div>
      </Card>

      {/* PayNow QR Codes */}
      <div className="mt-6">
        <Card title="PayNow QR Codes">
          <p className="mb-4 text-sm text-gray-500">
            Generate PayNow QR codes for all employees in this pay run. Employees can scan these
            with their banking app to verify payment details.
          </p>
          <Link
            href={`/payroll/${payRun.id}/paynow`}
            className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
            View PayNow QR Codes
          </Link>
        </Card>
      </div>

      {/* Email Payslips */}
      <div className="mt-6">
        <Card title="Email Payslips">
          <p className="mb-4 text-sm text-gray-500">
            Generate PDF payslips and email them directly to employees. Only employees with an email
            address on file will receive payslips.
          </p>
          {emailResult && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
              <p className="font-medium text-blue-800">Email Summary</p>
              <ul className="mt-1 space-y-0.5 text-blue-700">
                <li>
                  Sent: {emailResult.sent} of {emailResult.total}
                </li>
                {emailResult.failed > 0 && (
                  <li className="text-red-600">Failed: {emailResult.failed}</li>
                )}
                {emailResult.skipped > 0 && <li>Skipped (no email): {emailResult.skipped}</li>}
              </ul>
            </div>
          )}
          {onEmailPayslips && (
            <Button variant="secondary" onClick={onEmailPayslips} loading={loading}>
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Email Payslips to Employees
            </Button>
          )}
        </Card>
      </div>

      {!isPaid && (
        <div className="mt-6 flex justify-end">
          <Button onClick={onMarkPaid} loading={loading} size="lg">
            Mark as Paid
          </Button>
        </div>
      )}

      {isPaid && !isFiled && (
        <div className="mt-6">
          <Card title="CPF Filing">
            <p className="mb-4 text-sm text-gray-500">
              After submitting CPF contributions via CPF EZPay, mark this pay run as filed.
            </p>
            <div className="flex gap-3">
              {onGenerateCpf && (
                <Button variant="secondary" onClick={onGenerateCpf} loading={loading}>
                  Generate CPF Filing
                </Button>
              )}
              {onMarkFiled && (
                <Button onClick={onMarkFiled} loading={loading}>
                  Mark as Filed
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {isFiled && (
        <div className="mt-6">
          <Card>
            <div className="flex items-center gap-3 text-green-700">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">
                This pay run is complete. All payments made and CPF filed.
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Payslip summary table */}
      {payRun.payslips.length > 0 && (
        <div className="mt-6">
          <Card title="Payslip Summary">
            <Table>
              <Table.Head>
                <tr>
                  <Table.HeadCell>Employee</Table.HeadCell>
                  <Table.HeadCell>NRIC</Table.HeadCell>
                  <Table.HeadCell className="text-right">Gross Pay</Table.HeadCell>
                  <Table.HeadCell className="text-right">Employee CPF</Table.HeadCell>
                  <Table.HeadCell className="text-right">Net Pay</Table.HeadCell>
                </tr>
              </Table.Head>
              <Table.Body>
                {payRun.payslips.map((row) => (
                  <Table.Row key={row.payslip.id}>
                    <Table.Cell>
                      <span className="font-medium">{row.employeeName}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs text-gray-500">****{row.nricLast4}</span>
                    </Table.Cell>
                    <Table.Cell className="text-right font-mono">
                      {centsToCurrency(row.payslip.grossPayCents)}
                    </Table.Cell>
                    <Table.Cell className="text-right font-mono">
                      {centsToCurrency(row.payslip.employeeCpfCents)}
                    </Table.Cell>
                    <Table.Cell className="text-right font-mono font-semibold">
                      {centsToCurrency(row.payslip.netPayCents)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
