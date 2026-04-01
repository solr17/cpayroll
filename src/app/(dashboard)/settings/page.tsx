"use client";

import { useState } from "react";
import { Card, Button, Input, Select, Textarea, PageHeader } from "@/components/ui";

const payDayOptions = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const bankOptions = [
  { value: "", label: "Select bank..." },
  { value: "DBS", label: "DBS" },
  { value: "OCBC", label: "OCBC" },
  { value: "UOB", label: "UOB" },
  { value: "Others", label: "Others" },
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

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-lg">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="ml-2 text-amber-600 hover:text-amber-800">
        Dismiss
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [toast, setToast] = useState<string | null>(null);

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

  // System
  const [retentionPeriod, setRetentionPeriod] = useState("7");

  function handleSave(section: string) {
    setToast(`${section}: Coming soon -- settings API not yet implemented.`);
    setTimeout(() => setToast(null), 5000);
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
            <Button onClick={() => handleSave("Company Information")}>Save Company Info</Button>
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
            <Button onClick={() => handleSave("Bank Account")}>Save Bank Details</Button>
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
            <Input
              id="dualApprovalThreshold"
              label="Dual Approval Threshold (S$)"
              type="number"
              min="0"
              step="100"
              value={dualApprovalThreshold}
              onChange={(e) => setDualApprovalThreshold(e.target.value)}
            />
          </div>
          <div className="mt-6">
            <Button onClick={() => handleSave("Payroll Settings")}>Save Payroll Settings</Button>
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
            <Button onClick={() => handleSave("System Settings")}>Save System Settings</Button>
          </div>
        </Card>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
