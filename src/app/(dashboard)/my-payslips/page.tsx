"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Table, Badge, Button, Spinner, EmptyState } from "@/components/ui";
import { centsToCurrency } from "@/lib/utils/money";
import { apiFetch } from "@/lib/fetch";
import type { PayRunStatus } from "@/types";

interface PayslipRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  grossPayCents: number;
  netPayCents: number;
  status: PayRunStatus;
}

const statusVariant: Record<PayRunStatus, "neutral" | "info" | "warning" | "success"> = {
  draft: "neutral",
  calculated: "info",
  reviewed: "warning",
  approved: "success",
  paid: "success",
  filed: "info",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
  });
  const e = new Date(end).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${s} - ${e}`;
}

export default function MyPayslipsPage() {
  const router = useRouter();
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayslips = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/api/my/payslips");
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error ?? "Failed to load payslips");
      }
      setPayslips(json.data as PayslipRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payslips");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 text-sky-500" />
          <p className="text-sm text-slate-500">Loading payslips...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Payslips" subtitle="View your payslip history" />
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <p className="mb-2 text-sm text-rose-600">{error}</p>
            <Button onClick={fetchPayslips} variant="secondary">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Payslips" subtitle="View your payslip history" />

      {payslips.length === 0 ? (
        <EmptyState message="No payslips found. Your payslips will appear here after payroll has been processed." />
      ) : (
        <Table>
          <Table.Head>
            <tr>
              <Table.HeadCell>Period</Table.HeadCell>
              <Table.HeadCell>Pay Date</Table.HeadCell>
              <Table.HeadCell className="text-right">Gross Pay</Table.HeadCell>
              <Table.HeadCell className="text-right">Net Pay</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell className="text-right">Action</Table.HeadCell>
            </tr>
          </Table.Head>
          <Table.Body>
            {payslips.map((ps) => (
              <Table.Row key={ps.id}>
                <Table.Cell>{formatPeriod(ps.periodStart, ps.periodEnd)}</Table.Cell>
                <Table.Cell>{formatDate(ps.payDate)}</Table.Cell>
                <Table.Cell className="text-right font-medium">
                  {centsToCurrency(ps.grossPayCents)}
                </Table.Cell>
                <Table.Cell className="text-right font-medium">
                  {centsToCurrency(ps.netPayCents)}
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={statusVariant[ps.status]}>
                    {ps.status.charAt(0).toUpperCase() + ps.status.slice(1)}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/payroll/payslips/${ps.id}`)}
                  >
                    View
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}
