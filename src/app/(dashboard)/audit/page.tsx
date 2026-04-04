"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch";
import {
  PageHeader,
  Card,
  Table,
  Badge,
  Button,
  Spinner,
  EmptyState,
  Select,
} from "@/components/ui";

interface AuditEntry {
  id: number;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "create_employee", label: "Create Employee" },
  { value: "update_employee", label: "Update Employee" },
  { value: "terminate_employee", label: "Terminate Employee" },
  { value: "create_pay_run", label: "Create Pay Run" },
  { value: "calculate_pay_run", label: "Calculate Pay Run" },
  { value: "approve_pay_run", label: "Approve Pay Run" },
  { value: "update_settings", label: "Update Settings" },
  { value: "create_user", label: "Create User" },
  { value: "update_user", label: "Update User" },
  { value: "update_salary", label: "Update Salary" },
];

const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "All Entity Types" },
  { value: "employee", label: "Employee" },
  { value: "pay_run", label: "Pay Run" },
  { value: "payslip", label: "Payslip" },
  { value: "user", label: "User" },
  { value: "company", label: "Company" },
  { value: "salary_record", label: "Salary Record" },
  { value: "session", label: "Session" },
];

/** Map action prefixes to badge variants */
function actionBadgeVariant(action: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (action.startsWith("login") || action.startsWith("logout")) return "info";
  if (action.startsWith("create")) return "success";
  if (action.startsWith("update") || action.startsWith("calculate") || action.startsWith("approve"))
    return "warning";
  if (action.startsWith("delete") || action.startsWith("terminate")) return "danger";
  return "neutral";
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filters
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [userId, setUserId] = useState("");

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      if (userId) params.set("userId", userId.trim());
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) {
        // End of day for the "to" date
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }

      const res = await apiFetch(`/api/audit?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      const json = (await res.json()) as { success: boolean; data: AuditResponse };
      if (json.success && json.data) {
        setEntries(json.data.entries);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      }
    } catch {
      // Silently handle — empty state will show
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, action, entityType, userId, fromDate, toDate]);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  function handleFilterApply() {
    setPage(1);
    // fetchAudit will re-run via useEffect because page changed (or stays at 1)
    // If page is already 1, we still need to trigger — the callback deps include filters
  }

  function handleClearFilters() {
    setAction("");
    setEntityType("");
    setFromDate("");
    setToDate("");
    setUserId("");
    setPage(1);
  }

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function renderJsonDiff(oldVal: unknown, newVal: unknown) {
    const hasOld = oldVal !== null && oldVal !== undefined;
    const hasNew = newVal !== null && newVal !== undefined;

    if (!hasOld && !hasNew) {
      return <p className="text-xs text-gray-400 italic">No details recorded</p>;
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {hasOld && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500 uppercase">Previous Value</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
              {JSON.stringify(oldVal, null, 2)}
            </pre>
          </div>
        )}
        {hasNew && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500 uppercase">New Value</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              {JSON.stringify(newVal, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Trail" subtitle={`${total} total entries`} />

      {/* Filter bar */}
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Action"
            id="filter-action"
            options={ACTION_OPTIONS}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <Select
            label="Entity Type"
            id="filter-entity-type"
            options={ENTITY_TYPE_OPTIONS}
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-from" className="text-sm font-medium text-gray-700">
              From Date
            </label>
            <input
              type="date"
              id="filter-from"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:ring-offset-0 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-to" className="text-sm font-medium text-gray-700">
              To Date
            </label>
            <input
              type="date"
              id="filter-to"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:ring-offset-0 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-user" className="text-sm font-medium text-gray-700">
              User ID
            </label>
            <input
              type="text"
              id="filter-user"
              placeholder="Filter by user ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:ring-offset-0 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={handleFilterApply}>
            Apply Filters
          </Button>
          <Button size="sm" variant="secondary" onClick={handleClearFilters}>
            Clear
          </Button>
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-8 w-8 text-sky-500" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState message="No audit log entries found matching your filters." />
        </Card>
      ) : (
        <>
          <Table>
            <Table.Head>
              <tr>
                <Table.HeadCell>Timestamp</Table.HeadCell>
                <Table.HeadCell>User</Table.HeadCell>
                <Table.HeadCell>Action</Table.HeadCell>
                <Table.HeadCell>Entity Type</Table.HeadCell>
                <Table.HeadCell>Entity ID</Table.HeadCell>
                <Table.HeadCell>IP Address</Table.HeadCell>
                <Table.HeadCell className="text-right">Details</Table.HeadCell>
              </tr>
            </Table.Head>
            <Table.Body>
              {entries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <Table.Row>
                    <Table.Cell>
                      <span className="text-xs text-gray-600">
                        {formatTimestamp(entry.createdAt)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs text-gray-500">
                        {entry.userId ? entry.userId.slice(0, 8) + "..." : "-"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={actionBadgeVariant(entry.action)}>
                        {formatAction(entry.action)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{entry.entityType || "-"}</Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs text-gray-500">
                        {entry.entityId ? entry.entityId.slice(0, 8) + "..." : "-"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs text-gray-500">
                        {entry.ipAddress ?? "-"}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <button
                        onClick={() => toggleExpand(entry.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-50"
                      >
                        {expandedId === entry.id ? "Hide" : "View"}
                        <svg
                          className={`h-3.5 w-3.5 transition-transform ${expandedId === entry.id ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </Table.Cell>
                  </Table.Row>
                  {expandedId === entry.id && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 px-6 py-4">
                        {renderJsonDiff(entry.oldValue, entry.newValue)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </Table.Body>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
