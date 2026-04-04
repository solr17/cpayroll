"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  Button,
  Badge,
  Select,
  Modal,
  PageHeader,
  Spinner,
  EmptyState,
  StatCard,
  Table,
} from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { centsToCurrency } from "@/lib/utils/money";

type PaymentStatus = "pending" | "submitted" | "processing" | "completed" | "failed" | "cancelled";

interface Payment {
  id: string;
  payRunId: string;
  payslipId: string | null;
  employeeId: string | null;
  employeeName: string;
  bankName: string;
  accountNumberMasked: string;
  amountCents: number;
  status: PaymentStatus;
  paymentMethod: string;
  bankReference: string | null;
  failureReason: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PayRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
}

interface Summary {
  [key: string]: { count: number; totalCents: number };
}

interface ReconcileResult {
  matched: number;
  unmatched: number;
  details: Array<{
    paymentId: string;
    employeeName: string;
    amountCents: number;
    bankReference: string;
    matchType: string;
  }>;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE_MAP: Record<
  PaymentStatus,
  { variant: "success" | "warning" | "danger" | "info" | "neutral"; label: string }
> = {
  pending: { variant: "neutral", label: "Pending" },
  submitted: { variant: "info", label: "Submitted" },
  processing: { variant: "warning", label: "Processing" },
  completed: { variant: "success", label: "Completed" },
  failed: { variant: "danger", label: "Failed" },
  cancelled: { variant: "neutral", label: "Cancelled" },
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [selectedPayRunId, setSelectedPayRunId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Batch actions
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Single update modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updatePayment, setUpdatePayment] = useState<Payment | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateRef, setUpdateRef] = useState("");
  const [updateReason, setUpdateReason] = useState("");
  const [updating, setUpdating] = useState(false);

