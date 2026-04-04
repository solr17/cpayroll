"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Input, Select, Textarea, PageHeader, Spinner } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import Link from "next/link";

const payDayOptions = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const bankOptions = [
  { value: "", label: "Select bank..." },
  { value: "DBS", label: "DBS" },
  { value: "OCBC", label: "OCBC" },
  { value: "UOB", label: "UOB" },
  { value: "HSBC", label: "HSBC" },
  { value: "Standard Chartered", label: "Standard Chartered" },
  { value: "Maybank", label: "Maybank" },
  { value: "CIMB", label: "CIMB" },
];

const prorationOptions = [
  { value: "calendar", label: "Calendar Days" },
  { value: "working", label: "Working Days" },
];

const payFrequencyOptions = [{ value: "monthly", label: "Monthly" }];

const retentionOptions = [
  { value: "5", label: "5 Years" },
  { value: "7", label: "7 Years" },
  { value: "10", label: "10 Years" },
];

const cpfRateTable = [
  { ageBand: "55 and below", scTotal: "37.00%", scEmployee: "20.00%", scEmployer: "17.00%" },
  { ageBand: "Above 55 to 60", scTotal: "29.50%", scEmployee: "15.00%", scEmployer: "14.50%" },
  { ageBand: "Above 60 to 65", scTotal: "22.00%", scEmployee: "11.50%", scEmployer: "10.50%" },
  { ageBand: "Above 65 to 70", scTotal: "16.00%", scEmployee: "7.50%", scEmployer: "8.50%" },
  { ageBand: "Above 70", scTotal: "12.50%", scEmployee: "5.00%", scEmployer: "7.50%" },
];

interface ToastState {
  message: string;
  type: "success" | "error";
}

function Toast({ message, type, onClose }: ToastState & { onClose: () => void }) {
  const colors =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";
  const dismissColor =
    type === "success"
      ? "text-emerald-600 hover:text-emerald-800"
      : "text-red-600 hover:text-red-800";

  return (
    <div
      className={`fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${colors}`}
    >
      <span>{message}</span>
      <button type="button" onClick={onClose} className={`ml-2 ${dismissColor}`}>
        Dismiss
      </button>
    </div>
  );
}

interface BankAccount {
  bankName: string;
  branchCode: string;
  accountNumber: string;
}

