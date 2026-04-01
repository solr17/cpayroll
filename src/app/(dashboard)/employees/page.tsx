"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
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

  const filtered = employees.filter(
    (e) =>
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (e.department ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.position ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <div className="p-8">Loading employees...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Link
          href="/employees/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Add Employee
        </Link>
      </div>

      <div className="mt-4">
        <input
          type="text"
          placeholder="Search by name, department, or position..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">NRIC</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Position</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Citizenship</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <Link href={`/employees/${emp.id}`} className="font-medium text-blue-600 hover:underline">
                    {emp.fullName}
                  </Link>
                </td>
                <td className="px-6 py-4 font-mono text-sm text-gray-500">{emp.nricDisplay}</td>
                <td className="px-6 py-4 text-sm">{emp.department ?? "—"}</td>
                <td className="px-6 py-4 text-sm">{emp.position ?? "—"}</td>
                <td className="px-6 py-4 text-sm">{emp.employmentType}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.status === "active"
                        ? "bg-green-100 text-green-700"
                        : emp.status === "probation"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {emp.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">{emp.citizenshipStatus}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  {employees.length === 0 ? "No employees yet. Add your first employee." : "No matching employees."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
