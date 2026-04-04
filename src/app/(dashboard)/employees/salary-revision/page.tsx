"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface EmployeeOption {
  id: string;
  fullName: string;
  department: string | null;
}

interface PreviewEmployee {
  id: string;
  name: string;
  department: string | null;
  currentBasicCents: number;
  newBasicCents: number;
  changeCents: number;
  changePercent: number;
}

type Step = "configure" | "preview" | "success";

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SalaryRevisionPage() {
  const [step, setStep] = useState<Step>("configure");

  // Config state
  const [method, setMethod] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);

  // Preview state
  const [previews, setPreviews] = useState<PreviewEmployee[]>([]);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);

  // Apply state
  const [appliedCount, setAppliedCount] = useState(0);
  const [applyErrors, setApplyErrors] = useState<string[]>([]);

  // Loading / error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadEmployees() {
    if (employeesLoaded) return;
    try {
      const res = await apiFetch("/api/employees");
      const data = await res.json();
      if (data.success) {
        setAllEmployees(
          data.data
            .filter((e: { status: string }) => e.status === "active" || e.status === "probation")
            .map((e: { id: string; fullName: string; department: string | null }) => ({
              id: e.id,
              fullName: e.fullName,
              department: e.department,
            })),
        );
        setEmployeesLoaded(true);
      }
    } catch {
      // ignore — employees list optional
    }
  }

  async function handlePreview() {
    setError("");
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      setError(
        method === "percentage"
          ? "Enter a valid percentage (e.g. 3.5)"
          : "Enter a valid amount in dollars",
      );
      return;
    }
    if (!effectiveDate) {
      setError("Select an effective date");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        action: "preview",
        method,
        value: method === "fixed" ? Math.round(numValue * 100) : numValue,
        effectiveDate,
      };
      if (scope === "selected" && selectedIds.length > 0) {
        body.employeeIds = selectedIds;
      }

      const res = await apiFetch("/api/salary/bulk-revision", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Preview failed");
        return;
      }

      setPreviews(data.data.employees);
      setPreviewErrors(data.data.errors ?? []);
      setStep("preview");
    } catch {
      setError("Failed to generate preview");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    setError("");
    setLoading(true);
    try {
      const numValue = parseFloat(value);
      const body: Record<string, unknown> = {
        action: "apply",
        method,
        value: method === "fixed" ? Math.round(numValue * 100) : numValue,
        effectiveDate,
      };
      if (scope === "selected" && selectedIds.length > 0) {
        body.employeeIds = selectedIds;
      }

      const res = await apiFetch("/api/salary/bulk-revision", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Apply failed");
        return;
      }

      setAppliedCount(data.data.applied);
      setApplyErrors(data.data.errors ?? []);
      setStep("success");
    } catch {
      setError("Failed to apply revision");
    } finally {
      setLoading(false);
    }
  }

  function toggleEmployee(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Totals for preview
  const totalMonthlyCents = previews.reduce((sum, e) => sum + e.changeCents, 0);
  const totalAnnualCents = totalMonthlyCents * 12;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Bulk Salary Revision</h1>
          <p className="mt-1 text-sm text-gray-500">
            Apply salary increases to multiple employees at once
          </p>
        </div>
        <Link
          href="/employees"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to Employees
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Configure */}
      {step === "configure" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-900">Configure Revision</h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Method */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Revision Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "percentage" | "fixed")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              >
                <option value="percentage">Percentage Increase</option>
                <option value="fixed">Fixed Amount Increase</option>
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {method === "percentage" ? "Increase (%)" : "Increase Amount ($)"}
              </label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">
                  {method === "percentage" ? "%" : "$"}
                </span>
                <input
                  type="number"
                  step={method === "percentage" ? "0.1" : "0.01"}
                  min="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={method === "percentage" ? "3.5" : "200.00"}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-4 pl-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Effective Date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Effective Date
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              />
            </div>

            {/* Scope */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Apply To</label>
              <select
                value={scope}
                onChange={(e) => {
                  const val = e.target.value as "all" | "selected";
                  setScope(val);
                  if (val === "selected") loadEmployees();
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              >
                <option value="all">All Active Employees</option>
                <option value="selected">Select Specific Employees</option>
              </select>
            </div>
          </div>

          {/* Employee Selector */}
          {scope === "selected" && (
            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Select Employees ({selectedIds.length} selected)
              </label>
              {!employeesLoaded ? (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                  <Spinner className="h-4 w-4" /> Loading employees...
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                  {allEmployees.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No active employees found</p>
                  ) : (
                    allEmployees.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(emp.id)}
                          onChange={() => toggleEmployee(emp.id)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-sm text-slate-900">{emp.fullName}</span>
                        {emp.department && (
                          <span className="text-xs text-slate-400">{emp.department}</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button
              onClick={handlePreview}
              loading={loading}
              disabled={
                !value || !effectiveDate || (scope === "selected" && selectedIds.length === 0)
              }
            >
              Preview Changes
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Confirm */}
      {step === "preview" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Employees
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{previews.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Monthly Increase
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {formatCents(totalMonthlyCents)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Annual Increase
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {formatCents(totalAnnualCents)}
              </p>
            </div>
          </div>

          {previewErrors.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-1 text-sm font-medium text-amber-800">Warnings</p>
              <ul className="list-inside list-disc text-sm text-amber-700">
                {previewErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Employee
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Department
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Current Salary
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    New Salary
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Change ($)
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Change (%)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previews.map((emp) => (
                  <tr key={emp.id} className="hover:bg-sky-50/40">
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{emp.name}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">
                      {emp.department ?? "\u2014"}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm text-slate-600 tabular-nums">
                      {formatCents(emp.currentBasicCents)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium text-slate-900 tabular-nums">
                      {formatCents(emp.newBasicCents)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm text-emerald-600 tabular-nums">
                      +{formatCents(emp.changeCents)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm text-emerald-600 tabular-nums">
                      +{emp.changePercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={() => {
                setStep("configure");
                setError("");
              }}
            >
              Back to Configure
            </Button>
            <Button onClick={handleApply} loading={loading}>
              Apply Revision
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === "success" && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-8 w-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-900">Salary Revision Applied</h2>
          <p className="mb-1 text-sm text-slate-600">
            {appliedCount} salary record{appliedCount !== 1 ? "s" : ""} updated successfully.
          </p>
          <p className="mb-6 text-xs text-slate-400">Effective from {effectiveDate}</p>

          {applyErrors.length > 0 && (
            <div className="mx-auto mb-6 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
              <p className="mb-1 text-sm font-medium text-amber-800">Some records had issues:</p>
              <ul className="list-inside list-disc text-sm text-amber-700">
                {applyErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Link
              href="/employees"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View Employees
            </Link>
            <Button
              onClick={() => {
                setStep("configure");
                setValue("");
                setEffectiveDate("");
                setPreviews([]);
                setPreviewErrors([]);
                setAppliedCount(0);
                setApplyErrors([]);
                setError("");
              }}
            >
              New Revision
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