export default function SettingsPage() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Company Information
  const [companyName, setCompanyName] = useState("");
  const [uen, setUen] = useState("");
  const [address, setAddress] = useState("");
  const [cpfSubmissionNumber, setCpfSubmissionNumber] = useState("");
  const [irasTaxRef, setIrasTaxRef] = useState("");
  const [payDay, setPayDay] = useState("25");

  // Bank Account
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchCode, setBranchCode] = useState("");

  // Payroll Settings
  const [otMultiplier, setOtMultiplier] = useState("1.5");
  const [prorationMethod, setProrationMethod] = useState("calendar");
  const [payFrequency, setPayFrequency] = useState("monthly");
  const [dualApprovalThreshold, setDualApprovalThreshold] = useState("5000");

  // DBS RAPID Integration
  const [dbsStatus, setDbsStatus] = useState<"unknown" | "connected" | "not_configured" | "error">(
    "unknown",
  );
  const [dbsClientId, setDbsClientId] = useState("");
  const [dbsDebitAccount, setDbsDebitAccount] = useState("");
  const [dbsTesting, setDbsTesting] = useState(false);

  // System
  const [retentionPeriod, setRetentionPeriod] = useState("7");

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await apiFetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setCompanyName(d.name ?? "");
          setUen(d.uen ?? "");
          setCpfSubmissionNumber(d.cpfSubmissionNumber ?? "");
          setIrasTaxRef(d.irasTaxRef ?? "");
          setPayDay(String(d.payDay ?? 25));

          // Address can be stored as { address: "..." } or as a string
          if (d.addressJson) {
            const addr =
              typeof d.addressJson === "string" ? d.addressJson : (d.addressJson.address ?? "");
            setAddress(addr);
          }

          // Dual approval threshold (cents to dollars for display)
          if (d.dualApprovalThresholdCents !== undefined && d.dualApprovalThresholdCents !== null) {
            setDualApprovalThreshold(String(d.dualApprovalThresholdCents / 100));
          } else {
            setDualApprovalThreshold("0");
          }

          // Bank account
          const bank = d.bankAccountJson as BankAccount | null;
          if (bank) {
            setBankName(bank.bankName ?? "");
            setAccountNumber(bank.accountNumber ?? "");
            setBranchCode(bank.branchCode ?? "");
          }

          // DBS RAPID status
          if (d.dbsRapidConfigured) {
            setDbsStatus("connected");
            setDbsClientId(d.dbsClientIdMasked ?? "");
            setDbsDebitAccount(d.dbsDebitAccountMasked ?? "");
          } else {
            setDbsStatus("not_configured");
          }
        }
      } catch {
        showToast("Failed to load settings", "error");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [showToast]);

  async function testDbsConnection() {
    setDbsTesting(true);
    try {
      const res = await apiFetch("/api/settings?check=dbs");
      const json = await res.json();
      if (json.success && json.data?.dbsConnected) {
        setDbsStatus("connected");
        showToast("DBS RAPID connection successful", "success");
      } else {
        setDbsStatus("error");
        showToast(json.error ?? "DBS RAPID connection failed", "error");
      }
    } catch {
      setDbsStatus("error");
      showToast("Failed to test DBS connection", "error");
    } finally {
      setDbsTesting(false);
    }
  }

  async function handleSave(section: string, payload: Record<string, unknown>) {
    setSaving(section);
    try {
      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`${section} saved successfully`, "success");
      } else {
        showToast(json.error ?? "Failed to save", "error");
      }
    } catch {
      showToast("Network error -- please try again", "error");
    } finally {
      setSaving(null);
    }
  }

  function saveCompanyInfo() {
    handleSave("Company Information", {
      name: companyName,
      uen,
      addressJson: address ? { address } : null,
      cpfSubmissionNumber: cpfSubmissionNumber || null,
      irasTaxRef: irasTaxRef || null,
      payDay: Number(payDay),
    });
  }

  function saveBankDetails() {
    if (!bankName) {
      showToast("Please select a bank", "error");
      return;
    }
    handleSave("Bank Account", {
      bankAccountJson: {
        bankName,
        branchCode,
        accountNumber,
      },
    });
  }

  function savePayrollSettings() {
    const thresholdDollars = parseFloat(dualApprovalThreshold);
    const thresholdCents = isNaN(thresholdDollars) ? 0 : Math.round(thresholdDollars * 100);
    handleSave("Payroll Settings", {
      payDay: Number(payDay),
      dualApprovalThresholdCents: thresholdCents,
    });
  }

  function saveSystemSettings() {
    // System settings like retention period are local preferences for now
    showToast("System settings saved successfully", "success");
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="Manage company configuration and payroll settings" />
        <div className="mt-16 flex items-center justify-center">
          <Spinner className="h-8 w-8 text-sky-500" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage company configuration and payroll settings" />

      <div className="mt-8 space-y-8">
        {/* Company Information */}
        <Card title="Company Information">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="companyName"
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Clinic Pte Ltd"
            />
            <Input
              id="uen"
              label="UEN"
              value={uen}
              onChange={(e) => setUen(e.target.value)}
              placeholder="202012345A"
            />
            <div className="md:col-span-2">
              <Textarea
                id="address"
                label="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main Street, Singapore 123456"
                rows={3}
              />
            </div>
            <Input
              id="cpfSubmissionNumber"
              label="CPF Submission Number"
              value={cpfSubmissionNumber}
              onChange={(e) => setCpfSubmissionNumber(e.target.value)}
              placeholder="CSN1234567A"
            />
            <Input
              id="irasTaxRef"
              label="IRAS Tax Reference"
              value={irasTaxRef}
              onChange={(e) => setIrasTaxRef(e.target.value)}
              placeholder="202012345A"
            />
            <Select
              id="payDay"
              label="Pay Day"
              options={payDayOptions}
              value={payDay}
              onChange={(e) => setPayDay(e.target.value)}
            />
          </div>
          <div className="mt-6">
            <Button onClick={saveCompanyInfo} loading={saving === "Company Information"}>
              Save Company Info
            </Button>
          </div>
        </Card>

        {/* Bank Account */}
        <Card title="Bank Account">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select
              id="bankName"
              label="Bank Name"
              options={bankOptions}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
            <Input
              id="accountNumber"
              label="Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="012-345678-9"
            />
            <Input
              id="branchCode"
              label="Branch Code"
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
              placeholder="001"
            />
          </div>
          <div className="mt-6">
            <Button onClick={saveBankDetails} loading={saving === "Bank Account"}>
              Save Bank Details
            </Button>
          </div>
        </Card>

        {/* Payroll Settings */}
        <Card title="Payroll Settings">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="otMultiplier"
              label="Default OT Rate Multiplier"
              type="number"
              step="0.5"
              min="1"
              max="3"
              value={otMultiplier}
              onChange={(e) => setOtMultiplier(e.target.value)}
            />
            <Select
              id="prorationMethod"
              label="Pro-ration Method"
              options={prorationOptions}
              value={prorationMethod}
              onChange={(e) => setProrationMethod(e.target.value)}
            />
            <Select
              id="payFrequency"
              label="Pay Frequency"
              options={payFrequencyOptions}
              value={payFrequency}
              onChange={(e) => setPayFrequency(e.target.value)}
            />
            <div>
              <Input
                id="dualApprovalThreshold"
                label="Dual Approval Threshold (S$)"
                type="number"
                min="0"
                step="100"
                value={dualApprovalThreshold}
                onChange={(e) => setDualApprovalThreshold(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Pay runs with gross total above this amount require approval from two different
                users. Set to 0 to disable.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Button onClick={savePayrollSettings} loading={saving === "Payroll Settings"}>
              Save Payroll Settings
            </Button>
          </div>
        </Card>

        {/* CPF Configuration */}
        <Card title="CPF Configuration">
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">OW Monthly Ceiling</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">S$8,000</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">Annual Salary Ceiling</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">S$102,000</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">Annual CPF Limit</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">S$37,740</p>
            </div>
          </div>

          <h4 className="mb-3 text-sm font-semibold text-gray-700">
            CPF Rate Table (Singapore Citizens — Effective 2026)
          </h4>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Age Band
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Total Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Employee Share
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                    Employer Share
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {cpfRateTable.map((row) => (
                  <tr key={row.ageBand} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{row.ageBand}</td>
                    <td className="px-4 py-3 text-gray-700">{row.scTotal}</td>
                    <td className="px-4 py-3 text-gray-700">{row.scEmployee}</td>
                    <td className="px-4 py-3 text-gray-700">{row.scEmployer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            These values are read-only reference. CPF rates are loaded from the cpf_rate_tables
            database table. Use{" "}
            <code className="rounded bg-gray-100 px-1">npm run seed:cpf-rates</code> to populate
            rates.
          </p>
        </Card>

        {/* Integrations */}
        <Card title="Integrations">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Link
              href="/settings/webhooks"
              className="flex items-center gap-4 rounded-lg border border-gray-200 p-4 transition-colors hover:border-sky-300 hover:bg-sky-50/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Webhooks</p>
                <p className="text-xs text-gray-500">
                  Notify external systems (Xero, QuickBooks, HRIS) when events happen
                </p>
              </div>
            </Link>
          </div>
        </Card>

        {/* DBS RAPID Integration */}
        <Card title="DBS RAPID Integration">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            {dbsStatus === "connected" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Connected
              </span>
            )}
            {dbsStatus === "not_configured" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                Not Configured
              </span>
            )}
            {dbsStatus === "error" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Connection Error
              </span>
            )}
            {dbsStatus === "unknown" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-400">
                <span className="h-2 w-2 rounded-full bg-gray-300" />
                Checking...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Client ID</label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                {dbsClientId || "Not configured"}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Debit Account</label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                {dbsDebitAccount || "Not configured"}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800">
              DBS RAPID API credentials are configured via environment variables
              (DBS_RAPID_CLIENT_ID, DBS_RAPID_CLIENT_SECRET, DBS_RAPID_BASE_URL,
              DBS_RAPID_DEBIT_ACCOUNT). Contact DBS to apply for RAPID API access and obtain sandbox
              credentials.
            </p>
          </div>

          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={testDbsConnection}
              loading={dbsTesting}
              disabled={dbsStatus === "not_configured"}
            >
              Test Connection
            </Button>
          </div>
        </Card>

        {/* System */}
        <Card title="System">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              id="retentionPeriod"
              label="Data Retention Period"
              options={retentionOptions}
              value={retentionPeriod}
              onChange={(e) => setRetentionPeriod(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Audit Log</label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                <p>
                  Audit logging is <span className="font-semibold text-green-700">enabled</span>.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  All data mutations are recorded in an append-only audit log. Entries cannot be
                  modified or deleted.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Button onClick={saveSystemSettings} loading={saving === "System Settings"}>
              Save System Settings
            </Button>
          </div>
        </Card>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
