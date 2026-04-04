"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  Input,
  Select,
  Table,
  PageHeader,
  Modal,
  Spinner,
  EmptyState,
  Badge,
} from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { centsToDisplay } from "@/lib/utils/money";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlAccount {
  id: string;
  companyId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  payItemMapping: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface JournalEntry {
  id: string;
  companyId: string;
  payRunId: string;
  entryDate: string;
  accountCode: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
  description: string;
  department: string | null;
  createdAt: string;
}

interface PayRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
}

interface ToastState {
  message: string;
  type: "success" | "error";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const accountTypeOptions = [
  { value: "", label: "Select type..." },
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
];

const payItemMappingOptions = [
  { value: "", label: "Select mapping..." },
  { value: "basic_salary", label: "Basic Salary" },
  { value: "allowances", label: "Allowances" },
  { value: "cpf_employer", label: "CPF (Employer)" },
  { value: "cpf_employee", label: "CPF (Employee)" },
  { value: "sdl", label: "SDL" },
  { value: "shg", label: "SHG" },
  { value: "fwl", label: "FWL" },
  { value: "net_pay", label: "Net Pay / Cash-Bank" },
  { value: "cpf_payable", label: "CPF Payable" },
  { value: "other_deductions", label: "Other Deductions" },
];

const accountTypeBadge: Record<string, "info" | "warning" | "success" | "danger" | "neutral"> = {
  asset: "info",
  liability: "warning",
  equity: "neutral",
  revenue: "success",
  expense: "danger",
};

function payItemLabel(mapping: string): string {
  const opt = payItemMappingOptions.find((o) => o.value === mapping);
  return opt?.label ?? mapping;
}

// ---------------------------------------------------------------------------
// Toast Component
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function GeneralLedgerPage() {
  const [toast, setToast] = useState<ToastState | null>(null);

  // --- Chart of Accounts state ---
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GlAccount | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);

  // Account form fields
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("");
  const [formMapping, setFormMapping] = useState("");

