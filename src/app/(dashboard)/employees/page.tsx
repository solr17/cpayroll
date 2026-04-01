"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Badge, Spinner, EmptyState } from "@/components/ui";

interface Employee {
  id: string;
  fullName: string;
  nricDisplay: string;
  position: string | null;
  department: string | null;
  employmentType: string;
  citizenshipStatus: string;
  hireDate: string;
  status: string;
  email: string | null;
  mobile: string | null;
}

const citizenshipLabels: Record<string, string> = {
  SC: "Citizen",
  PR1: "PR (1st yr)",
  PR2: "PR (2nd yr)",
  PR3: "PR (3rd+ yr)",
  FW: "Foreign",
};

const typeLabels: Record<string, string> = {
  FT: "Full-Time",
  PT: "Part-Time",
  CONTRACT: "Contract",
  LOCUM: "Locum",
};

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "neutral" }> =
  {
    active: { label: "Active", variant: "success" },
    probation: { label: "Probation", variant: "warning" },
    terminated: { label: "Terminated", variant: "neutral" },
  };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/employees");
        const data = await res.json();
        if (data.success) {
          setEmployees(data.data);
        } else {
          setError(data.error);
        }
      } catch {
        setError("Failed to load employees");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))] as string[];

  const filtered = employees.filter((e) => {
    const matchSearch =
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (e.department ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.position ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchDept = !filterDept || e.department === filterDept;
    const matchStatus = !filterStatus || e.status === filterStatus;
    return matchSearch && matchDept && matchStatus;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} total employee${employees.length !== 1 ? "s" : ""}`}
        action="Add Employee"
        onAction={() => (window.location.href = "/employees/new")}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name, department, position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="probation">Probation</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          message={
            employees.length === 0
              ? "No employees yet. Add your first employee."
              : "No employees match your filters."
          }
          action={
            employees.length === 0 ? (
              <Link
                href="/employees/new"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add First Employee
              </Link>
            ) : undefined
          }
        />
      ) : (
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
                <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Type
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Citizenship
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Status
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((emp) => {
                const sc = statusConfig[emp.status] ?? {
                  label: "Active",
                  variant: "success" as const,
                };
                return (
                  <tr key={emp.id} className="group transition-colors hover:bg-sky-50/40">
                    <td className="px-5 py-4">
                      <Link href={`/employees/${emp.id}`} className="block">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-semibold text-white shadow-sm">
                            {emp.fullName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 group-hover:text-sky-600">
                              {emp.fullName}
                            </p>
                            <p className="text-xs text-slate-400">
                              {emp.nricDisplay}
                              {emp.position ? ` \u00B7 ${emp.position}` : ""}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {emp.department ?? "\u2014"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {typeLabels[emp.employmentType] ?? emp.employmentType}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {citizenshipLabels[emp.citizenshipStatus] ?? emp.citizenshipStatus}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-slate-500 tabular-nums">
                      {new Date(emp.hireDate).toLocaleDateString("en-SG", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3">
            <p className="text-xs text-slate-400">
              Showing {filtered.length} of {employees.length} employees
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
