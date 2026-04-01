"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  Button,
  StatusBadge,
  Input,
  Modal,
  PageHeader,
  Spinner,
  EmptyState,
  Table,
} from "@/components/ui";
import { centsToCurrency } from "@/lib/utils/money";
import type { PayRunStatus } from "@/types";

interface PayRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayRunStatus;
  totalGrossCents: number;
  totalNetCents: number;
  employeeCount: number;
  createdAt: string;
}

export default function PayrollPage() {
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");

  const loadPayRuns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/payroll/pay-runs");
      const data = await res.json();
      if (data.success) {
        setPayRuns(data.data);
      } else {
        setError(data.error ?? "Failed to load pay runs");
      }
    } catch {
      setError("Failed to load pay runs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayRuns();
  }, [loadPayRuns]);

  function openNewPayRunModal() {
    setPeriodStart("");
    setPeriodEnd("");
    setPayDate("");
    setFormError("");
    setModalOpen(true);
  }

  async function handleCreatePayRun(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!periodStart || !periodEnd || !payDate) {
      setFormError("All fields are required");
      return;
    }

    if (periodEnd < periodStart) {
      setFormError("Period end must be on or after period start");
      return;
    }

    if (payDate < periodEnd) {
      setFormError("Pay date must be on or after period end");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/payroll/pay-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStart, periodEnd, payDate }),
      });
      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        await loadPayRuns();
      } else {
        setFormError(data.error ?? "Failed to create pay run");
      }
    } catch {
      setFormError("Failed to create pay run");
    } finally {
      setCreating(false);
    }
  }

  function formatPeriod(start: string, end: string): string {
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt(s)} - ${fmt(e)}`;
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Payroll" />
        <Card className="mt-6">
          <p className="text-red-600">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Payroll" action="New Pay Run" onAction={openNewPayRunModal} />

      <div className="mt-6">
        {payRuns.length === 0 ? (
          <Card>
            <EmptyState
              message="No pay runs yet. Create your first pay run to get started."
              action={<Button onClick={openNewPayRunModal}>New Pay Run</Button>}
            />
          </Card>
        ) : (
          <Table>
            <Table.Head>
              <tr>
                <Table.HeadCell>Period</Table.HeadCell>
                <Table.HeadCell>Pay Date</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell className="text-right">Gross</Table.HeadCell>
                <Table.HeadCell className="text-right">Net</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </tr>
            </Table.Head>
            <Table.Body>
              {payRuns.map((run) => (
                <Table.Row key={run.id}>
                  <Table.Cell>
                    <span className="font-medium">
                      {formatPeriod(run.periodStart, run.periodEnd)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{formatDate(run.payDate)}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={run.status} />
                  </Table.Cell>
                  <Table.Cell className="text-right font-mono">
                    {run.totalGrossCents > 0 ? centsToCurrency(run.totalGrossCents) : "--"}
                  </Table.Cell>
                  <Table.Cell className="text-right font-mono">
                    {run.totalNetCents > 0 ? centsToCurrency(run.totalNetCents) : "--"}
                  </Table.Cell>
                  <Table.Cell>
                    <Link
                      href={`/payroll/${run.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {run.status === "draft" ? "Enter Data" : "View"}
                    </Link>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Pay Run">
        <form onSubmit={handleCreatePayRun} className="space-y-4">
          <Input
            label="Period Start"
            id="periodStart"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
          />
          <Input
            label="Period End"
            id="periodEnd"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            required
          />
          <Input
            label="Pay Date"
            id="payDate"
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            required
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create Pay Run
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
