"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PageHeader,
  Card,
  Table,
  Badge,
  Button,
  Modal,
  Input,
  Select,
  Spinner,
  EmptyState,
} from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PayItem {
  id: string;
  code: string;
  name: string;
  type: "earning" | "deduction";
  category: "fixed" | "variable" | "statutory";
  cpfApplicable: boolean;
  cpfClassification: "OW" | "AW" | "none";
  sdlApplicable: boolean;
  taxable: boolean;
  isSystemDefault: boolean;
  isActive: boolean;
  glAccountCode: string | null;
  createdAt: string;
  updatedAt: string;
}

type FilterTab = "all" | "earning" | "deduction";

interface FormData {
  code: string;
  name: string;
  type: "earning" | "deduction";
  category: "fixed" | "variable" | "statutory";
  cpfApplicable: boolean;
  cpfClassification: "OW" | "AW" | "none";
  sdlApplicable: boolean;
  taxable: boolean;
  glAccountCode: string;
}

const EMPTY_FORM: FormData = {
  code: "",
  name: "",
  type: "earning",
  category: "fixed",
  cpfApplicable: true,
  cpfClassification: "OW",
  sdlApplicable: true,
  taxable: true,
  glAccountCode: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeBadgeVariant(type: string): "info" | "warning" {
  return type === "earning" ? "info" : "warning";
}

function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function boolIcon(val: boolean): string {
  return val ? "Yes" : "No";
}

// ---------------------------------------------------------------------------
// Pay Items Page
// ---------------------------------------------------------------------------

export default function PayItemsPage() {
  const [items, setItems] = useState<PayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PayItem | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/api/pay-items");
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error ?? "Failed to load pay items");
      }
      setItems(json.data as PayItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pay items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    return item.type === filter;
  });

  function openAddModal() {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(item: PayItem) {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      type: item.type,
      category: item.category,
      cpfApplicable: item.cpfApplicable,
      cpfClassification: item.cpfClassification,
      sdlApplicable: item.sdlApplicable,
      taxable: item.taxable,
      glAccountCode: item.glAccountCode ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        ...formData,
        glAccountCode: formData.glAccountCode || null,
      };

      let res: Response;
      if (editingItem) {
        res = await fetch(`/api/pay-items/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch("/api/pay-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error ?? "Operation failed");
      }

      closeModal();
      await fetchItems();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(item: PayItem) {
    if (item.isSystemDefault) return;
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${item.name}"? This will hide it from future pay runs.`,
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/pay-items/${item.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error ?? "Failed to deactivate");
      }
      await fetchItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  }

  async function handleReactivate(item: PayItem) {
    try {
      const res = await fetch(`/api/pay-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error ?? "Failed to reactivate");
      }
      await fetchItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reactivate");
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 text-sky-500" />
          <p className="text-sm text-slate-500">Loading pay items...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md text-center">
          <p className="mb-2 font-semibold text-slate-800">Failed to load pay items</p>
          <p className="mb-4 text-sm text-slate-500">{error}</p>
          <Button onClick={fetchItems} variant="secondary">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const isEditingSystemDefault = editingItem?.isSystemDefault ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pay Item Configuration"
        subtitle="Manage earnings, deductions, and their CPF/SDL/tax treatment"
        action="Add Pay Item"
        onAction={openAddModal}
      />

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(
          [
            { key: "all", label: "All" },
            { key: "earning", label: "Earnings" },
            { key: "deduction", label: "Deductions" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-slate-400">
              ({tab.key === "all" ? items.length : items.filter((i) => i.type === tab.key).length})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <EmptyState
          message="No pay items found. Add your first pay item to get started."
          action={
            <Button onClick={openAddModal} size="sm">
              Add Pay Item
            </Button>
          }
        />
      ) : (
        <Table>
          <Table.Head>
            <tr>
              <Table.HeadCell>Code</Table.HeadCell>
              <Table.HeadCell>Name</Table.HeadCell>
              <Table.HeadCell>Type</Table.HeadCell>
              <Table.HeadCell>Category</Table.HeadCell>
              <Table.HeadCell>CPF</Table.HeadCell>
              <Table.HeadCell>SDL</Table.HeadCell>
              <Table.HeadCell>Taxable</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell className="text-right">Actions</Table.HeadCell>
            </tr>
          </Table.Head>
          <Table.Body>
            {filteredItems.map((item) => (
              <Table.Row key={item.id} className={!item.isActive ? "opacity-50" : ""}>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    {item.isSystemDefault && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-label="System default"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    )}
                    <span className="font-mono text-xs">{item.code}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="font-medium text-slate-800">{item.name}</span>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={typeBadgeVariant(item.type)}>
                    {item.type === "earning" ? "Earning" : "Deduction"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{categoryLabel(item.category)}</Table.Cell>
                <Table.Cell>
                  {item.cpfApplicable ? (
                    <Badge variant="info">{item.cpfClassification}</Badge>
                  ) : (
                    <span className="text-slate-400">No</span>
                  )}
                </Table.Cell>
                <Table.Cell>{boolIcon(item.sdlApplicable)}</Table.Cell>
                <Table.Cell>{boolIcon(item.taxable)}</Table.Cell>
                <Table.Cell>
                  {item.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="neutral">Inactive</Badge>
                  )}
                </Table.Cell>
                <Table.Cell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}>
                      Edit
                    </Button>
                    {!item.isSystemDefault && item.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeactivate(item)}
                        className="text-rose-600 hover:text-rose-700"
                      >
                        Deactivate
                      </Button>
                    )}
                    {!item.isSystemDefault && !item.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReactivate(item)}
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingItem ? `Edit ${editingItem.name}` : "Add Pay Item"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{formError}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="code"
              label="Code"
              placeholder="e.g. TRANSPORT_ALLOW"
              value={formData.code}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
                }))
              }
              required
              disabled={isEditingSystemDefault}
            />
            <Input
              id="name"
              label="Name"
              placeholder="e.g. Transport Allowance"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              id="type"
              label="Type"
              value={formData.type}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  type: e.target.value as "earning" | "deduction",
                }))
              }
              options={[
                { value: "earning", label: "Earning" },
                { value: "deduction", label: "Deduction" },
              ]}
              disabled={isEditingSystemDefault}
            />
            <Select
              id="category"
              label="Category"
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  category: e.target.value as "fixed" | "variable" | "statutory",
                }))
              }
              options={[
                { value: "fixed", label: "Fixed" },
                { value: "variable", label: "Variable" },
                { value: "statutory", label: "Statutory" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              id="cpfClassification"
              label="CPF Classification"
              value={formData.cpfClassification}
              onChange={(e) => {
                const val = e.target.value as "OW" | "AW" | "none";
                setFormData((prev) => ({
                  ...prev,
                  cpfClassification: val,
                  cpfApplicable: val !== "none",
                }));
              }}
              options={[
                { value: "OW", label: "OW (Ordinary Wages)" },
                { value: "AW", label: "AW (Additional Wages)" },
                { value: "none", label: "None (Not CPF-applicable)" },
              ]}
            />
            <Input
              id="glAccountCode"
              label="GL Account Code"
              placeholder="Optional"
              value={formData.glAccountCode}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  glAccountCode: e.target.value,
                }))
              }
            />
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formData.sdlApplicable}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sdlApplicable: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              SDL Applicable
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formData.taxable}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    taxable: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              Taxable
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingItem ? "Save Changes" : "Create Pay Item"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
