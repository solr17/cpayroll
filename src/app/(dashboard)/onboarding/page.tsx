"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

const STEPS = ["Company Information", "Bank Account", "Payroll Settings", "Confirmation"];

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

const payDayOptions = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const prorationOptions = [
  { value: "calendar", label: "Calendar Days" },
  { value: "working", label: "Working Days" },
];

interface FormData {
  // Step 1
  companyName: string;
  uen: string;
  address: string;
  cpfSubmissionNumber: string;
  irasTaxRef: string;
  // Step 2
  bankName: string;
  accountNumber: string;
  branchCode: string;
  // Step 3
  payDay: string;
  prorationMethod: string;
  payFrequency: string;
  otMultiplier: string;
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-center">
        {STEPS.map((label, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;

          return (
            <div key={label} className="flex items-center">
              {/* Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
                      : isCompleted
                        ? "bg-sky-500 text-white"
                        : "border-2 border-gray-300 bg-white text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isActive ? "text-sky-600" : isCompleted ? "text-sky-600" : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {/* Line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`mx-2 mb-6 h-0.5 w-12 sm:w-20 ${
                    stepNum < currentStep ? "bg-sky-500" : "bg-gray-300"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [form, setForm] = useState<FormData>({
    companyName: "",
    uen: "",
    address: "",
    cpfSubmissionNumber: "",
    irasTaxRef: "",
    bankName: "",
    accountNumber: "",
    branchCode: "",
    payDay: "25",
    prorationMethod: "calendar",
    payFrequency: "monthly",
    otMultiplier: "1.5",
  });

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user types
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function validateStep(stepNum: number): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (stepNum === 1) {
      if (!form.companyName.trim()) newErrors.companyName = "Company name is required";
      if (!form.uen.trim()) newErrors.uen = "UEN is required";
    } else if (stepNum === 2) {
      if (!form.bankName) newErrors.bankName = "Please select a bank";
      if (!form.accountNumber.trim()) newErrors.accountNumber = "Account number is required";
      if (!form.branchCode.trim()) newErrors.branchCode = "Branch code is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, 4));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/settings/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.companyName,
          uen: form.uen,
          address: form.address || undefined,
          cpfSubmissionNumber: form.cpfSubmissionNumber || undefined,
          irasTaxRef: form.irasTaxRef || undefined,
          bankAccount: {
            bankName: form.bankName,
            branchCode: form.branchCode,
            accountNumber: form.accountNumber,
          },
          payDay: Number(form.payDay),
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast("Setup complete! Redirecting...", "success");
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        showToast(json.error ?? "Failed to save. Please try again.", "error");
        setSubmitting(false);
      }
    } catch {
      showToast("Network error. Please try again.", "error");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Welcome to ClinicPay</h1>
        <p className="mt-2 text-sm text-gray-500">
          Let&apos;s set up your company in a few quick steps.
        </p>
      </div>

      <StepIndicator currentStep={step} />

      {/* Step 1: Company Information */}
      {step === 1 && (
        <Card title="Company Information">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="companyName"
              label="Company Name"
              required
              value={form.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
              placeholder="Clinic Pte Ltd"
              error={errors.companyName}
            />
            <Input
              id="uen"
              label="UEN"
              required
              value={form.uen}
              onChange={(e) => updateField("uen", e.target.value)}
              placeholder="202012345A"
              error={errors.uen}
            />
            <div className="md:col-span-2">
              <Textarea
                id="address"
                label="Address"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="123 Main Street, Singapore 123456"
                rows={3}
              />
            </div>
            <Input
              id="cpfSubmissionNumber"
              label="CPF Submission Number"
              value={form.cpfSubmissionNumber}
              onChange={(e) => updateField("cpfSubmissionNumber", e.target.value)}
              placeholder="CSN1234567A"
            />
            <Input
              id="irasTaxRef"
              label="IRAS Tax Reference"
              value={form.irasTaxRef}
              onChange={(e) => updateField("irasTaxRef", e.target.value)}
              placeholder="202012345A"
            />
          </div>
        </Card>
      )}

      {/* Step 2: Bank Account */}
      {step === 2 && (
        <Card title="Bank Account">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              id="bankName"
              label="Bank Name"
              required
              options={bankOptions}
              value={form.bankName}
              onChange={(e) => updateField("bankName", e.target.value)}
              error={errors.bankName}
            />
            <Input
              id="accountNumber"
              label="Account Number"
              required
              value={form.accountNumber}
              onChange={(e) => updateField("accountNumber", e.target.value)}
              placeholder="012-345678-9"
              error={errors.accountNumber}
            />
            <Input
              id="branchCode"
              label="Branch Code"
              required
              value={form.branchCode}
              onChange={(e) => updateField("branchCode", e.target.value)}
              placeholder="001"
              error={errors.branchCode}
            />
          </div>
        </Card>
      )}

      {/* Step 3: Payroll Settings */}
      {step === 3 && (
        <Card title="Payroll Settings">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              id="payDay"
              label="Pay Day"
              options={payDayOptions}
              value={form.payDay}
              onChange={(e) => updateField("payDay", e.target.value)}
            />
            <Select
              id="prorationMethod"
              label="Pro-ration Method"
              options={prorationOptions}
              value={form.prorationMethod}
              onChange={(e) => updateField("prorationMethod", e.target.value)}
            />
            <Select
              id="payFrequency"
              label="Pay Frequency"
              options={[{ value: "monthly", label: "Monthly" }]}
              value={form.payFrequency}
              onChange={(e) => updateField("payFrequency", e.target.value)}
            />
            <Input
              id="otMultiplier"
              label="Default OT Multiplier"
              type="number"
              step="0.5"
              min="1"
              max="3"
              value={form.otMultiplier}
              onChange={(e) => updateField("otMultiplier", e.target.value)}
            />
          </div>
        </Card>
      )}

      {/* Step 4: Confirmation */}
      {step === 4 && (
        <Card title="Review Your Setup">
          <div className="space-y-6">
            {/* Company Info Summary */}
            <div>
              <h4 className="mb-2 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                Company Information
              </h4>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-gray-500">Company Name</dt>
                    <dd className="mt-0.5 text-gray-900">{form.companyName}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">UEN</dt>
                    <dd className="mt-0.5 text-gray-900">{form.uen}</dd>
                  </div>
                  {form.address && (
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-gray-500">Address</dt>
                      <dd className="mt-0.5 text-gray-900">{form.address}</dd>
                    </div>
                  )}
                  {form.cpfSubmissionNumber && (
                    <div>
                      <dt className="font-medium text-gray-500">CPF Submission Number</dt>
                      <dd className="mt-0.5 text-gray-900">{form.cpfSubmissionNumber}</dd>
                    </div>
                  )}
                  {form.irasTaxRef && (
                    <div>
                      <dt className="font-medium text-gray-500">IRAS Tax Reference</dt>
                      <dd className="mt-0.5 text-gray-900">{form.irasTaxRef}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Bank Account Summary */}
            <div>
              <h4 className="mb-2 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                Bank Account
              </h4>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="font-medium text-gray-500">Bank Name</dt>
                    <dd className="mt-0.5 text-gray-900">{form.bankName}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Account Number</dt>
                    <dd className="mt-0.5 text-gray-900">{form.accountNumber}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Branch Code</dt>
                    <dd className="mt-0.5 text-gray-900">{form.branchCode}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Payroll Settings Summary */}
            <div>
              <h4 className="mb-2 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                Payroll Settings
              </h4>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-gray-500">Pay Day</dt>
                    <dd className="mt-0.5 text-gray-900">{form.payDay}th of each month</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Pro-ration Method</dt>
                    <dd className="mt-0.5 text-gray-900">
                      {form.prorationMethod === "calendar" ? "Calendar Days" : "Working Days"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Pay Frequency</dt>
                    <dd className="mt-0.5 text-gray-900">Monthly</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">OT Multiplier</dt>
                    <dd className="mt-0.5 text-gray-900">{form.otMultiplier}x</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {step > 1 && (
            <Button variant="secondary" onClick={handleBack} disabled={submitting}>
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            Step {step} of {STEPS.length}
          </span>
          {step < 4 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleComplete} loading={submitting}>
              Complete Setup
            </Button>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
