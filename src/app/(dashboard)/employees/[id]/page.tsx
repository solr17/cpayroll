"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface EmployeeDetail {
  id: string;
  fullName: string;
  nricDisplay: string;
  nricLast4: string;
  dob: string;
  gender: string | null;
  nationality: string | null;
  citizenshipStatus: string;
  prEffectiveDate: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  employeeCode: string | null;
  position: string | null;
  department: string | null;
  hireDate: string;
  confirmationDate: string | null;
  probationEnd: string | null;
  employmentType: string;
  contractEndDate: string | null;
  terminationDate: string | null;
  terminationReason: string | null;
  bankDetails: {
    bankName: string;
    branchCode: string;
    accountNumber: string;
    payNowLinked?: string;
  } | null;
  cpfAccountNumber: string | null;
  workPassType: string | null;
  workPassExpiry: string | null;
  taxRefNumber: string | null;
  status: string;
}

interface SalaryRecord {
  id: string;
  effectiveDate: string;
  basicSalaryCents: number;
  allowancesJson: Array<{ name: string; amountCents: number; isFixed: boolean }> | null;
  otEligible: boolean;
  otRateMultiplier: string | null;
  awsMonths: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface FinalPayBreakdownItem {
  label: string;
  amountCents: number;
  description: string;
}

interface FinalPayPreview {
  leaveEncashmentCents: number;
  proRatedAwsCents: number;
  noticePeriodPayCents: number;
  retrenchmentBenefitCents: number;
  totalFinalPayCents: number;
  breakdown: FinalPayBreakdownItem[];
  noticePeriodDays: number;
  yearsOfService: number;
  completedMonthsInYear: number;
  dailyRateCents: number;
  employeeName: string;
  hireDate: string;
  terminationDate: string;
  basicSalaryCents: number;
  awsMonths: number;
  unusedLeaveDays: number;
}

const TERMINATION_REASONS: { value: string; label: string }[] = [
  { value: "resignation", label: "Resignation" },
  { value: "mutual_agreement", label: "Mutual Agreement" },
  { value: "end_of_contract", label: "End of Contract" },
  { value: "retirement", label: "Retirement" },
  { value: "retrenchment", label: "Retrenchment" },
  { value: "misconduct", label: "Dismissal - Misconduct" },
  { value: "poor_performance", label: "Dismissal - Poor Performance" },
  { value: "death", label: "Deceased" },
  { value: "other", label: "Other" },
];

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value ?? "\u2014"}</dd>
    </div>
  );
}

