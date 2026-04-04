"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Input, Badge, Modal, PageHeader, Spinner } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import Link from "next/link";

const WEBHOOK_EVENTS: Record<string, string> = {
  "payroll.calculated": "Payroll Calculated",
  "payroll.approved": "Payroll Approved",
  "payroll.paid": "Payroll Paid",
  "employee.created": "Employee Created",
  "employee.updated": "Employee Updated",
  "employee.terminated": "Employee Terminated",
  "leave.requested": "Leave Requested",
  "leave.approved": "Leave Approved",
};

interface WebhookLog {
  id: string;
  event: string;
  responseStatus: number | null;
  success: boolean;
  attemptNumber: number;
  createdAt: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  description: string | null;
  lastTriggeredAt: string | null;
  failCount: number;
  createdAt: string;
  secret?: string;
  recentLogs?: WebhookLog[];
}

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

export default function WebhooksPage() {
  const [webhooksList, setWebhooksList] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createUrl, setCreateUrl] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createEvents, setCreateEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editWebhook, setEditWebhook] = useState<Webhook | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Detail/logs expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Testing
  const [testingId, setTestingId] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadWebhooks = useCallback(async () => {
    try {
      const res = await apiFetch("/api/webhooks");
      const json = await res.json();
      if (json.success) {
        setWebhooksList(json.data);
      }
    } catch {
      showToast("Failed to load webhooks", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  async function handleCreate() {
    if (!createUrl || createEvents.length === 0) {
      showToast("URL and at least one event are required", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch("/api/webhooks", {
        method: "POST",
        body: JSON.stringify({
          url: createUrl,
          events: createEvents,
          description: createDescription || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setNewSecret(json.data.secret);
        setCreateUrl("");
        setCreateDescription("");
        setCreateEvents([]);
        showToast("Webhook created successfully", "success");
        loadWebhooks();
      } else {
        showToast(json.error ?? "Failed to create webhook", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(wh: Webhook) {
    setEditWebhook(wh);
    setEditUrl(wh.url);
    setEditDescription(wh.description ?? "");
    setEditEvents(wh.events);
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editWebhook) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/webhooks/${editWebhook.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          url: editUrl,
          events: editEvents,
          description: editDescription || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Webhook updated", "success");
        setEditOpen(false);
        loadWebhooks();
      } else {
        showToast(json.error ?? "Failed to update", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(wh: Webhook) {
    try {
      const res = await apiFetch(`/api/webhooks/${wh.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !wh.active }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(wh.active ? "Webhook deactivated" : "Webhook activated", "success");
        loadWebhooks();
      } else {
        showToast(json.error ?? "Failed to toggle", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  }

  async function handleDelete(wh: Webhook) {
    if (!confirm("Deactivate this webhook? It will no longer receive events.")) return;
    try {
      const res = await apiFetch(`/api/webhooks/${wh.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        showToast("Webhook deleted", "success");
        loadWebhooks();
      } else {
        showToast(json.error ?? "Failed to delete", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  }

  async function handleTest(webhookId: string) {
    setTestingId(webhookId);
    try {
      const res = await apiFetch(`/api/webhooks/${webhookId}/test`, { method: "POST" });
      const json = await res.json();
      if (json.success && json.data.success) {
        showToast(`Test ping sent successfully (HTTP ${json.data.responseStatus})`, "success");
      } else {
        const status = json.data?.responseStatus ? ` (HTTP ${json.data.responseStatus})` : "";
        showToast(`Test ping failed${status}`, "error");
      }
      // Refresh logs if expanded
      if (expandedId === webhookId) {
        loadLogs(webhookId);
      }
    } catch {
      showToast("Failed to send test ping", "error");
    } finally {
      setTestingId(null);
    }
  }

  async function loadLogs(webhookId: string) {
    setLoadingLogs(true);
    try {
      const res = await apiFetch(`/api/webhooks/${webhookId}`);
      const json = await res.json();
      if (json.success) {
        setExpandedLogs(json.data.recentLogs ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingLogs(false);
    }
  }

  function toggleExpand(webhookId: string) {
    if (expandedId === webhookId) {
      setExpandedId(null);
      setExpandedLogs([]);
    } else {
      setExpandedId(webhookId);
      loadLogs(webhookId);
    }
  }

  function toggleEvent(event: string, eventsList: string[], setEvents: (e: string[]) => void) {
    if (eventsList.includes(event)) {
      setEvents(eventsList.filter((e) => e !== event));
    } else {
      setEvents([...eventsList, event]);
    }
  }

  function EventCheckboxes({
    selected,
    onChange,
  }: {
    selected: string[];
    onChange: (events: string[]) => void;
  }) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Object.entries(WEBHOOK_EVENTS).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={() => toggleEvent(key, selected, onChange)}
              className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-gray-700">{label}</span>
          </label>
        ))}
      </div>
    );
  }

  function getStatusBadge(wh: Webhook) {
    if (!wh.active) return <Badge variant="neutral">Inactive</Badge>;
    if (wh.failCount >= 5) return <Badge variant="danger">Failing ({wh.failCount})</Badge>;
    if (wh.failCount > 0) return <Badge variant="warning">Degraded ({wh.failCount})</Badge>;
    return <Badge variant="success">Active</Badge>;
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Webhooks" subtitle="Manage webhook integrations for external systems" />
        <div className="mt-16 flex items-center justify-center">
          <Spinner className="h-8 w-8 text-sky-500" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">
        <Link href="/settings" className="text-sm text-sky-600 hover:text-sky-700">
          &larr; Back to Settings
        </Link>
      </div>
      <PageHeader
        title="Webhooks"
        subtitle="Notify external systems when events happen in ClinicPay"
      />

      <div className="mt-6 mb-6">
        <Button onClick={() => setCreateOpen(true)}>Create Webhook</Button>
      </div>

      {webhooksList.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-sm text-gray-500">
            No webhooks configured yet. Create one to start receiving event notifications.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooksList.map((wh) => (
            <Card key={wh.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <code className="truncate text-sm font-medium text-gray-900">{wh.url}</code>
                    {getStatusBadge(wh)}
                  </div>
                  {wh.description && <p className="mt-1 text-sm text-gray-500">{wh.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(wh.events as string[]).map((evt) => (
                      <span
                        key={evt}
                        className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-500/20 ring-inset"
                      >
                        {evt}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-gray-400">
                    <span>Created: {new Date(wh.createdAt).toLocaleDateString()}</span>
                    {wh.lastTriggeredAt && (
                      <span>Last triggered: {new Date(wh.lastTriggeredAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTest(wh.id)}
                    loading={testingId === wh.id}
                  >
                    Test
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openEdit(wh)}>
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleToggleActive(wh)}>
                    {wh.active ? "Disable" : "Enable"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(wh.id)}>
                    {expandedId === wh.id ? "Hide Logs" : "Logs"}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(wh)}>
                    Delete
                  </Button>
                </div>
              </div>

              {/* Delivery logs expansion */}
              {expandedId === wh.id && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">Recent Deliveries</h4>
                  {loadingLogs ? (
                    <div className="flex justify-center py-4">
                      <Spinner className="h-5 w-5 text-sky-500" />
                    </div>
                  ) : expandedLogs.length === 0 ? (
                    <p className="text-sm text-gray-400">No deliveries yet</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                              Time
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                              Event
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                              Status
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                              Result
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {expandedLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-600">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                <code className="text-xs text-gray-700">{log.event}</code>
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {log.responseStatus ?? "--"}
                              </td>
                              <td className="px-3 py-2">
                                {log.success ? (
                                  <Badge variant="success">OK</Badge>
                                ) : (
                                  <Badge variant="danger">Failed</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create Webhook Modal */}
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setNewSecret(null);
        }}
        title="Create Webhook"
        size="lg"
      >
        {newSecret ? (
          <div>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-semibold text-amber-800">
                Save your webhook secret now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-xs break-all text-gray-800">
                  {newSecret}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(newSecret);
                    showToast("Secret copied to clipboard", "success");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setCreateOpen(false);
                  setNewSecret(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              id="webhook-url"
              label="Endpoint URL"
              value={createUrl}
              onChange={(e) => setCreateUrl(e.target.value)}
              placeholder="https://example.com/webhooks/clinicpay"
              required
            />
            <Input
              id="webhook-description"
              label="Description (optional)"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Xero accounting sync"
            />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Events <span className="text-red-500">*</span>
              </label>
              <EventCheckboxes selected={createEvents} onChange={setCreateEvents} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} loading={creating}>
                Create Webhook
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Webhook Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Webhook" size="lg">
        <div className="space-y-4">
          <Input
            id="edit-webhook-url"
            label="Endpoint URL"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            placeholder="https://example.com/webhooks/clinicpay"
            required
          />
          <Input
            id="edit-webhook-description"
            label="Description (optional)"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Xero accounting sync"
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Events</label>
            <EventCheckboxes selected={editEvents} onChange={setEditEvents} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