  // --- Journal Entries state ---
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);
  const [selectedPayRunId, setSelectedPayRunId] = useState("");
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ---------------------------------------------------------------------------
  // Load accounts and pay runs on mount
  // ---------------------------------------------------------------------------

  const loadAccounts = useCallback(async () => {
    try {
      const res = await apiFetch("/api/gl/accounts");
      const json = await res.json();
      if (json.success) {
        setAccounts(json.data ?? []);
      } else {
        showToast(json.error ?? "Failed to load accounts", "error");
      }
    } catch {
      showToast("Failed to load GL accounts", "error");
    } finally {
      setAccountsLoading(false);
    }
  }, [showToast]);

  const loadPayRuns = useCallback(async () => {
    try {
      const res = await apiFetch("/api/payroll/pay-runs");
      const json = await res.json();
      if (json.success) {
        setPayRuns(json.data ?? []);
      }
    } catch {
      // Silently fail — pay runs are secondary
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadPayRuns();
  }, [loadAccounts, loadPayRuns]);

  // ---------------------------------------------------------------------------
  // Account CRUD
  // ---------------------------------------------------------------------------

  function openAddAccount() {
    setEditingAccount(null);
    setFormCode("");
    setFormName("");
    setFormType("");
    setFormMapping("");
    setShowAccountModal(true);
  }

  function openEditAccount(account: GlAccount) {
    setEditingAccount(account);
    setFormCode(account.accountCode);
    setFormName(account.accountName);
    setFormType(account.accountType);
    setFormMapping(account.payItemMapping);
    setShowAccountModal(true);
  }

  async function handleSaveAccount() {
    if (!formCode || !formName || !formType || !formMapping) {
      showToast("Please fill in all fields", "error");
      return;
    }

    setAccountSaving(true);
    try {
      if (editingAccount) {
        // Update
        const res = await apiFetch("/api/gl/accounts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingAccount.id,
            accountCode: formCode,
            accountName: formName,
            accountType: formType,
            payItemMapping: formMapping,
          }),
        });
        const json = await res.json();
        if (json.success) {
          showToast("Account updated", "success");
          setShowAccountModal(false);
          loadAccounts();
        } else {
          showToast(json.error ?? "Failed to update account", "error");
        }
      } else {
        // Create
        const res = await apiFetch("/api/gl/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountCode: formCode,
            accountName: formName,
            accountType: formType,
            payItemMapping: formMapping,
          }),
        });
        const json = await res.json();
        if (json.success) {
          showToast("Account created", "success");
          setShowAccountModal(false);
          loadAccounts();
        } else {
          showToast(json.error ?? "Failed to create account", "error");
        }
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleDeleteAccount(account: GlAccount) {
    if (!window.confirm(`Delete account ${account.accountCode} — ${account.accountName}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/gl/accounts?id=${account.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        showToast("Account deleted", "success");
        loadAccounts();
      } else {
        showToast(json.error ?? "Failed to delete account", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  }

  // ---------------------------------------------------------------------------
  // Journal Entries
  // ---------------------------------------------------------------------------

  async function loadJournalEntries(payRunId: string) {
    if (!payRunId) {
      setJournalEntries([]);
      return;
    }
    setJournalLoading(true);
    try {
      const res = await fetch(`/api/gl/journal/${payRunId}`);
      const json = await res.json();
      if (json.success) {
        setJournalEntries(json.data ?? []);
      } else {
        showToast(json.error ?? "Failed to load journal entries", "error");
      }
    } catch {
      showToast("Failed to load journal entries", "error");
    } finally {
      setJournalLoading(false);
    }
  }

  function handlePayRunSelect(payRunId: string) {
    setSelectedPayRunId(payRunId);
    loadJournalEntries(payRunId);
  }

  async function handleGenerateEntries() {
    if (!selectedPayRunId) {
      showToast("Please select a pay run first", "error");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/gl/journal/${selectedPayRunId}`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        showToast(`Generated ${json.data?.length ?? 0} journal entries`, "success");
        setJournalEntries(json.data ?? []);
      } else {
        showToast(json.error ?? "Failed to generate entries", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleExportCsv() {
    if (!selectedPayRunId) {
      showToast("Please select a pay run first", "error");
      return;
    }
    if (journalEntries.length === 0) {
      showToast("No journal entries to export. Generate entries first.", "error");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch(`/api/gl/export?payRunId=${selectedPayRunId}`);
      if (!res.ok) {
        const json = await res.json();
        showToast(json.error ?? "Export failed", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gl-journal-${selectedPayRunId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("CSV exported successfully", "success");
    } catch {
      showToast("Export failed", "error");
    } finally {
      setExporting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const payRunOptions = [
    { value: "", label: "Select a pay run..." },
    ...payRuns.map((r) => ({
      value: r.id,
      label: `${r.periodStart} to ${r.periodEnd} (${r.status})`,
    })),
  ];

  const totalDebits = journalEntries.reduce((sum, e) => sum + e.debitCents, 0);
  const totalCredits = journalEntries.reduce((sum, e) => sum + e.creditCents, 0);
  const isBalanced = totalDebits === totalCredits;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <PageHeader
        title="General Ledger"
        subtitle="Chart of accounts mapping and journal entry generation"
      />

      <div className="mt-8 space-y-8">
        {/* ----------------------------------------------------------------- */}
        {/* Section 1: Chart of Accounts                                      */}
        {/* ----------------------------------------------------------------- */}
        <Card title="Chart of Accounts">
          {accountsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8 text-sky-500" />
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              message="No GL accounts configured. Add accounts to map payroll items to your chart of accounts, or use defaults when generating journal entries."
              action={
                <Button onClick={openAddAccount} size="sm">
                  Add Account
                </Button>
              }
            />
          ) : (
            <>
              <div className="mb-4 flex justify-end">
                <Button onClick={openAddAccount} size="sm">
                  Add Account
                </Button>
              </div>
              <Table>
                <Table.Head>
                  <tr>
                    <Table.HeadCell>Code</Table.HeadCell>
                    <Table.HeadCell>Account Name</Table.HeadCell>
                    <Table.HeadCell>Type</Table.HeadCell>
                    <Table.HeadCell>Pay Item Mapping</Table.HeadCell>
                    <Table.HeadCell>Status</Table.HeadCell>
                    <Table.HeadCell className="text-right">Actions</Table.HeadCell>
                  </tr>
                </Table.Head>
                <Table.Body>
                  {accounts.map((account) => (
                    <Table.Row key={account.id}>
                      <Table.Cell>
                        <span className="font-mono text-sm font-semibold">
                          {account.accountCode}
                        </span>
                      </Table.Cell>
                      <Table.Cell>{account.accountName}</Table.Cell>
                      <Table.Cell>
                        <Badge variant={accountTypeBadge[account.accountType] ?? "neutral"}>
                          {account.accountType}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{payItemLabel(account.payItemMapping)}</Table.Cell>
                      <Table.Cell>
                        <Badge variant={account.isActive ? "success" : "neutral"}>
                          {account.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditAccount(account)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteAccount(account)}
                          >
                            Delete
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </>
          )}
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* Section 2: Journal Entries                                         */}
        {/* ----------------------------------------------------------------- */}
        <Card title="Journal Entries">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Select
                id="payRunSelect"
                label="Pay Run"
                options={payRunOptions}
                value={selectedPayRunId}
                onChange={(e) => handlePayRunSelect(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateEntries}
                loading={generating}
                disabled={!selectedPayRunId}
              >
                Generate Entries
              </Button>
              <Button
                variant="secondary"
                onClick={handleExportCsv}
                loading={exporting}
                disabled={!selectedPayRunId || journalEntries.length === 0}
              >
                Export CSV
              </Button>
            </div>
          </div>

          {journalLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8 text-sky-500" />
            </div>
          ) : !selectedPayRunId ? (
            <EmptyState message="Select a pay run above to view or generate journal entries." />
          ) : journalEntries.length === 0 ? (
            <EmptyState message="No journal entries for this pay run. Click 'Generate Entries' to create them." />
          ) : (
            <>
              {/* Balance indicator */}
              <div className="mb-4 flex items-center gap-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                  <span className="text-xs font-medium text-gray-500 uppercase">Total Debits</span>
                  <p className="text-lg font-semibold text-gray-900 tabular-nums">
                    S${centsToDisplay(totalDebits)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                  <span className="text-xs font-medium text-gray-500 uppercase">Total Credits</span>
                  <p className="text-lg font-semibold text-gray-900 tabular-nums">
                    S${centsToDisplay(totalCredits)}
                  </p>
                </div>
                <Badge variant={isBalanced ? "success" : "danger"}>
                  {isBalanced ? "Balanced" : "Unbalanced"}
                </Badge>
              </div>

              <Table>
                <Table.Head>
                  <tr>
                    <Table.HeadCell>Date</Table.HeadCell>
                    <Table.HeadCell>Code</Table.HeadCell>
                    <Table.HeadCell>Account Name</Table.HeadCell>
                    <Table.HeadCell>Description</Table.HeadCell>
                    <Table.HeadCell className="text-right">Debit (S$)</Table.HeadCell>
                    <Table.HeadCell className="text-right">Credit (S$)</Table.HeadCell>
                  </tr>
                </Table.Head>
                <Table.Body>
                  {journalEntries.map((entry) => (
                    <Table.Row key={entry.id}>
                      <Table.Cell>{entry.entryDate}</Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-sm">{entry.accountCode}</span>
                      </Table.Cell>
                      <Table.Cell>{entry.accountName}</Table.Cell>
                      <Table.Cell>
                        <span className="text-sm text-gray-500">{entry.description}</span>
                      </Table.Cell>
                      <Table.Cell className="text-right tabular-nums">
                        {entry.debitCents > 0 ? centsToDisplay(entry.debitCents) : ""}
                      </Table.Cell>
                      <Table.Cell className="text-right tabular-nums">
                        {entry.creditCents > 0 ? centsToDisplay(entry.creditCents) : ""}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  {/* Totals row */}
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <Table.Cell>{""}</Table.Cell>
                    <Table.Cell>{""}</Table.Cell>
                    <Table.Cell>{""}</Table.Cell>
                    <Table.Cell>
                      <span className="font-semibold text-gray-900">Total</span>
                    </Table.Cell>
                    <Table.Cell className="text-right font-semibold tabular-nums">
                      {centsToDisplay(totalDebits)}
                    </Table.Cell>
                    <Table.Cell className="text-right font-semibold tabular-nums">
                      {centsToDisplay(totalCredits)}
                    </Table.Cell>
                  </tr>
                </Table.Body>
              </Table>
            </>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Account Add/Edit Modal                                               */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        open={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        title={editingAccount ? "Edit GL Account" : "Add GL Account"}
      >
        <div className="space-y-4">
          <Input
            id="accountCode"
            label="Account Code"
            value={formCode}
            onChange={(e) => setFormCode(e.target.value)}
            placeholder="e.g., 5100"
            required
          />
          <Input
            id="accountName"
            label="Account Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., Salary Expense"
            required
          />
          <Select
            id="accountType"
            label="Account Type"
            options={accountTypeOptions}
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            required
          />
          <Select
            id="payItemMapping"
            label="Pay Item Mapping"
            options={payItemMappingOptions}
            value={formMapping}
            onChange={(e) => setFormMapping(e.target.value)}
            required
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowAccountModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveAccount} loading={accountSaving}>
            {editingAccount ? "Update" : "Create"}
          </Button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
