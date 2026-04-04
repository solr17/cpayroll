"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Button, PageHeader, Spinner } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { trackEvent } from "@/lib/analytics";

interface BillingInfo {
  tier: string;
  tierLabel: string;
  employeeCount: number;
  employeeLimit: number; // -1 means unlimited
  pricePerEmployeeCents: number;
  nextBillingDate: string | null;
  hasSubscription: boolean;
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

const PLANS = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    priceDetail: "forever",
    employeeLimit: 5,
    features: [
      "Up to 5 employees",
      "Basic payroll processing",
      "CPF calculations",
      "Payslip generation",
      "Basic reports",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$5",
    priceDetail: "per employee / month",
    employeeLimit: 50,
    features: [
      "Up to 50 employees",
      "All payroll features",
      "CPF e-submission",
      "IR8A/IR21 reports",
      "Bank file generation",
      "General ledger",
      "Custom pay items",
      "Email payslips",
    ],
    popular: true,
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    price: "$8",
    priceDetail: "per employee / month",
    employeeLimit: -1,
    features: [
      "Unlimited employees",
      "All Pro features",
      "Priority support",
      "API access",
      "Multi-clinic management",
      "Advanced audit trails",
      "Custom integrations",
      "Dedicated account manager",
    ],
  },
];

/**
 * Stripe Price IDs — configure these in your Stripe Dashboard.
 * These should match the prices you create for each plan tier.
 * Set price metadata: plan_tier = "pro" | "enterprise"
 *
 * TODO: Move to env vars (NEXT_PUBLIC_STRIPE_PRICE_PRO, NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE)
 */
const STRIPE_PRICE_IDS: Record<string, string> = {
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
  enterprise: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE ?? "",
};

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <Spinner />
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      showToast("Subscription activated successfully!", "success");
    } else if (status === "cancelled") {
      showToast("Checkout was cancelled", "error");
    }
  }, [searchParams, showToast]);

  useEffect(() => {
    async function loadBilling() {
      try {
        const res = await apiFetch("/api/billing");
        const json = await res.json();
        if (json.success && json.data) {
          setBilling(json.data);
        } else {
          showToast(json.error ?? "Failed to load billing info", "error");
        }
      } catch {
        showToast("Failed to load billing info", "error");
      } finally {
        setLoading(false);
      }
    }
    loadBilling();
  }, [showToast]);

  async function handleUpgrade(tier: string) {
    const priceId = STRIPE_PRICE_IDS[tier];
    if (!priceId) {
      showToast("Stripe price not configured for this plan. Contact support.", "error");
      return;
    }

    setActionLoading(tier);
    trackEvent("upgrade_clicked", { plan: tier });
    try {
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId }),
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        window.location.href = json.data.url;
      } else {
        showToast(json.error ?? "Failed to create checkout session", "error");
      }
    } catch {
      showToast("Network error -- please try again", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleManageSubscription() {
    setActionLoading("portal");
    try {
      const res = await apiFetch("/api/billing/portal", {
        method: "POST",
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        window.location.href = json.data.url;
      } else {
        showToast(json.error ?? "Failed to open billing portal", "error");
      }
    } catch {
      showToast("Network error -- please try again", "error");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Billing" subtitle="Manage your subscription and billing" />
        <div className="mt-16 flex items-center justify-center">
          <Spinner className="h-8 w-8 text-sky-500" />
        </div>
      </div>
    );
  }

  const currentTier = billing?.tier ?? "free";
  const employeeCount = billing?.employeeCount ?? 0;
  const employeeLimit = billing?.employeeLimit ?? 5;
  const isUnlimited = employeeLimit === -1;
  const usagePercent = isUnlimited ? 0 : Math.min((employeeCount / employeeLimit) * 100, 100);

  return (
    <div>
      <PageHeader title="Billing" subtitle="Manage your subscription and billing" />

      <div className="mt-8 space-y-8">
        {/* Current Plan Summary */}
        <Card title="Current Plan">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Plan</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billing?.tierLabel ?? "Free"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Employees</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {employeeCount}
                <span className="text-base font-normal text-gray-500">
                  {" "}
                  / {isUnlimited ? "Unlimited" : employeeLimit}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Next Billing Date</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billing?.nextBillingDate
                  ? new Date(billing.nextBillingDate).toLocaleDateString("en-SG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* Usage Bar */}
          {!isUnlimited && (
            <div className="mt-6">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-600">Employee usage</span>
                <span className="font-medium text-gray-900">
                  {employeeCount} of {employeeLimit} employees
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    usagePercent >= 90
                      ? "bg-red-500"
                      : usagePercent >= 70
                        ? "bg-amber-500"
                        : "bg-sky-500"
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              {usagePercent >= 90 && (
                <p className="mt-2 text-sm text-red-600">
                  You are approaching your employee limit. Consider upgrading your plan.
                </p>
              )}
            </div>
          )}

          {/* Manage Subscription */}
          {billing?.hasSubscription && (
            <div className="mt-6">
              <Button
                onClick={handleManageSubscription}
                loading={actionLoading === "portal"}
                variant="secondary"
              >
                Manage Subscription
              </Button>
            </div>
          )}
        </Card>

        {/* Plan Cards */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Available Plans</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.tier === currentTier;
              const isDowngrade =
                (currentTier === "enterprise" && plan.tier !== "enterprise") ||
                (currentTier === "pro" && plan.tier === "free");

              return (
                <div
                  key={plan.tier}
                  className={`relative rounded-xl border-2 bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                    isCurrent
                      ? "border-sky-500 ring-2 ring-sky-100"
                      : plan.popular
                        ? "border-sky-200"
                        : "border-gray-200"
                  }`}
                >
                  {plan.popular && !isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-500 px-3 py-0.5 text-xs font-semibold text-white">
                      Most Popular
                    </span>
                  )}
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-white">
                      Current Plan
                    </span>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                      <span className="ml-1 text-sm text-gray-500">{plan.priceDetail}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {plan.employeeLimit === -1
                        ? "Unlimited employees"
                        : `Up to ${plan.employeeLimit} employees`}
                    </p>
                  </div>

                  <ul className="mb-6 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-500"
                    >
                      Current Plan
                    </button>
                  ) : plan.tier === "free" ? (
                    isDowngrade && billing?.hasSubscription ? (
                      <Button
                        onClick={handleManageSubscription}
                        loading={actionLoading === "portal"}
                        variant="secondary"
                        className="w-full"
                      >
                        Downgrade via Portal
                      </Button>
                    ) : null
                  ) : (
                    <Button
                      onClick={() => handleUpgrade(plan.tier)}
                      loading={actionLoading === plan.tier}
                      className="w-full"
                    >
                      {isDowngrade ? "Change Plan" : "Upgrade"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
