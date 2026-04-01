"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge, EmptyState } from "@/components/ui";
import type { PayRunStatus } from "@/components/ui";
import { centsToCurrency } from "@/lib/utils/money";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Employee {
  id: string;
  fullName: string;
  nricLast4: string;
  position: string | null;
  department: string | null;
  employmentType: string;
  citizenshipStatus: string;
  hireDate: string;
  status: string;
  email: string | null;
  mobile: string | null;
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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAY_RUN_STAGES: PayRunStatus[] = [
  "draft",
  "calculated",
  "reviewed",
  "approved",
  "paid",
  "filed",
];

const STAGE_LABELS: Record<PayRunStatus, string> = {
  draft: "Draft",
  calculated: "Calculated",
  reviewed: "Reviewed",
  approved: "Approved",
  paid: "Paid",
  filed: "Filed",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getNextCpfDeadline(): { dateStr: string; daysUntil: number } {
  const now = new Date();
  const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const month = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  const deadline = new Date(year, month, 14);

  const diffMs = deadline.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const dateStr = deadline.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return { dateStr, daysUntil };
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const startStr = s.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
  const endStr = e.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startStr} - ${endStr}`;
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Inline SVG Icons
// ---------------------------------------------------------------------------

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
      />
    </svg>
  );
}

function BanknotesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
      />
    </svg>
  );
}

function PlayCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InfoCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [empRes, prRes] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/payroll/pay-runs"),
      ]);

      if (!empRes.ok || !prRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const empJson = await empRes.json();
      const prJson = await prRes.json();

      if (empJson.success) {
        setEmployees(empJson.data ?? []);
      }
      if (prJson.success) {
        setPayRuns(prJson.data ?? []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived data
  const activeEmployees = employees.filter((e) => e.status === "active");
  const latestPayRun = payRuns.length > 0 ? payRuns[0] : null;
  const recentPayRuns = payRuns.slice(0, 5);
  const cpfDeadline = getNextCpfDeadline();

  const employeesWithNoSalary =
    activeEmployees.length > 0 && payRuns.length === 0 ? activeEmployees.length : 0;

  const todayFormatted = new Date().toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Greeting skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="shimmer h-8 w-64 rounded-lg" />
            <div className="shimmer mt-2 h-4 w-48 rounded-md" />
          </div>
          <div className="flex gap-3">
            <div className="shimmer h-9 w-28 rounded-lg" />
            <div className="shimmer h-9 w-32 rounded-lg" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-4">
                <div className="shimmer h-11 w-11 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="shimmer h-3.5 w-24 rounded" />
                  <div className="shimmer h-7 w-20 rounded" />
                  <div className="shimmer h-3 w-16 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="shimmer h-72 rounded-xl" />
            <div className="shimmer h-64 rounded-xl" />
          </div>
          <div className="space-y-6">
            <div className="shimmer h-52 rounded-xl" />
            <div className="shimmer h-52 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <div className="rounded-xl border border-slate-200 bg-white p-1">
          <div className="flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
              <ExclamationTriangleIcon className="h-7 w-7 text-rose-500" />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Something went wrong</h2>
            <p className="mb-6 max-w-sm text-sm text-slate-500">{error}</p>
            <button
              onClick={fetchData}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Action items
  // ---------------------------------------------------------------------------

  const actionItems: Array<{
    id: string;
    title: string;
    description: string;
    variant: "warning" | "info" | "danger";
    href: string;
  }> = [];

  if (employeesWithNoSalary > 0) {
    actionItems.push({
      id: "no-salary",
      title: "Missing Salary Records",
      description: `${employeesWithNoSalary} employee${employeesWithNoSalary === 1 ? "" : "s"} have no salary records`,
      variant: "warning",
      href: "/employees",
    });
  }

  if (latestPayRun && latestPayRun.status !== "filed") {
    actionItems.push({
      id: "pay-run-status",
      title: "Pay Run In Progress",
      description: `Pay run for ${formatMonth(latestPayRun.periodStart)} is in ${STAGE_LABELS[latestPayRun.status]} status`,
      variant: latestPayRun.status === "draft" ? "warning" : "info",
      href: "/payroll",
    });
  }

  if (cpfDeadline.daysUntil <= 14) {
    actionItems.push({
      id: "cpf-deadline",
      title: "CPF Submission Due",
      description: `CPF submission due in ${cpfDeadline.daysUntil} day${cpfDeadline.daysUntil === 1 ? "" : "s"}`,
      variant: cpfDeadline.daysUntil <= 5 ? "danger" : "warning",
      href: "/cpf",
    });
  }

  // ---------------------------------------------------------------------------
  // Compliance deadlines
  // ---------------------------------------------------------------------------

  const complianceDeadlines: Array<{
    label: string;
    date: string;
    daysUntil: number;
    dayNumber: string;
  }> = [];

  const cpfDeadlineDate = new Date();
  const cpfYear =
    cpfDeadlineDate.getMonth() === 11
      ? cpfDeadlineDate.getFullYear() + 1
      : cpfDeadlineDate.getFullYear();
  const cpfMonth = cpfDeadlineDate.getMonth() === 11 ? 0 : cpfDeadlineDate.getMonth() + 1;
  const cpfDate = new Date(cpfYear, cpfMonth, 14);

  complianceDeadlines.push({
    label: "CPF Submission Deadline",
    date: cpfDeadline.dateStr,
    daysUntil: cpfDeadline.daysUntil,
    dayNumber: String(cpfDate.getDate()),
  });

  complianceDeadlines.push({
    label: "SDL Contribution Due",
    date: cpfDeadline.dateStr,
    daysUntil: cpfDeadline.daysUntil,
    dayNumber: String(cpfDate.getDate()),
  });

  const now = new Date();
  const ir8aYear = now.getMonth() < 2 ? now.getFullYear() : now.getFullYear() + 1;
  const ir8aDeadline = new Date(ir8aYear, 2, 1);
  const ir8aDaysUntil = Math.ceil((ir8aDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  complianceDeadlines.push({
    label: "IR8A Filing Deadline",
    date: ir8aDeadline.toLocaleDateString("en-SG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    daysUntil: ir8aDaysUntil,
    dayNumber: String(ir8aDeadline.getDate()),
  });

  // ---------------------------------------------------------------------------
  // Variant helpers for action items
  // ---------------------------------------------------------------------------

  const variantStyles: Record<
    string,
    { bar: string; bg: string; iconBg: string; iconText: string }
  > = {
    danger: {
      bar: "bg-rose-500",
      bg: "bg-rose-50/60",
      iconBg: "bg-rose-100",
      iconText: "text-rose-600",
    },
    warning: {
      bar: "bg-amber-500",
      bg: "bg-amber-50/60",
      iconBg: "bg-amber-100",
      iconText: "text-amber-600",
    },
    info: {
      bar: "bg-emerald-500",
      bg: "bg-emerald-50/60",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-600",
    },
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* Greeting Header                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{getGreeting()}</h1>
          <p className="mt-1 text-sm text-slate-500">{todayFormatted}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/payroll"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          >
            <PlusIcon className="h-4 w-4" />
            New Pay Run
          </Link>
          <Link
            href="/employees/new"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          >
            <UserPlusIcon className="h-4 w-4" />
            Add Employee
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stats Row — 4 cards with gradient icons                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Employees */}
        <div className="card-hover rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-4">
            <div
              className="flex shrink-0 items-center justify-center rounded-xl text-white"
              style={{
                width: 44,
                height: 44,
                background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
              }}
            >
              <UsersIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Active Employees</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {activeEmployees.length}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{employees.length} total registered</p>
            </div>
          </div>
        </div>

        {/* Monthly Payroll */}
        <div className="card-hover rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-4">
            <div
              className="flex shrink-0 items-center justify-center rounded-xl text-white"
              style={{
                width: 44,
                height: 44,
                background: "linear-gradient(135deg, #10b981, #0d9488)",
              }}
            >
              <BanknotesIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Monthly Payroll</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {latestPayRun ? centsToCurrency(latestPayRun.totalGrossCents) : "--"}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {latestPayRun
                  ? `Net: ${centsToCurrency(latestPayRun.totalNetCents)}`
                  : "No pay runs yet"}
              </p>
            </div>
          </div>
        </div>

        {/* Next CPF Deadline */}
        <div className="card-hover rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-4">
            <div
              className="flex shrink-0 items-center justify-center rounded-xl text-white"
              style={{
                width: 44,
                height: 44,
                background: "linear-gradient(135deg, #f59e0b, #f97316)",
              }}
            >
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Next CPF Deadline</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {cpfDeadline.dateStr}
              </p>
              <p
                className={`mt-0.5 text-xs ${cpfDeadline.daysUntil <= 5 ? "font-medium text-rose-500" : "text-slate-400"}`}
              >
                {cpfDeadline.daysUntil} day{cpfDeadline.daysUntil === 1 ? "" : "s"} away
              </p>
            </div>
          </div>
        </div>

        {/* Pay Run Status */}
        <div className="card-hover rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-4">
            <div
              className="flex shrink-0 items-center justify-center rounded-xl text-white"
              style={{
                width: 44,
                height: 44,
                background: "linear-gradient(135deg, #8b5cf6, #9333ea)",
              }}
            >
              <PlayCircleIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Pay Run Status</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {latestPayRun ? STAGE_LABELS[latestPayRun.status] : "None"}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {latestPayRun ? formatMonth(latestPayRun.periodStart) : "Create a pay run to start"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Two-column layout: Left (wider) + Right (narrower)                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN — spans 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Current Pay Run */}
          <div className="card-hover rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Current Pay Run</h2>
            </div>
            <div className="px-6 py-5">
              {latestPayRun ? (
                <>
                  {/* Step progress bar */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between">
                      {PAY_RUN_STAGES.map((stage, idx) => {
                        const currentIdx = PAY_RUN_STAGES.indexOf(latestPayRun.status);
                        const isCompleted = idx < currentIdx;
                        const isCurrent = idx === currentIdx;

                        return (
                          <div key={stage} className="flex flex-1 items-center">
                            {/* Connector line before (skip for first) */}
                            {idx > 0 && (
                              <div
                                className={`h-0.5 flex-1 transition-colors ${
                                  idx <= currentIdx ? "bg-emerald-500" : "bg-slate-200"
                                }`}
                              />
                            )}
                            {/* Step circle + label */}
                            <div className="flex flex-col items-center">
                              <div
                                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                                  isCompleted
                                    ? "bg-emerald-500 text-white"
                                    : isCurrent
                                      ? "bg-sky-500 text-white"
                                      : "bg-slate-200 text-slate-400"
                                }`}
                              >
                                {isCompleted ? (
                                  <CheckIcon className="h-4 w-4" />
                                ) : isCurrent ? (
                                  <>
                                    <span className="absolute inset-0 animate-ping rounded-full bg-sky-500/30" />
                                    <span className="relative h-2.5 w-2.5 rounded-full bg-white" />
                                  </>
                                ) : (
                                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                                )}
                              </div>
                              <span
                                className={`mt-2 text-[11px] font-medium ${
                                  isCompleted
                                    ? "text-emerald-600"
                                    : isCurrent
                                      ? "text-sky-600"
                                      : "text-slate-400"
                                }`}
                              >
                                {STAGE_LABELS[stage]}
                              </span>
                            </div>
                            {/* Connector line after (skip for last) */}
                            {idx < PAY_RUN_STAGES.length - 1 && (
                              <div
                                className={`h-0.5 flex-1 transition-colors ${
                                  idx < currentIdx ? "bg-emerald-500" : "bg-slate-200"
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Period info */}
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">
                      {formatPeriod(latestPayRun.periodStart, latestPayRun.periodEnd)}
                    </p>
                    <StatusBadge status={latestPayRun.status} />
                  </div>

                  {/* Summary amounts - 2x2 grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-xs font-medium tracking-wider text-slate-400 uppercase">
                        Gross Pay
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                        {centsToCurrency(latestPayRun.totalGrossCents)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-xs font-medium tracking-wider text-slate-400 uppercase">
                        Net Pay
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                        {centsToCurrency(latestPayRun.totalNetCents)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-xs font-medium tracking-wider text-slate-400 uppercase">
                        Employer CPF
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                        {centsToCurrency(latestPayRun.totalEmployerCpfCents)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-xs font-medium tracking-wider text-slate-400 uppercase">
                        Employee CPF
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                        {centsToCurrency(latestPayRun.totalEmployeeCpfCents)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Link
                      href="/payroll"
                      className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 transition-colors hover:text-blue-700"
                    >
                      View payroll details
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </>
              ) : (
                /* Empty state for no pay runs */
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                    <DocumentIcon className="h-10 w-10 text-slate-300" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">No payroll runs yet</h3>
                  <p className="mt-1 max-w-xs text-sm text-slate-500">
                    Create your first pay run to start processing payroll for your employees.
                  </p>
                  <Link
                    href="/payroll"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Create First Pay Run
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Recent Pay Runs */}
          <div className="card-hover rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Recent Pay Runs</h2>
                {payRuns.length > 5 && (
                  <Link
                    href="/payroll"
                    className="text-xs font-medium text-sky-600 transition-colors hover:text-blue-700"
                  >
                    View all
                  </Link>
                )}
              </div>
            </div>
            <div className="px-6 py-4">
              {recentPayRuns.length > 0 ? (
                <div className="-mx-6 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-6 pb-3 text-left text-xs font-semibold tracking-wider text-slate-400 uppercase">
                          Period
                        </th>
                        <th className="px-6 pb-3 text-left text-xs font-semibold tracking-wider text-slate-400 uppercase">
                          Employees
                        </th>
                        <th className="px-6 pb-3 text-left text-xs font-semibold tracking-wider text-slate-400 uppercase">
                          Status
                        </th>
                        <th className="px-6 pb-3 text-right text-xs font-semibold tracking-wider text-slate-400 uppercase">
                          Gross Pay
                        </th>
                        <th className="px-6 pb-3 text-right text-xs font-semibold tracking-wider text-slate-400 uppercase">
                          Net Pay
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {recentPayRuns.map((run) => (
                        <tr key={run.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <Link
                              href="/payroll"
                              className="text-sm font-medium text-slate-700 hover:text-sky-600"
                            >
                              {formatPeriod(run.periodStart, run.periodEnd)}
                            </Link>
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              {activeEmployees.length}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <StatusBadge status={run.status} />
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono font-medium whitespace-nowrap text-slate-900 tabular-nums">
                            {centsToCurrency(run.totalGrossCents)}
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono font-medium whitespace-nowrap text-slate-900 tabular-nums">
                            {centsToCurrency(run.totalNetCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No pay runs to display." />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — spans 1/3 */}
        <div className="space-y-6">
          {/* Action Required */}
          <div className="card-hover rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Action Required</h2>
            </div>
            <div className="px-6 py-4">
              {actionItems.length > 0 ? (
                <ul className="space-y-3">
                  {actionItems.map((item) => {
                    const style = variantStyles[item.variant as keyof typeof variantStyles] || {
                      bg: "bg-slate-50",
                      bar: "bg-slate-400",
                      iconBg: "bg-slate-100",
                      iconText: "text-slate-600",
                    };
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className={`flex items-start gap-3 overflow-hidden rounded-lg p-3 transition-all hover:opacity-90 ${style.bg}`}
                        >
                          {/* Left colored bar */}
                          <div className={`w-1 shrink-0 self-stretch rounded-full ${style.bar}`} />
                          {/* Icon */}
                          <div className="mt-0.5 shrink-0">
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full ${style.iconBg} ${style.iconText}`}
                            >
                              {item.variant === "danger" && (
                                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                              )}
                              {item.variant === "warning" && (
                                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                              )}
                              {item.variant === "info" && (
                                <InfoCircleIcon className="h-3.5 w-3.5" />
                              )}
                            </span>
                          </div>
                          {/* Text */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug font-medium text-slate-800">
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                          </div>
                          <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                    <CheckIcon className="h-6 w-6 text-emerald-500" />
                  </span>
                  <p className="text-sm font-medium text-slate-700">All caught up</p>
                  <p className="mt-0.5 text-xs text-slate-400">No pending actions right now.</p>
                </div>
              )}
            </div>
          </div>

          {/* Compliance Calendar */}
          <div className="card-hover rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Compliance Calendar</h2>
            </div>
            <div className="px-6 py-4">
              <ul className="space-y-4">
                {complianceDeadlines.map((item) => {
                  const tintClass =
                    item.daysUntil <= 7
                      ? "bg-rose-50 text-rose-700"
                      : item.daysUntil <= 30
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600";

                  return (
                    <li key={item.label} className="flex items-center gap-4">
                      {/* Colored square date badge */}
                      <div
                        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg text-center ${tintClass}`}
                      >
                        <span className="text-lg leading-none font-bold tabular-nums">
                          {item.dayNumber}
                        </span>
                        <span className="mt-0.5 text-[10px] font-medium tracking-wide uppercase opacity-70">
                          {new Date(
                            item.daysUntil <= 7
                              ? Date.now() + item.daysUntil * 86400000
                              : Date.now() + item.daysUntil * 86400000,
                          ).toLocaleDateString("en-SG", { month: "short" })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{item.label}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          in {item.daysUntil} day{item.daysUntil === 1 ? "" : "s"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
