"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/fetch";

// ─── Types ──────────────────────────────────────────────────────────────────

interface QrCodeEntry {
  payslipId: string;
  employeeId: string;
  employeeName: string;
  nricLast4: string;
  amountCents: number;
  amount: number;
  reference: string;
  qrString: string;
  qrSvg: string;
}

interface BatchResponse {
  payRunId: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  companyName: string;
  count: number;
  qrCodes: QrCodeEntry[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amountCents: number): string {
  const dollars = Math.floor(Math.abs(amountCents) / 100);
  const cents = Math.abs(amountCents) % 100;
  const sign = amountCents < 0 ? "-" : "";
  return `${sign}S$${dollars.toLocaleString("en-SG")}.${String(cents).padStart(2, "0")}`;
}

function maskNric(last4: string): string {
  return `\u2022\u2022\u2022\u2022\u2022${last4}`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PayRunPayNowPage() {
  const params = useParams();
  const [data, setData] = useState<BatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadQrCodes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/payroll/pay-runs/${params.id}/paynow-batch`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data as BatchResponse);
      } else {
        setError(json.error ?? "Failed to generate PayNow QR codes");
      }
    } catch {
      setError("Failed to generate PayNow QR codes");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadQrCodes();
  }, [loadQrCodes]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
        <span className="ml-3 text-gray-500">Generating PayNow QR codes...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8">
        <Link href={`/payroll/${params.id}`} className="text-sm text-blue-600 hover:underline">
          &larr; Back to Pay Run
        </Link>
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <Link href={`/payroll/${params.id}`} className="text-sm text-blue-600 hover:underline">
          &larr; Back to Pay Run
        </Link>
        <div className="mt-4 text-gray-500">No data available</div>
      </div>
    );
  }

  const totalCents = data.qrCodes.reduce((sum, qr) => sum + qr.amountCents, 0);

  return (
    <>
      {/* Print-friendly styles */}
      <style jsx global>{`
        @media print {
          aside,
          nav,
          .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
          .flex.min-h-screen {
            display: block !important;
          }
          body {
            font-size: 11pt;
            color: #000;
            background: #fff;
          }
          .print-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
          }
          .qr-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 16px !important;
          }
          .qr-card {
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="print-container mx-auto max-w-6xl">
        {/* Navigation & actions */}
        <div className="no-print mb-6 flex items-center justify-between">
          <Link href={`/payroll/${params.id}`} className="text-sm text-blue-600 hover:underline">
            &larr; Back to Pay Run
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Print All QR Codes
            </button>
            <button
              onClick={loadQrCodes}
              disabled={loading}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
            >
              Regenerate
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">PayNow QR Codes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data.companyName} &mdash; Pay Period: {formatDate(data.periodStart)} to{" "}
            {formatDate(data.periodEnd)}
          </p>
          <p className="text-sm text-gray-500">Payment Date: {formatDate(data.payDate)}</p>
          <div className="mt-3 flex gap-6">
            <div>
              <span className="text-sm text-gray-500">Employees</span>
              <p className="text-lg font-semibold text-gray-900">{data.count}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Total Net Pay</span>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalCents)}</p>
            </div>
          </div>
        </div>

        {/* QR Code Grid */}
        <div className="qr-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.qrCodes.map((qr) => (
            <div
              key={qr.payslipId}
              className="qr-card flex flex-col items-center rounded-xl bg-white p-5 shadow-sm"
            >
              {/* Employee info */}
              <div className="mb-3 w-full text-center">
                <h3 className="text-sm font-semibold text-gray-900">{qr.employeeName}</h3>
                <p className="text-xs text-gray-400">{maskNric(qr.nricLast4)}</p>
              </div>

              {/* QR Code */}
              <div
                className="rounded-lg border border-gray-100 bg-white p-2"
                dangerouslySetInnerHTML={{ __html: qr.qrSvg }}
              />

              {/* Amount & Reference */}
              <div className="mt-3 text-center">
                <p className="text-lg font-bold text-green-700">{formatCurrency(qr.amountCents)}</p>
                <p className="text-xs text-gray-400">Ref: {qr.reference}</p>
              </div>

              {/* Link to payslip */}
              <Link
                href={`/payroll/payslips/${qr.payslipId}`}
                className="no-print mt-2 text-xs text-blue-600 hover:underline"
              >
                View Payslip
              </Link>
            </div>
          ))}
        </div>

        {/* Print footer */}
        <div className="mt-8 mb-4 text-center text-xs text-gray-400">
          <p>
            Generated by ClinicPay &mdash; Scan with any Singapore banking app that supports PayNow
          </p>
        </div>
      </div>
    </>
  );
}