  // Reconciliation
  const [reconModalOpen, setReconModalOpen] = useState(false);
  const [reconFile, setReconFile] = useState<File | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconResult, setReconResult] = useState<ReconcileResult | null>(null);

  const loadPayRuns = useCallback(async () => {
    try {
      const res = await apiFetch("/api/payroll/pay-runs");
      const data = await res.json();
      if (data.success) {
        setPayRuns(data.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedPayRunId) params.set("payRunId", selectedPayRunId);
      if (selectedStatus) params.set("status", selectedStatus);
      params.set("page", String(page));
      params.set("limit", "50");

      const res = await apiFetch(`/api/payments?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPayments(data.data.payments);
        setSummary(data.data.summary);
        setTotalPages(data.data.pagination.totalPages);
      } else {
        setError(data.error ?? "Failed to load payments");
      }
    } catch {
      setError("Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [selectedPayRunId, selectedStatus, page]);

  useEffect(() => {
    loadPayRuns();
  }, [loadPayRuns]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Summary helpers
  function summaryCount(status: string): number {
    return summary[status]?.count ?? 0;
  }
  function summaryTotal(status: string): number {
    return summary[status]?.totalCents ?? 0;
  }

  // Selection
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === payments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(payments.map((p) => p.id)));
    }
  }

  // Batch actions
  async function handleBatchUpdate(newStatus: string) {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const res = await apiFetch("/api/payments/bulk-update", {
        method: "POST",
        body: JSON.stringify({
          paymentIds: Array.from(selectedIds),
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedIds(new Set());
        await loadPayments();
      } else {
        setError(data.error ?? "Bulk update failed");
      }
    } catch {
      setError("Bulk update failed");
    } finally {
      setBatchLoading(false);
    }
  }

  // Single payment update
  function openUpdateModal(payment: Payment) {
    setUpdatePayment(payment);
    setUpdateStatus(payment.status);
    setUpdateRef(payment.bankReference ?? "");
    setUpdateReason(payment.failureReason ?? "");
    setUpdateModalOpen(true);
  }

  async function handleSingleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!updatePayment) return;
    setUpdating(true);
    try {
      const body: Record<string, string> = { status: updateStatus };
      if (updateRef) body.bankReference = updateRef;
      if (updateReason) body.failureReason = updateReason;

      const res = await apiFetch(`/api/payments/${updatePayment.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setUpdateModalOpen(false);
        await loadPayments();
      } else {
        setError(data.error ?? "Update failed");
      }
    } catch {
      setError("Update failed");
    } finally {
      setUpdating(false);
    }
  }

  // Reconciliation
  async function handleReconcile(e: React.FormEvent) {
    e.preventDefault();
    if (!reconFile) return;
    setReconLoading(true);
    setReconResult(null);
    try {
      const formData = new FormData();
      formData.append("file", reconFile);

      const res = await fetch("/api/payments/reconcile", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setReconResult(data.data);
        await loadPayments();
      } else {
        setError(data.error ?? "Reconciliation failed");
      }
    } catch {
      setError("Reconciliation failed");
    } finally {
      setReconLoading(false);
    }
  }

  // Export payment report as CSV
  function handleExportCsv() {
    const header = "Employee,Bank,Account,Amount,Status,Method,Reference,Created";
    const rows = payments.map((p) =>
      [
        `"${p.employeeName}"`,
        p.bankName,
        p.accountNumberMasked,
        (p.amountCents / 100).toFixed(2),
        p.status,
        p.paymentMethod,
        p.bankReference ?? "",
        p.createdAt,
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
  }

  const payRunOptions = [
    { value: "", label: "All Pay Runs" },
    ...payRuns.map((pr) => ({
      value: pr.id,
      label: `${pr.periodStart} to ${pr.periodEnd}`,
    })),
  ];

  if (loading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Payments" subtitle="Track and reconcile bank payments" />

      {error && (
        <Card className="mt-4">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setError("")}>
            Dismiss
          </Button>
        </Card>
      )}

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pending"
          value={centsToCurrency(summaryTotal("pending"))}
          change={`${summaryCount("pending")} payments`}
          changeType="neutral"
        />
        <StatCard
          label="Submitted"
          value={centsToCurrency(summaryTotal("submitted"))}
          change={`${summaryCount("submitted")} payments`}
          changeType="neutral"
        />
        <StatCard
          label="Completed"
          value={centsToCurrency(summaryTotal("completed"))}
          change={`${summaryCount("completed")} payments`}
          changeType="up"
        />
        <StatCard
          label="Failed"
          value={centsToCurrency(summaryTotal("failed"))}
          change={`${summaryCount("failed")} payments`}
          changeType={summaryCount("failed") > 0 ? "down" : "neutral"}
        />
      </div>

      {/* Filters and actions */}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <Select
          label="Pay Run"
          id="payRunFilter"
          options={payRunOptions}
          value={selectedPayRunId}
          onChange={(e) => {
            setSelectedPayRunId(e.target.value);
            setPage(1);
          }}
          className="w-64"
        />
        <Select
          label="Status"
          id="statusFilter"
          options={STATUS_OPTIONS}
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          className="w-48"
        />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={payments.length === 0}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setReconModalOpen(true);
              setReconResult(null);
              setReconFile(null);
            }}
          >
            Reconcile
          </Button>
        </div>
      </div>

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
          <span className="text-sm font-medium text-sky-800">
            {selectedIds.size} payment{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            variant="secondary"
            loading={batchLoading}
            onClick={() => handleBatchUpdate("submitted")}
          >
            Mark Submitted
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={batchLoading}
            onClick={() => handleBatchUpdate("completed")}
          >
            Mark Completed
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={batchLoading}
            onClick={() => handleBatchUpdate("cancelled")}
          >
            Cancel
          </Button>
          <button
            className="ml-auto text-sm text-sky-600 hover:underline"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Payments table */}
      <div className="mt-4">
        {payments.length === 0 ? (
          <Card>
            <EmptyState message="No payments found. Payment records are created when you export GIRO bank files from a pay run." />
          </Card>
        ) : (
          <Table>
            <Table.Head>
              <tr>
                <Table.HeadCell className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === payments.length && payments.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </Table.HeadCell>
                <Table.HeadCell>Employee</Table.HeadCell>
                <Table.HeadCell>Bank</Table.HeadCell>
                <Table.HeadCell>Account</Table.HeadCell>
                <Table.HeadCell className="text-right">Amount</Table.HeadCell>
                <Table.HeadCell>Method</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Reference</Table.HeadCell>
                <Table.HeadCell>Date</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </tr>
            </Table.Head>
            <Table.Body>
              {payments.map((payment) => {
                const statusInfo = STATUS_BADGE_MAP[payment.status];
                return (
                  <Table.Row key={payment.id}>
                    <Table.Cell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(payment.id)}
                        onChange={() => toggleSelect(payment.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-medium">{payment.employeeName}</span>
                    </Table.Cell>
                    <Table.Cell>{payment.bankName}</Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">{payment.accountNumberMasked}</span>
                    </Table.Cell>
                    <Table.Cell className="text-right font-mono">
                      {centsToCurrency(payment.amountCents)}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs uppercase">{payment.paymentMethod}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">{payment.bankReference ?? "--"}</span>
                    </Table.Cell>
                    <Table.Cell>{formatDate(payment.createdAt)}</Table.Cell>
                    <Table.Cell>
                      <button
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        onClick={() => openUpdateModal(payment)}
                      >
                        Update
                      </button>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Single update modal */}
      <Modal
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        title="Update Payment"
      >
        {updatePayment && (
          <form onSubmit={handleSingleUpdate} className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Employee</p>
              <p className="font-medium">{updatePayment.employeeName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-mono font-medium">{centsToCurrency(updatePayment.amountCents)}</p>
            </div>
            <Select
              label="Status"
              id="updateStatus"
              options={[
                { value: "submitted", label: "Submitted" },
                { value: "processing", label: "Processing" },
                { value: "completed", label: "Completed" },
                { value: "failed", label: "Failed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bankRef" className="text-sm font-medium text-gray-700">
                Bank Reference
              </label>
              <input
                id="bankRef"
                type="text"
                value={updateRef}
                onChange={(e) => setUpdateRef(e.target.value)}
                placeholder="Transaction reference from bank"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              />
            </div>
            {updateStatus === "failed" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="failReason" className="text-sm font-medium text-gray-700">
                  Failure Reason
                </label>
                <input
                  id="failReason"
                  type="text"
                  value={updateReason}
                  onChange={(e) => setUpdateReason(e.target.value)}
                  placeholder="Reason for failure"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setUpdateModalOpen(false)}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button type="submit" loading={updating}>
                Update Payment
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reconciliation modal */}
      <Modal
        open={reconModalOpen}
        onClose={() => setReconModalOpen(false)}
        title="Bank Reconciliation"
        size="lg"
      >
        <form onSubmit={handleReconcile} className="space-y-4">
          <p className="text-sm text-gray-500">
            Upload a bank statement CSV to automatically match and reconcile payments. The CSV
            should include at minimum an &quot;amount&quot; column. Columns named
            &quot;reference&quot; and &quot;date&quot; will also be used for matching.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reconFile" className="text-sm font-medium text-gray-700">
              Bank Statement CSV
            </label>
            <input
              id="reconFile"
              type="file"
              accept=".csv"
              onChange={(e) => setReconFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-sky-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-sky-700"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setReconModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={reconLoading} disabled={!reconFile}>
              Reconcile
            </Button>
          </div>
        </form>

        {reconResult && (
          <div className="mt-6 space-y-3 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Reconciliation Results</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-2xl font-bold text-emerald-700">{reconResult.matched}</p>
                <p className="text-xs text-emerald-600">Matched & Completed</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-2xl font-bold text-amber-700">{reconResult.unmatched}</p>
                <p className="text-xs text-amber-600">Unmatched Rows</p>
              </div>
            </div>
            {reconResult.details.length > 0 && (
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">
                        Employee
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">
                        Match Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reconResult.details.map((d) => (
                      <tr key={d.paymentId}>
                        <td className="px-3 py-2">{d.employeeName}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {centsToCurrency(d.amountCents)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={d.matchType === "exact_ref" ? "success" : "info"}>
                            {d.matchType === "exact_ref" ? "Reference" : "Amount"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
