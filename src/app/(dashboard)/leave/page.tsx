"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Textarea,
  Modal,
  PageHeader,
  Spinner,
  EmptyState,
  Table,
} from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaveRecord {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy: string | null;
  notes: string | null;
  createdAt: string;
}

interface LeaveBalance {
  id: string;
  employeeId: string;
  year: number;
  leaveType: string;
  entitlementDays: string;
  usedDays: string;
  carryOverDays: string;
  adjustmentDays: string;
}

interface Employee {
  id: string;
  fullName: string;
  employeeCode: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEAVE_TYPE_OPTIONS = [
  { value: "", label: "Select leave type" },
  { value: "annual", label: "Annual Leave" },
  { value: "sick_outpatient", label: "Sick Leave (Outpatient)" },
  { value: "sick_hospitalisation", label: "Sick Leave (Hospitalisation)" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "paternity", label: "Paternity Leave" },
  { value: "childcare", label: "Childcare Leave" },
  { value: "compassionate", label: "Compassionate Leave" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "other", label: "Other" },
];

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  sick_outpatient: "Sick (OP)",
  sick_hospitalisation: "Sick (Hosp)",
  maternity: "Maternity",
  paternity: "Paternity",
  childcare: "Childcare",
  compassionate: "Compassionate",
  unpaid: "Unpaid",
  other: "Other",
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

function statusBadgeVariant(status: string): "warning" | "success" | "danger" | "neutral" {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

function calculateWorkingDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (e < s) return 0;

  let count = 0;
  const current = new Date(s);
  while (current <= e) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeavePage() {
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Form fields
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formLeaveType, setFormLeaveType] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await apiFetch("/api/employees");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setEmployees(data.data);
      }
    } catch {
      // Employees list is supplementary
    }
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterEmployee) params.set("employeeId", filterEmployee);
      if (filterStatus) params.set("status", filterStatus);
      const qs = params.toString();
      const res = await apiFetch(`/api/leave${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data);
      } else {
        setError(data.error ?? "Failed to load leave requests");
      }
    } catch {
      setError("Failed to load leave requests");
    }
  }, [filterEmployee, filterStatus]);

  const loadBalances = useCallback(
    async (employeeId?: string) => {
      try {
        const params = new URLSearchParams();
        if (employeeId || filterEmployee) {
          params.set("employeeId", employeeId || filterEmployee);
        }
        params.set("year", String(new Date().getFullYear()));
        const res = await apiFetch(`/api/leave/balances?${params.toString()}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setBalances(data.data);
        }
      } catch {
        // Balances are supplementary
      }
    },
    [filterEmployee],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    await Promise.all([loadEmployees(), loadRecords(), loadBalances()]);
    setLoading(false);
  }, [loadEmployees, loadRecords, loadBalances]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Reload records when filters change
  useEffect(() => {
    loadRecords();
    if (filterEmployee) {
      loadBalances(filterEmployee);
    }
  }, [filterEmployee, filterStatus, loadRecords, loadBalances]);

  // ---------------------------------------------------------------------------
  // Employee name lookup
  // ---------------------------------------------------------------------------

  function employeeName(id: string): string {
    const emp = employees.find((e) => e.id === id);
    return emp ? emp.fullName : id.substring(0, 8) + "...";
  }

  // ---------------------------------------------------------------------------
  // Submit leave request
  // ---------------------------------------------------------------------------

  function openModal() {
    setFormEmployeeId(employees.length > 0 ? (employees[0]?.id ?? "") : "");
    setFormLeaveType("");
    setFormStartDate("");
    setFormEndDate("");
    setFormNotes("");
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formEmployeeId || !formLeaveType || !formStartDate || !formEndDate) {
      setFormError("All fields are required");
      return;
    }

    if (formEndDate < formStartDate) {
      setFormError("End date must be on or after start date");
      return;
    }

    const days = calculateWorkingDays(formStartDate, formEndDate);
    if (days <= 0) {
      setFormError("Selected date range contains no working days");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/leave", {
        method: "POST",
        body: JSON.stringify({
          employeeId: formEmployeeId,
          leaveType: formLeaveType,
          startDate: formStartDate,
          endDate: formEndDate,
          days,
          notes: formNotes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        await Promise.all([loadRecords(), loadBalances(formEmployeeId)]);
      } else {
        setFormError(data.error ?? "Failed to submit leave request");
      }
    } catch {
      setFormError("Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Approve / Reject / Cancel
  // ---------------------------------------------------------------------------

  async function handleAction(id: string, action: "approved" | "rejected" | "cancel") {
    setActionLoading(id);
    try {
      if (action === "cancel") {
        const res = await apiFetch(`/api/leave/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) {
          setError(data.error ?? "Failed to cancel leave request");
        }
      } else {
        const res = await apiFetch(`/api/leave/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: action }),
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.error ?? `Failed to ${action} leave request`);
        }
      }
      await Promise.all([loadRecords(), loadBalances()]);
    } catch {
      setError("Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Balance cards
  // ---------------------------------------------------------------------------

  const balanceCards = balances
    .filter((b) => {
      // Show main leave types
      return [
        "annual",
        "sick_outpatient",
        "sick_hospitalisation",
        "childcare",
        "compassionate",
      ].includes(b.leaveType);
    })
    .map((b) => {
      const entitlement =
        parseFloat(b.entitlementDays) + parseFloat(b.carryOverDays) + parseFloat(b.adjustmentDays);
      const used = parseFloat(b.usedDays);
      const remaining = entitlement - used;
      return {
        type: b.leaveType,
        label: LEAVE_TYPE_LABELS[b.leaveType] ?? b.leaveType,
        entitlement,
        used,
        remaining,
      };
    });

  // ---------------------------------------------------------------------------
  // Computed days for form
  // ---------------------------------------------------------------------------

  const computedDays =
    formStartDate && formEndDate ? calculateWorkingDays(formStartDate, formEndDate) : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  const employeeOptions = [
    { value: "", label: "All employees" },
    ...employees.map((e) => ({
      value: e.id,
      label: `${e.fullName}${e.employeeCode ? ` (${e.employeeCode})` : ""}`,
    })),
  ];

  const employeeSelectOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.fullName}${e.employeeCode ? ` (${e.employeeCode})` : ""}`,
  }));

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Manage leave requests and track balances"
        action="New Leave Request"
        onAction={openModal}
      />

      {/* Balance summary cards */}
      {balanceCards.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {balanceCards.map((b) => (
            <Card key={b.type} className="!p-4">
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                {b.label}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {b.remaining}
                <span className="text-sm font-normal text-slate-400">/{b.entitlement}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{b.used} days used</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <Select
          label="Employee"
          id="filterEmployee"
          options={employeeOptions}
          value={filterEmployee}
          onChange={(e) => setFilterEmployee(e.target.value)}
          className="w-64"
        />
        <Select
          label="Status"
          id="filterStatus"
          options={STATUS_FILTER_OPTIONS}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Error display */}
      {error && (
        <Card className="mt-4">
          <p className="text-red-600">{error}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setError("")}>
            Dismiss
          </Button>
        </Card>
      )}

      {/* Leave requests table */}
      <div className="mt-6">
        {records.length === 0 ? (
          <Card>
            <EmptyState
              message="No leave requests found. Submit a new request to get started."
              action={<Button onClick={openModal}>New Leave Request</Button>}
            />
          </Card>
        ) : (
          <Table>
            <Table.Head>
              <tr>
                <Table.HeadCell>Employee</Table.HeadCell>
                <Table.HeadCell>Type</Table.HeadCell>
                <Table.HeadCell>Dates</Table.HeadCell>
                <Table.HeadCell className="text-right">Days</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Notes</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </tr>
            </Table.Head>
            <Table.Body>
              {records.map((rec) => (
                <Table.Row key={rec.id}>
                  <Table.Cell>
                    <span className="font-medium">{employeeName(rec.employeeId)}</span>
                  </Table.Cell>
                  <Table.Cell>{LEAVE_TYPE_LABELS[rec.leaveType] ?? rec.leaveType}</Table.Cell>
                  <Table.Cell>
                    <span className="text-xs">
                      {formatDate(rec.startDate)} - {formatDate(rec.endDate)}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-right font-mono">{rec.days}</Table.Cell>
                  <Table.Cell>
                    <Badge variant={statusBadgeVariant(rec.status)}>
                      {rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="max-w-[200px] truncate text-xs text-slate-500">
                      {rec.notes ?? "--"}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      {rec.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleAction(rec.id, "approved")}
                            loading={actionLoading === rec.id}
                            disabled={actionLoading !== null}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleAction(rec.id, "rejected")}
                            loading={actionLoading === rec.id}
                            disabled={actionLoading !== null}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {(rec.status === "pending" || rec.status === "approved") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAction(rec.id, "cancel")}
                          loading={actionLoading === rec.id}
                          disabled={actionLoading !== null}
                        >
                          Cancel
                        </Button>
                      )}
                      {rec.status === "rejected" || rec.status === "cancelled" ? (
                        <span className="text-xs text-slate-400">--</span>
                      ) : null}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* New leave request modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Leave Request">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Employee"
            id="formEmployee"
            options={
              employeeSelectOptions.length > 0
                ? [{ value: "", label: "Select employee" }, ...employeeSelectOptions]
                : [{ value: "", label: "No employees found" }]
            }
            value={formEmployeeId}
            onChange={(e) => setFormEmployeeId(e.target.value)}
            required
          />
          <Select
            label="Leave Type"
            id="formLeaveType"
            options={LEAVE_TYPE_OPTIONS}
            value={formLeaveType}
            onChange={(e) => setFormLeaveType(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              id="formStartDate"
              type="date"
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
              required
            />
            <Input
              label="End Date"
              id="formEndDate"
              type="date"
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.target.value)}
              required
            />
          </div>
          {computedDays > 0 && (
            <div className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800">
              <span className="font-semibold">{computedDays}</span> working day
              {computedDays !== 1 ? "s" : ""} selected (excludes weekends)
            </div>
          )}
          <Textarea
            label="Notes (optional)"
            id="formNotes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            rows={2}
            placeholder="Reason for leave..."
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
