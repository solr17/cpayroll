"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, StatCard, StatusBadge, Badge, Button, Spinner } from "@/components/ui";
import type { PayRunStatus } from "@/components/ui";
import { centsToCurrency } from "@/lib/utils/money";
import { apiFetch } from "@/lib/fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LatestPayRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: PayRunStatus;
  totalGrossCents: number;
  totalNetCents: number;
  totalEmployerCpfCents: number;
  totalSdlCents: number;
  totalFwlCents: number;
}

interface MonthlyTrend {
  month: string;
  grossCents: number;
  netCents: number;
  headcount: number;
}

interface Deadline {
  label: string;
  date: string;
  daysUntil: number;
  type: "cpf" | "iras" | "payroll";
}

interface Activity {
  action: string;
  entityType: string;
  createdAt: string;
  userName: string;
}

interface DashboardData {
  activeEmployeeCount: number;
  totalEmployeeCount: number;
  latestPayRun: LatestPayRun | null;
  monthlyPayrollTrend: MonthlyTrend[];
  upcomingDeadlines: Deadline[];
  recentActivity: Activity[];
  companyName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const startStr = s.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
  });
  const endStr = e.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startStr} - ${endStr}`;
}

function formatMonthLabel(yyyymm: string): string {
  const [year, month] = yyyymm.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-SG", { month: "short", year: "2-digit" });
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function deadlineColor(daysUntil: number): string {
  if (daysUntil < 7) return "text-rose-600 bg-rose-50";
  if (daysUntil < 14) return "text-amber-600 bg-amber-50";
  return "text-emerald-600 bg-emerald-50";
}

function deadlineBadgeVariant(daysUntil: number): "danger" | "warning" | "success" {
  if (daysUntil < 7) return "danger";
  if (daysUntil < 14) return "warning";
  return "success";
}

// ---------------------------------------------------------------------------
// Bar Chart Component (div-based, no library)
// ---------------------------------------------------------------------------

function TrendChart({ data }: { data: MonthlyTrend[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No payroll data yet</p>;
  }

  const maxGross = Math.max(...data.map((d) => d.grossCents), 1);

  return (
    <div className="flex items-end gap-3" style={{ height: 160 }}>
      {data.map((item) => {
        const heightPct = Math.max((item.grossCents / maxGross) * 100, 4);
        return (
          <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-medium text-slate-500">
              {centsToCurrency(item.grossCents)}
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-sky-500 to-blue-400 transition-all duration-500"
              style={{ height: `${heightPct}%`, minHeight: 4 }}
              title={`Gross: ${centsToCurrency(item.grossCents)}`}
            />
            <span className="text-xs text-slate-400">{formatMonthLabel(item.month)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/api/dashboard");
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error ?? "Failed to load dashboard");
      }
      setData(json.data as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 text-sky-500" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md text-center">
          <div className="mb-4 text-rose-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="mb-2 font-semibold text-slate-800">Failed to load dashboard</p>
          <p className="mb-4 text-sm text-slate-500">{error}</p>
          <Button onClick={fetchDashboard} variant="secondary">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const employerCosts = data.latestPayRun
    ? data.latestPayRun.totalEmployerCpfCents +
      data.latestPayRun.totalSdlCents +
      data.latestPayRun.totalFwlCents
    : 0;

  const todayStr = new Date().toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Greeting Bar */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{getGreeting()}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {todayStr} &middot; {data.companyName}
        </p>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Employees"
          value={String(data.activeEmployeeCount)}
          change={`${data.totalEmployeeCount} total`}
          changeType="neutral"
        />
        <StatCard
          label="Monthly Gross Pay"
          value={data.latestPayRun ? centsToCurrency(data.latestPayRun.totalGrossCents) : "S$0.00"}
        />
        <StatCard
          label="Monthly Net Pay"
          value={data.latestPayRun ? centsToCurrency(data.latestPayRun.totalNetCents) : "S$0.00"}
        />
        <StatCard
          label="Employer Costs"
          value={centsToCurrency(employerCosts)}
          change="ER CPF + SDL + FWL"
          changeType="neutral"
        />
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Latest Pay Run */}
          <Card title="Latest Pay Run">
            {data.latestPayRun ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    {formatPeriod(data.latestPayRun.periodStart, data.latestPayRun.periodEnd)}
                  </span>
                  <StatusBadge status={data.latestPayRun.status} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Gross Pay</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {centsToCurrency(data.latestPayRun.totalGrossCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Net Pay</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {centsToCurrency(data.latestPayRun.totalNetCents)}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/payroll`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700"
                >
                  View Details
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-slate-400">
                No pay runs yet. Run your first payroll to see data here.
              </p>
            )}
          </Card>

          {/* Monthly Trend */}
          <Card title="Monthly Payroll Trend">
            <TrendChart data={data.monthlyPayrollTrend} />
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          <Card title="Upcoming Deadlines">
            {data.upcomingDeadlines.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {data.upcomingDeadlines.map((deadline) => (
                  <li
                    key={deadline.label}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${deadlineColor(deadline.daysUntil)}`}
                      >
                        {deadline.daysUntil}d
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{deadline.label}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(deadline.date).toLocaleDateString("en-SG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={deadlineBadgeVariant(deadline.daysUntil)}>
                      {deadline.daysUntil < 7
                        ? "Urgent"
                        : deadline.daysUntil < 14
                          ? "Soon"
                          : "On Track"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-slate-400">No upcoming deadlines</p>
            )}
          </Card>

          {/* Recent Activity */}
          <Card title="Recent Activity">
            {data.recentActivity.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {data.recentActivity.map((activity, idx) => (
                  <li
                    key={`${activity.createdAt}-${idx}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {formatAction(activity.action)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {activity.userName} &middot; {activity.entityType}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 text-xs text-slate-400">
                      {timeAgo(activity.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-slate-400">No recent activity</p>
            )}
          </Card>
        </div>
      </div>

      {/* Quick Actions Row */}
      <Card title="Quick Actions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/payroll">
            <Button variant="primary" className="w-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Run Payroll
            </Button>
          </Link>
          <Link href="/employees/new">
            <Button variant="secondary" className="w-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              Add Employee
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="secondary" className="w-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              View Reports
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="secondary" className="w-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