function formatCents(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainder = Math.abs(cents) % 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}S$${dollars.toLocaleString("en-SG")}.${String(remainder).padStart(2, "0")}`;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "salary">("details");

  // Terminate modal state
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [termDate, setTermDate] = useState("");
  const [termReason, setTermReason] = useState(TERMINATION_REASONS[0]!.value);
  const [termNoticePeriodServed, setTermNoticePeriodServed] = useState(true);
  const [termIsRetrenchment, setTermIsRetrenchment] = useState(false);
  const [termUnusedLeave, setTermUnusedLeave] = useState("");
  const [termSubmitting, setTermSubmitting] = useState(false);
  const [termError, setTermError] = useState("");
  const [termStep, setTermStep] = useState<"form" | "preview">("form");
  const [finalPayPreview, setFinalPayPreview] = useState<FinalPayPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Final pay state (for terminated employees)
  const [showFinalPayModal, setShowFinalPayModal] = useState(false);
  const [finalPayData, setFinalPayData] = useState<FinalPayPreview | null>(null);
  const [finalPayLoading, setFinalPayLoading] = useState(false);
  const [finalPayGenerating, setFinalPayGenerating] = useState(false);
  const [finalPayGenerated, setFinalPayGenerated] = useState(false);

  // Rehire modal state
  const [showRehireModal, setShowRehireModal] = useState(false);
  const [rehireDate, setRehireDate] = useState("");
  const [rehireSubmitting, setRehireSubmitting] = useState(false);
  const [rehireError, setRehireError] = useState("");

  const loadEmployee = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setEmployee(data.data);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to load employee");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const loadSalaryHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees/${params.id}/salary-history`);
      const data = await res.json();
      if (data.success) {
        setSalaryHistory(data.data);
      }
    } catch {
      // Non-critical — salary tab just shows empty
    }
  }, [params.id]);

  useEffect(() => {
    loadEmployee();
    loadSalaryHistory();
  }, [loadEmployee, loadSalaryHistory]);

  async function handleFinalPayPreview() {
    if (!termDate) {
      setTermError("Please enter a termination date");
      return;
    }
    setTermError("");
    setPreviewLoading(true);

    try {
      const qp = new URLSearchParams({
        noticePeriodServed: String(termNoticePeriodServed),
        isRetrenchment: String(termIsRetrenchment),
      });
      if (termUnusedLeave !== "") {
        qp.set("unusedLeaveDays", termUnusedLeave);
      }
      const res = await fetch(`/api/employees/${params.id}/final-pay?${qp.toString()}`);
      const data = await res.json();
      if (data.success) {
        setFinalPayPreview(data.data);
        setTermStep("preview");
      } else {
        // If final pay fails (e.g., no salary record), still allow termination
        setFinalPayPreview(null);
        setTermStep("preview");
      }
    } catch {
      setFinalPayPreview(null);
      setTermStep("preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleTerminate(e: React.FormEvent) {
    e.preventDefault();
    setTermError("");
    setTermSubmitting(true);

    try {
      const res = await fetch(`/api/employees/${params.id}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terminationDate: termDate,
          terminationReason: termReason,
          noticePeriodServed: termNoticePeriodServed,
          isRetrenchment: termIsRetrenchment,
          unusedLeaveDays: termUnusedLeave !== "" ? parseFloat(termUnusedLeave) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowTerminateModal(false);
        setTermStep("form");
        setFinalPayPreview(null);
        await loadEmployee();
      } else {
        setTermError(data.error);
      }
    } catch {
      setTermError("Failed to terminate employee");
    } finally {
      setTermSubmitting(false);
    }
  }

  async function loadFinalPayForTerminated() {
    setFinalPayLoading(true);
    try {
      const res = await fetch(
        `/api/employees/${params.id}/final-pay?noticePeriodServed=true&isRetrenchment=false`,
      );
      const data = await res.json();
      if (data.success) {
        setFinalPayData(data.data);
        setShowFinalPayModal(true);
      }
    } catch {
      // Silently fail
    } finally {
      setFinalPayLoading(false);
    }
  }

  async function handleGenerateFinalPay() {
    setFinalPayGenerating(true);
    try {
      const res = await fetch(`/api/employees/${params.id}/final-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noticePeriodServed: true,
          isRetrenchment: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFinalPayGenerated(true);
      }
    } catch {
      // Silently fail
    } finally {
      setFinalPayGenerating(false);
    }
  }

  async function handleRehire(e: React.FormEvent) {
    e.preventDefault();
    setRehireError("");
    setRehireSubmitting(true);

    try {
      const res = await fetch(`/api/employees/${params.id}/rehire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hireDate: rehireDate || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowRehireModal(false);
        await loadEmployee();
      } else {
        setRehireError(data.error);
      }
    } catch {
      setRehireError("Failed to rehire employee");
    } finally {
      setRehireSubmitting(false);
    }
  }

  // Work pass expiry alert logic
  const workPassAlert = (() => {
    if (!employee?.workPassExpiry || employee?.citizenshipStatus !== "FW") return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(employee.workPassExpiry);
    expiry.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return { level: "expired" as const, daysUntil };
    if (daysUntil <= 90) return { level: "expiring" as const, daysUntil };
    return null;
  })();

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!employee) return <div className="p-8">Employee not found</div>;

  return (
    <div>
      {/* Work pass expiry banners */}
      {workPassAlert?.level === "expired" && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">Work pass expired</p>
              <p className="text-sm text-red-700">
                {employee.workPassType} expired on {employee.workPassExpiry}. This employee will be
                excluded from payroll processing.
              </p>
            </div>
          </div>
        </div>
      )}
      {workPassAlert?.level === "expiring" && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Work pass expiring soon</p>
              <p className="text-sm text-amber-700">
                {employee.workPassType} expires on {employee.workPassExpiry} (
                {workPassAlert.daysUntil} day{workPassAlert.daysUntil !== 1 ? "s" : ""} remaining).
                Please renew before expiry to avoid payroll disruption.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <Link href="/employees" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Employees
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{employee.fullName}</h1>
          <p className="text-sm text-gray-500">
            NRIC: {employee.nricDisplay} &middot;{" "}
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                employee.status === "active"
                  ? "bg-green-100 text-green-800"
                  : employee.status === "terminated"
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {employee.status}
            </span>{" "}
            &middot; {employee.employmentType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {employee.status === "terminated" ? (
            <>
              <button
                onClick={loadFinalPayForTerminated}
                disabled={finalPayLoading}
                className="rounded-lg border border-blue-300 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {finalPayLoading ? "Loading..." : "View Final Pay"}
              </button>
              <button
                onClick={() => {
                  setShowRehireModal(true);
                  setRehireDate("");
                  setRehireError("");
                }}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              >
                Rehire Employee
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setShowTerminateModal(true);
                setTermDate("");
                setTermReason(TERMINATION_REASONS[0]!.value);
                setTermNoticePeriodServed(true);
                setTermIsRetrenchment(false);
                setTermUnusedLeave("");
                setTermError("");
                setTermStep("form");
                setFinalPayPreview(null);
              }}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              Terminate Employee
            </button>
          )}
          <Link
            href={`/employees/${params.id}/edit`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Edit Employee
          </Link>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab("details")}
            className={`border-b-2 pb-3 text-sm font-medium ${
              activeTab === "details"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("salary")}
            className={`border-b-2 pb-3 text-sm font-medium ${
              activeTab === "salary"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Salary History
          </button>
        </nav>
      </div>

      {/* Details Tab */}
      {activeTab === "details" && (
        <div className="mt-6 space-y-8">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Personal Information</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Date of Birth" value={employee.dob} />
              <Field label="Gender" value={employee.gender} />
              <Field label="Nationality" value={employee.nationality} />
              <Field label="Citizenship Status" value={employee.citizenshipStatus} />
              <Field label="PR Effective Date" value={employee.prEffectiveDate} />
              <Field label="Mobile" value={employee.mobile} />
              <Field label="Email" value={employee.email} />
              <Field label="Address" value={employee.address} />
              <Field label="Emergency Contact" value={employee.emergencyContactName} />
              <Field label="Emergency Phone" value={employee.emergencyContactPhone} />
            </dl>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Employment</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Employee Code" value={employee.employeeCode} />
              <Field label="Position" value={employee.position} />
              <Field label="Department" value={employee.department} />
              <Field label="Hire Date" value={employee.hireDate} />
              <Field label="Confirmation Date" value={employee.confirmationDate} />
              <Field label="Probation End" value={employee.probationEnd} />
              <Field label="Employment Type" value={employee.employmentType} />
              <Field label="Contract End" value={employee.contractEndDate} />
              {employee.terminationDate && (
                <>
                  <Field label="Termination Date" value={employee.terminationDate} />
                  <Field label="Termination Reason" value={employee.terminationReason} />
                </>
              )}
            </dl>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Statutory</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="CPF Account" value={employee.cpfAccountNumber} />
              <Field label="Tax Ref" value={employee.taxRefNumber} />
              <Field label="Work Pass Type" value={employee.workPassType} />
              <div>
                <dt className="text-sm text-gray-500">Work Pass Expiry</dt>
                <dd className="mt-1 text-sm font-medium">
                  {employee.workPassExpiry ? (
                    <span
                      className={
                        workPassAlert?.level === "expired"
                          ? "font-bold text-red-700"
                          : workPassAlert?.level === "expiring"
                            ? "font-bold text-amber-700"
                            : ""
                      }
                    >
                      {employee.workPassExpiry}
                      {workPassAlert?.level === "expired" && " (EXPIRED)"}
                      {workPassAlert?.level === "expiring" &&
                        ` (${workPassAlert.daysUntil}d remaining)`}
                    </span>
                  ) : (
                    "\u2014"
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {employee.bankDetails && (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Banking</h2>
              <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Bank" value={employee.bankDetails.bankName} />
                <Field label="Branch Code" value={employee.bankDetails.branchCode} />
                <Field label="Account Number" value={employee.bankDetails.accountNumber} />
                <Field label="PayNow" value={employee.bankDetails.payNowLinked} />
              </dl>
            </section>
          )}
        </div>
      )}

      {/* Salary History Tab */}
      {activeTab === "salary" && (
        <div className="mt-6">
          {salaryHistory.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
              No salary records found.
            </div>
          ) : (
            <div className="space-y-4">
              {salaryHistory.map((record, index) => (
                <div
                  key={record.id}
                  className={`relative rounded-xl bg-white p-6 shadow-sm ${
                    index === 0 ? "ring-2 ring-blue-200" : ""
                  }`}
                >
                  {/* Timeline connector */}
                  {index < salaryHistory.length - 1 && (
                    <div className="absolute top-full left-8 h-4 w-0.5 bg-gray-200" />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          index === 0 ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Effective from {record.effectiveDate}
                        </p>
                        {index === 0 && (
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCents(record.basicSalaryCents)}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-gray-500">Basic Salary</p>
                      <p className="text-sm font-medium">{formatCents(record.basicSalaryCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">OT Eligible</p>
                      <p className="text-sm font-medium">{record.otEligible ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">OT Multiplier</p>
                      <p className="text-sm font-medium">{record.otRateMultiplier ?? "1.50"}x</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">AWS Months</p>
                      <p className="text-sm font-medium">{record.awsMonths ?? "0"}</p>
                    </div>
                  </div>

                  {record.allowancesJson && record.allowancesJson.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <p className="text-xs font-medium text-gray-500">Allowances</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {record.allowancesJson.map((a, i) => (
                          <span
                            key={i}
                            className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700"
                          >
                            {a.name}: {formatCents(a.amountCents)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-3 text-xs text-gray-400">
                    Created {new Date(record.createdAt).toLocaleDateString("en-SG")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Terminate Modal — Two-step: form then preview */}
      {showTerminateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-red-900">Terminate Employee</h2>
            <p className="mt-1 text-sm text-gray-500">
              This will mark {employee.fullName} as terminated.
            </p>

            {termError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{termError}</div>
            )}

            {/* Step 1: Form */}
            {termStep === "form" && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Termination Date
                  </label>
                  <input
                    type="date"
                    value={termDate}
                    onChange={(e) => setTermDate(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason</label>
                  <select
                    value={termReason}
                    onChange={(e) => setTermReason(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                  >
                    {TERMINATION_REASONS.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Unused Annual Leave Days (optional override)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={termUnusedLeave}
                    onChange={(e) => setTermUnusedLeave(e.target.value)}
                    placeholder="Auto-detect from leave balances"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Leave blank to use leave balance records.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={termNoticePeriodServed}
                      onChange={(e) => setTermNoticePeriodServed(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">Notice period served</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={termIsRetrenchment}
                      onChange={(e) => setTermIsRetrenchment(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">
                      Retrenchment (includes retrenchment benefit)
                    </span>
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTerminateModal(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalPayPreview}
                    disabled={previewLoading || !termDate}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {previewLoading ? "Calculating..." : "Preview Final Pay"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Preview & Confirm */}
            {termStep === "preview" && (
              <div className="mt-4 space-y-4">
                {finalPayPreview ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Final Pay Preview</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <span className="text-gray-500">Daily Rate (Basic/26):</span>
                      <span className="text-right font-medium">
                        {formatCents(finalPayPreview.dailyRateCents)}
                      </span>
                      <span className="text-gray-500">Years of Service:</span>
                      <span className="text-right font-medium">
                        {finalPayPreview.yearsOfService.toFixed(2)}
                      </span>
                      <span className="text-gray-500">Notice Period:</span>
                      <span className="text-right font-medium">
                        {finalPayPreview.noticePeriodDays} day(s)
                      </span>
                      <span className="text-gray-500">Unused Leave:</span>
                      <span className="text-right font-medium">
                        {finalPayPreview.unusedLeaveDays} day(s)
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                      {finalPayPreview.breakdown.map((item, i) => (
                        <div key={i} className="flex items-start justify-between text-sm">
                          <div>
                            <span className="font-medium text-gray-900">{item.label}</span>
                            <p className="text-xs text-gray-500">{item.description}</p>
                          </div>
                          <span className="ml-4 font-medium whitespace-nowrap">
                            {formatCents(item.amountCents)}
                          </span>
                        </div>
                      ))}
                      {finalPayPreview.breakdown.length === 0 && (
                        <p className="text-sm text-gray-500">No final pay entitlements.</p>
                      )}
                    </div>
                    <div className="mt-3 flex justify-between border-t border-gray-300 pt-3 text-sm font-bold">
                      <span>Total Final Pay</span>
                      <span>{formatCents(finalPayPreview.totalFinalPayCents)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                    Final pay could not be calculated (no salary record found). You can still
                    proceed with termination.
                  </div>
                )}

                <form onSubmit={handleTerminate}>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setTermStep("form")}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTerminateModal(false)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={termSubmitting}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {termSubmitting ? "Processing..." : "Confirm Termination"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Final Pay Modal (for already terminated employees) */}
      {showFinalPayModal && finalPayData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-blue-900">Final Pay Statement</h2>
            <p className="mt-1 text-sm text-gray-500">
              {employee.fullName} &mdash; Terminated {employee.terminationDate}
            </p>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">Hire Date:</span>
                <span className="text-right font-medium">{finalPayData.hireDate}</span>
                <span className="text-gray-500">Termination Date:</span>
                <span className="text-right font-medium">{finalPayData.terminationDate}</span>
                <span className="text-gray-500">Years of Service:</span>
                <span className="text-right font-medium">
                  {finalPayData.yearsOfService.toFixed(2)}
                </span>
                <span className="text-gray-500">Basic Salary:</span>
                <span className="text-right font-medium">
                  {formatCents(finalPayData.basicSalaryCents)}
                </span>
                <span className="text-gray-500">Daily Rate:</span>
                <span className="text-right font-medium">
                  {formatCents(finalPayData.dailyRateCents)}
                </span>
                <span className="text-gray-500">Unused Leave:</span>
                <span className="text-right font-medium">
                  {finalPayData.unusedLeaveDays} day(s)
                </span>
              </div>

              <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                {finalPayData.breakdown.map((item, i) => (
                  <div key={i} className="flex items-start justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{item.label}</span>
                      <p className="text-xs text-gray-500">{item.description}</p>
                    </div>
                    <span className="ml-4 font-medium whitespace-nowrap">
                      {formatCents(item.amountCents)}
                    </span>
                  </div>
                ))}
                {finalPayData.breakdown.length === 0 && (
                  <p className="text-sm text-gray-500">No final pay entitlements.</p>
                )}
              </div>

              <div className="mt-3 flex justify-between border-t border-gray-300 pt-3 text-sm font-bold">
                <span>Total Final Pay</span>
                <span>{formatCents(finalPayData.totalFinalPayCents)}</span>
              </div>
            </div>

            {finalPayGenerated && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                Final pay statement has been generated and recorded as a payslip.
              </div>
            )}

            <div className="mt-4 flex justify-end gap-3">
              {!finalPayGenerated && finalPayData.totalFinalPayCents > 0 && (
                <button
                  onClick={handleGenerateFinalPay}
                  disabled={finalPayGenerating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {finalPayGenerating ? "Generating..." : "Generate Final Pay Record"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowFinalPayModal(false);
                  setFinalPayGenerated(false);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rehire Modal */}
      {showRehireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-green-900">Rehire Employee</h2>
            <p className="mt-1 text-sm text-gray-500">
              This will reactivate {employee.fullName} and clear termination records.
            </p>
            <form onSubmit={handleRehire} className="mt-4 space-y-4">
              {rehireError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{rehireError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  New Hire Date (optional)
                </label>
                <input
                  type="date"
                  value={rehireDate}
                  onChange={(e) => setRehireDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Leave blank to keep the original hire date.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRehireModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rehireSubmitting}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {rehireSubmitting ? "Processing..." : "Confirm Rehire"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
