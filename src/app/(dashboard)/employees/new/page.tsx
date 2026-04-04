"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Card, Button, Input, Select, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { trackEvent } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, label: "Entity Details" },
  { id: 2, label: "Personal Details" },
  { id: 3, label: "Job Details" },
  { id: 4, label: "Bank Details" },
  { id: 5, label: "Statutory Details" },
  { id: 6, label: "Salary Details" },
] as const;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const citizenshipOptions = [
  { value: "", label: "Select..." },
  { value: "SC", label: "Singapore Citizen (SC)" },
  { value: "PR1", label: "PR Year 1 (PR1)" },
  { value: "PR2", label: "PR Year 2 (PR2)" },
  { value: "PR3", label: "PR Year 3+ (PR3)" },
  { value: "FW", label: "Foreign Worker (FW)" },
];

const genderOptions = [
  { value: "", label: "Select..." },
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];

const nationalityOptions = [
  { value: "", label: "Select..." },
  { value: "Singaporean", label: "Singaporean" },
  { value: "Malaysian", label: "Malaysian" },
  { value: "Filipino", label: "Filipino" },
  { value: "Indian", label: "Indian" },
  { value: "Chinese", label: "Chinese" },
  { value: "Indonesian", label: "Indonesian" },
  { value: "Myanmar", label: "Myanmar" },
  { value: "Other", label: "Other" },
];

const raceOptions = [
  { value: "", label: "Select..." },
  { value: "Chinese", label: "Chinese" },
  { value: "Malay", label: "Malay" },
  { value: "Indian", label: "Indian" },
  { value: "Eurasian", label: "Eurasian" },
  { value: "Other", label: "Other" },
];

const religionOptions = [
  { value: "", label: "Select..." },
  { value: "Buddhism", label: "Buddhism" },
  { value: "Christianity", label: "Christianity" },
  { value: "Islam", label: "Islam" },
  { value: "Hinduism", label: "Hinduism" },
  { value: "Taoism", label: "Taoism" },
  { value: "Sikhism", label: "Sikhism" },
  { value: "No Religion", label: "No Religion" },
  { value: "Other", label: "Other" },
];

const employmentTypeOptions = [
  { value: "FT", label: "Full-Time" },
  { value: "PT", label: "Part-Time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "LOCUM", label: "Locum" },
];

const workScheduleOptions = [
  { value: "", label: "Select..." },
  { value: "5-day", label: "5-day week (Mon-Fri)" },
  { value: "5.5-day", label: "5.5-day week (Mon-Sat AM)" },
  { value: "6-day", label: "6-day week (Mon-Sat)" },
  { value: "shift", label: "Shift-based" },
];

const noticePeriodOptions = [
  { value: "", label: "Select..." },
  { value: "1_week", label: "1 Week" },
  { value: "2_weeks", label: "2 Weeks" },
  { value: "1_month", label: "1 Month" },
  { value: "2_months", label: "2 Months" },
  { value: "3_months", label: "3 Months" },
];

const bankNameOptions = [
  { value: "", label: "Select bank..." },
  { value: "DBS", label: "DBS / POSB" },
  { value: "OCBC", label: "OCBC" },
  { value: "UOB", label: "UOB" },
  { value: "SCB", label: "Standard Chartered" },
  { value: "CITI", label: "Citibank" },
  { value: "HSBC", label: "HSBC" },
  { value: "MBB", label: "Maybank" },
  { value: "Others", label: "Others" },
];

const accountTypeOptions = [
  { value: "", label: "Select..." },
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
];

const paymentModeOptions = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
];

const shgFundOptions = [
  { value: "", label: "Auto (based on race)" },
  { value: "CDAC", label: "CDAC (Chinese)" },
  { value: "MBMF", label: "MBMF (Malay/Muslim)" },
  { value: "SINDA", label: "SINDA (Indian)" },
  { value: "ECF", label: "ECF (Eurasian)" },
];

const taxBorneByOptions = [
  { value: "employee", label: "Employee" },
  { value: "employer", label: "Employer" },
];

// ---------------------------------------------------------------------------
// Validation schemas per step
// ---------------------------------------------------------------------------

const step1Schema = z.object({
  employeeCode: z.string().optional(),
});

const step2Schema = z.object({
  fullName: z.string().min(1, "Full name is required").max(200),
  nric: z.string().regex(/^[STFGM]\d{7}[A-Z]$/i, "Invalid NRIC/FIN format"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth is required"),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  citizenshipStatus: z.enum(["SC", "PR1", "PR2", "PR3", "FW"], {
    errorMap: () => ({ message: "Citizenship status is required" }),
  }),
  prEffectiveDate: z.string().optional(),
  race: z.string().optional(),
  religion: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  mobile: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

const step3Schema = z.object({
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Hire date is required"),
  employmentType: z.enum(["FT", "PT", "CONTRACT", "LOCUM"]),
  position: z.string().optional(),
  department: z.string().optional(),
  workSchedule: z.string().optional(),
  probationEnd: z.string().optional(),
  contractEndDate: z.string().optional(),
  noticePeriod: z.string().optional(),
});

const step4Schema = z.object({
  bankName: z.string().optional(),
  branchCode: z.string().optional(),
  accountNumber: z.string().optional(),
  accountType: z.string().optional(),
  paymentMode: z.string().optional(),
});

const step5Schema = z.object({
  cpfApplicable: z.boolean(),
  sdlApplicable: z.boolean(),
  shgFund: z.string().optional(),
  shgOptOut: z.boolean(),
  fwlApplicable: z.boolean(),
  taxBorneBy: z.string().optional(),
  cpfAccountNumber: z.string().optional(),
  taxRefNumber: z.string().optional(),
  workPassType: z.string().optional(),
  workPassExpiry: z.string().optional(),
});

const step6Schema = z.object({
  basicSalaryCents: z.number().min(0, "Basic salary is required"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date is required"),
  otEligible: z.boolean(),
  otRate: z.number().optional(),
});

type FormErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  currentStep,
  completedSteps,
}: {
  currentStep: number;
  completedSteps: Set<number>;
}) {
  return (
    <nav className="mb-8">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isCompleted = completedSteps.has(step.id);
          return (
            <li key={step.id} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md"
                      : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "border-2 border-slate-300 text-slate-400"
                  }`}
                >
                  {isCompleted && !isActive ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`hidden text-[10px] font-medium lg:block ${
                    isActive ? "text-sky-600" : isCompleted ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`hidden h-0.5 w-8 lg:block xl:w-12 ${
                    isCompleted ? "bg-emerald-400" : "bg-slate-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Recurring Allowance Row
// ---------------------------------------------------------------------------

interface RecurringAllowance {
  name: string;
  amountDollars: string;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function NewEmployeePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  // Step 1: Entity Details
  const [employeeCode, setEmployeeCode] = useState("");
  const [autoEmployeeCode, setAutoEmployeeCode] = useState(true);

  // Step 2: Personal Details
  const [fullName, setFullName] = useState("");
  const [nric, setNric] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [citizenshipStatus, setCitizenshipStatus] = useState("");
  const [prEffectiveDate, setPrEffectiveDate] = useState("");
  const [race, setRace] = useState("");
  const [religion, setReligion] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  // Step 3: Job Details
  const [hireDate, setHireDate] = useState("");
  const [employmentType, setEmploymentType] = useState("FT");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [workSchedule, setWorkSchedule] = useState("");
  const [probationEnd, setProbationEnd] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");

  // Step 4: Bank Details
  const [bankName, setBankName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("");
  const [paymentMode, setPaymentMode] = useState("bank_transfer");

  // Step 5: Statutory Details
  const [cpfApplicable, setCpfApplicable] = useState(true);
  const [sdlApplicable, setSdlApplicable] = useState(true);
  const [shgFund, setShgFund] = useState("");
  const [shgOptOut, setShgOptOut] = useState(false);
  const [fwlApplicable, setFwlApplicable] = useState(false);
  const [taxBorneBy, setTaxBorneBy] = useState("employee");
  const [cpfAccountNumber, setCpfAccountNumber] = useState("");
  const [taxRefNumber, setTaxRefNumber] = useState("");
  const [workPassType, setWorkPassType] = useState("");
  const [workPassExpiry, setWorkPassExpiry] = useState("");

  // Step 6: Salary Details
  const [basicSalaryDollars, setBasicSalaryDollars] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [recurringAllowances, setRecurringAllowances] = useState<RecurringAllowance[]>([]);
  const [otEligible, setOtEligible] = useState(false);
  const [otRate, setOtRate] = useState("1.5");

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const validateStep = useCallback(
    (step: number): boolean => {
      setErrors({});
      let result: z.SafeParseReturnType<unknown, unknown>;

      switch (step) {
        case 1:
          result = step1Schema.safeParse({
            employeeCode: autoEmployeeCode ? undefined : employeeCode,
          });
          break;
        case 2:
          result = step2Schema.safeParse({
            fullName,
            nric,
            dob,
            gender: gender || undefined,
            nationality: nationality || undefined,
            citizenshipStatus: citizenshipStatus || undefined,
            prEffectiveDate: prEffectiveDate || undefined,
            race: race || undefined,
            religion: religion || undefined,
            address: address || undefined,
            email: email || undefined,
            mobile: mobile || undefined,
            emergencyContactName: emergencyContactName || undefined,
            emergencyContactPhone: emergencyContactPhone || undefined,
          });
          break;
        case 3:
          result = step3Schema.safeParse({
            hireDate,
            employmentType,
            position: position || undefined,
            department: department || undefined,
            workSchedule: workSchedule || undefined,
            probationEnd: probationEnd || undefined,
            contractEndDate: contractEndDate || undefined,
            noticePeriod: noticePeriod || undefined,
          });
          break;
        case 4:
          result = step4Schema.safeParse({
            bankName: bankName || undefined,
            branchCode: branchCode || undefined,
            accountNumber: accountNumber || undefined,
            accountType: accountType || undefined,
            paymentMode: paymentMode || undefined,
          });
          break;
        case 5:
          result = step5Schema.safeParse({
            cpfApplicable,
            sdlApplicable,
            shgFund: shgFund || undefined,
            shgOptOut,
            fwlApplicable,
            taxBorneBy: taxBorneBy || undefined,
            cpfAccountNumber: cpfAccountNumber || undefined,
            taxRefNumber: taxRefNumber || undefined,
            workPassType: workPassType || undefined,
            workPassExpiry: workPassExpiry || undefined,
          });
          break;
        case 6: {
          const cents = Math.round(parseFloat(basicSalaryDollars || "0") * 100);
          result = step6Schema.safeParse({
            basicSalaryCents: cents,
            effectiveDate: effectiveDate || hireDate,
            otEligible,
            otRate: otEligible ? parseFloat(otRate || "1.5") : undefined,
          });
          break;
        }
        default:
          return true;
      }

      if (!result.success) {
        const fieldErrors: FormErrors = {};
        for (const issue of result.error.issues) {
          const path = issue.path.join(".");
          if (!fieldErrors[path]) {
            fieldErrors[path] = issue.message;
          }
        }
        setErrors(fieldErrors);
        return false;
      }
      return true;
    },
    [
      autoEmployeeCode,
      employeeCode,
      fullName,
      nric,
      dob,
      gender,
      nationality,
      citizenshipStatus,
      prEffectiveDate,
      race,
      religion,
      address,
      email,
      mobile,
      emergencyContactName,
      emergencyContactPhone,
      hireDate,
      employmentType,
      position,
      department,
      workSchedule,
      probationEnd,
      contractEndDate,
      noticePeriod,
      bankName,
      branchCode,
      accountNumber,
      accountType,
      paymentMode,
      cpfApplicable,
      sdlApplicable,
      shgFund,
      shgOptOut,
      fwlApplicable,
      taxBorneBy,
      cpfAccountNumber,
      taxRefNumber,
      workPassType,
      workPassExpiry,
      basicSalaryDollars,
      effectiveDate,
      otEligible,
      otRate,
    ],
  );

  function handleNext() {
    if (validateStep(currentStep)) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep((prev) => Math.min(prev + 1, 6));
    }
  }

  function handleBack() {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }

  // ---------------------------------------------------------------------------
  // Build payload
  // ---------------------------------------------------------------------------

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      fullName,
      nric,
      dob,
      citizenshipStatus,
      hireDate,
      employmentType,
    };

    if (!autoEmployeeCode && employeeCode) payload.employeeCode = employeeCode;
    if (gender) payload.gender = gender;
    if (nationality) payload.nationality = nationality;
    if (prEffectiveDate) payload.prEffectiveDate = prEffectiveDate;
    if (race) payload.race = race;
    if (religion) payload.religion = religion;
    if (mobile) payload.mobile = mobile;
    if (email) payload.email = email;
    if (address) payload.address = address;
    if (emergencyContactName) payload.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone) payload.emergencyContactPhone = emergencyContactPhone;
    if (position) payload.position = position;
    if (department) payload.department = department;
    if (workSchedule) payload.workSchedule = workSchedule;
    if (probationEnd) payload.probationEnd = probationEnd;
    if (contractEndDate) payload.contractEndDate = contractEndDate;
    if (noticePeriod) payload.noticePeriod = noticePeriod;
    if (cpfAccountNumber) payload.cpfAccountNumber = cpfAccountNumber;
    if (taxRefNumber) payload.taxRefNumber = taxRefNumber;
    if (workPassType) payload.workPassType = workPassType;
    if (workPassExpiry) payload.workPassExpiry = workPassExpiry;

    if (bankName || branchCode || accountNumber) {
      payload.bankDetails = {
        bankName,
        branchCode,
        accountNumber,
        ...(accountType ? { accountType } : {}),
      };
    }
    if (paymentMode) payload.paymentMode = paymentMode;

    // Statutory
    payload.cpfApplicable = cpfApplicable;
    payload.sdlApplicable = sdlApplicable;
    if (shgFund) payload.shgFund = shgFund;
    payload.shgOptOut = shgOptOut;
    payload.fwlApplicable = fwlApplicable;
    if (taxBorneBy) payload.taxBorneBy = taxBorneBy;

    // Salary
    const cents = Math.round(parseFloat(basicSalaryDollars || "0") * 100);
    payload.basicSalaryCents = cents;
    payload.salaryEffectiveDate = effectiveDate || hireDate;
    payload.otEligible = otEligible;
    if (otEligible) payload.otRate = parseFloat(otRate || "1.5");

    if (recurringAllowances.length > 0) {
      payload.recurringAllowances = recurringAllowances
        .filter((a) => a.name && a.amountDollars)
        .map((a) => ({
          name: a.name,
          amountCents: Math.round(parseFloat(a.amountDollars) * 100),
        }));
    }

    return payload;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    if (!validateStep(6)) return;

    setCompletedSteps((prev) => new Set([...prev, 6]));
    setSubmitting(true);
    setApiError("");

    try {
      const res = await apiFetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (data.success) {
        trackEvent("employee_created");
        router.push(`/employees/${data.data.id}`);
      } else {
        setApiError(data.error || "Failed to create employee");
      }
    } catch {
      setApiError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Allowance helpers
  // ---------------------------------------------------------------------------

  function addAllowance() {
    setRecurringAllowances((prev) => [...prev, { name: "", amountDollars: "" }]);
  }

  function removeAllowance(index: number) {
    setRecurringAllowances((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAllowance(index: number, field: keyof RecurringAllowance, value: string) {
    setRecurringAllowances((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  }

  // ---------------------------------------------------------------------------
  // Checkbox component
  // ---------------------------------------------------------------------------

  function Checkbox({
    id,
    label,
    checked,
    onChange,
    description,
  }: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    description?: string;
  }) {
    return (
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
        />
        <div>
          <label htmlFor={id} className="text-sm font-medium text-gray-700">
            {label}
          </label>
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step content renderers
  // ---------------------------------------------------------------------------

  function renderStep1() {
    return (
      <Card title="Entity Details">
        <div className="space-y-6">
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-sky-800">
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
                  d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                />
              </svg>
              Location: Singapore
            </div>
            <p className="mt-1 pl-7 text-xs text-sky-600">
              This employee will be registered under Singapore regulations (CPF, SDL, SHG).
            </p>
          </div>

          <div className="space-y-4">
            <Checkbox
              id="autoEmployeeCode"
              label="Auto-generate Employee ID"
              checked={autoEmployeeCode}
              onChange={setAutoEmployeeCode}
              description="System will assign the next available employee code (e.g., EMP-007)"
            />

            {!autoEmployeeCode && (
              <Input
                id="employeeCode"
                label="Employee ID"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                error={errors["employeeCode"]}
                placeholder="EMP-001"
              />
            )}
          </div>
        </div>
      </Card>
    );
  }

  function renderStep2() {
    return (
      <Card title="Personal Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Input
            id="fullName"
            label="Full Name (as per NRIC)"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors["fullName"]}
            placeholder="Full legal name"
          />
          <Input
            id="nric"
            label="NRIC/FIN"
            required
            value={nric}
            onChange={(e) => setNric(e.target.value.toUpperCase())}
            error={errors["nric"]}
            placeholder="S1234567A"
          />
          <Input
            id="dob"
            label="Date of Birth"
            type="date"
            required
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            error={errors["dob"]}
          />
          <Select
            id="gender"
            label="Gender"
            options={genderOptions}
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            error={errors["gender"]}
          />
          <Select
            id="nationality"
            label="Nationality"
            options={nationalityOptions}
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          />
          <Select
            id="citizenshipStatus"
            label="Citizenship / PR Status"
            required
            options={citizenshipOptions}
            value={citizenshipStatus}
            onChange={(e) => setCitizenshipStatus(e.target.value)}
            error={errors["citizenshipStatus"]}
          />
          {(citizenshipStatus === "PR1" ||
            citizenshipStatus === "PR2" ||
            citizenshipStatus === "PR3") && (
            <Input
              id="prEffectiveDate"
              label="PR Effective Date"
              type="date"
              value={prEffectiveDate}
              onChange={(e) => setPrEffectiveDate(e.target.value)}
              error={errors["prEffectiveDate"]}
            />
          )}
          <Select
            id="race"
            label="Race"
            options={raceOptions}
            value={race}
            onChange={(e) => setRace(e.target.value)}
          />
          <Select
            id="religion"
            label="Religion"
            options={religionOptions}
            value={religion}
            onChange={(e) => setReligion(e.target.value)}
          />
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <h4 className="mb-4 text-sm font-semibold text-gray-700">Contact Information</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors["email"]}
              placeholder="name@example.com"
            />
            <Input
              id="mobile"
              label="Mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="+65 9123 4567"
            />
            <div className="lg:col-span-3">
              <Input
                id="address"
                label="Residential Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Block 123, Ang Mo Kio Ave 3, #01-456, Singapore 560123"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <h4 className="mb-4 text-sm font-semibold text-gray-700">Emergency Contact</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="emergencyContactName"
              label="Contact Name"
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
            />
            <Input
              id="emergencyContactPhone"
              label="Contact Phone"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
              placeholder="+65 9123 4567"
            />
          </div>
        </div>
      </Card>
    );
  }

  function renderStep3() {
    return (
      <Card title="Job Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Input
            id="hireDate"
            label="Hire Date"
            type="date"
            required
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
            error={errors["hireDate"]}
          />
          <Select
            id="employmentType"
            label="Employment Type"
            required
            options={employmentTypeOptions}
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value)}
            error={errors["employmentType"]}
          />
          <Input
            id="position"
            label="Position / Job Title"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Clinic Assistant"
          />
          <Input
            id="department"
            label="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Operations"
          />
          <Select
            id="workSchedule"
            label="Work Schedule"
            options={workScheduleOptions}
            value={workSchedule}
            onChange={(e) => setWorkSchedule(e.target.value)}
          />
          <Input
            id="probationEnd"
            label="Probation End Date"
            type="date"
            value={probationEnd}
            onChange={(e) => setProbationEnd(e.target.value)}
          />
          {(employmentType === "CONTRACT" || employmentType === "LOCUM") && (
            <Input
              id="contractEndDate"
              label="Contract End Date"
              type="date"
              value={contractEndDate}
              onChange={(e) => setContractEndDate(e.target.value)}
            />
          )}
          <Select
            id="noticePeriod"
            label="Notice Period"
            options={noticePeriodOptions}
            value={noticePeriod}
            onChange={(e) => setNoticePeriod(e.target.value)}
          />
        </div>
      </Card>
    );
  }

  function renderStep4() {
    return (
      <Card title="Bank Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Select
            id="paymentMode"
            label="Payment Mode"
            options={paymentModeOptions}
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
          />
          <Select
            id="bankName"
            label="Bank Name"
            options={bankNameOptions}
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
          <Input
            id="branchCode"
            label="Branch Code"
            value={branchCode}
            onChange={(e) => setBranchCode(e.target.value)}
            placeholder="001"
          />
          <Input
            id="accountNumber"
            label="Account Number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="012-345678-9"
          />
          <Select
            id="accountType"
            label="Account Type"
            options={accountTypeOptions}
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
          />
        </div>
        {paymentMode === "bank_transfer" && !bankName && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Bank details are recommended for bank transfer payments.
          </div>
        )}
      </Card>
    );
  }

  function renderStep5() {
    return (
      <Card title="Statutory Details">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">Contributions</h4>
              <Checkbox
                id="cpfApplicable"
                label="CPF Applicable"
                checked={cpfApplicable}
                onChange={setCpfApplicable}
                description="Central Provident Fund contributions"
              />
              <Checkbox
                id="sdlApplicable"
                label="SDL Applicable"
                checked={sdlApplicable}
                onChange={setSdlApplicable}
                description="Skills Development Levy"
              />
              <Checkbox
                id="fwlApplicable"
                label="FWL Applicable"
                checked={fwlApplicable}
                onChange={setFwlApplicable}
                description="Foreign Worker Levy (for work permit holders)"
              />
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">Self-Help Group</h4>
              <Select
                id="shgFund"
                label="SHG Fund"
                options={shgFundOptions}
                value={shgFund}
                onChange={(e) => setShgFund(e.target.value)}
              />
              <Checkbox
                id="shgOptOut"
                label="Opt out of SHG contribution"
                checked={shgOptOut}
                onChange={setShgOptOut}
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="mb-4 text-sm font-semibold text-gray-700">Tax & Work Pass</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Select
                id="taxBorneBy"
                label="Tax Borne By"
                options={taxBorneByOptions}
                value={taxBorneBy}
                onChange={(e) => setTaxBorneBy(e.target.value)}
              />
              <Input
                id="cpfAccountNumber"
                label="CPF Account Number"
                value={cpfAccountNumber}
                onChange={(e) => setCpfAccountNumber(e.target.value)}
              />
              <Input
                id="taxRefNumber"
                label="Tax Reference Number"
                value={taxRefNumber}
                onChange={(e) => setTaxRefNumber(e.target.value)}
              />
              <Input
                id="workPassType"
                label="Work Pass Type"
                value={workPassType}
                onChange={(e) => setWorkPassType(e.target.value)}
                placeholder="S Pass / EP / WP"
              />
              <Input
                id="workPassExpiry"
                label="Work Pass Expiry"
                type="date"
                value={workPassExpiry}
                onChange={(e) => setWorkPassExpiry(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  function renderStep6() {
    return (
      <Card title="Salary Details">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input
              id="basicSalaryDollars"
              label="Basic Monthly Salary (SGD)"
              required
              value={basicSalaryDollars}
              onChange={(e) => setBasicSalaryDollars(e.target.value)}
              error={errors["basicSalaryCents"]}
              placeholder="3,500.00"
              type="number"
              min="0"
              step="0.01"
            />
            <Input
              id="effectiveDate"
              label="Salary Effective Date"
              type="date"
              required
              value={effectiveDate || hireDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              error={errors["effectiveDate"]}
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Recurring Allowances</h4>
              <Button variant="secondary" size="sm" type="button" onClick={addAllowance}>
                + Add Allowance
              </Button>
            </div>
            {recurringAllowances.length === 0 ? (
              <p className="text-sm text-gray-400">No recurring allowances configured.</p>
            ) : (
              <div className="space-y-3">
                {recurringAllowances.map((allowance, index) => (
                  <div key={index} className="flex items-end gap-3">
                    <Input
                      id={`allowance-name-${index}`}
                      label="Allowance Name"
                      value={allowance.name}
                      onChange={(e) => updateAllowance(index, "name", e.target.value)}
                      placeholder="Transport Allowance"
                      className="flex-1"
                    />
                    <Input
                      id={`allowance-amount-${index}`}
                      label="Amount (SGD)"
                      value={allowance.amountDollars}
                      onChange={(e) => updateAllowance(index, "amountDollars", e.target.value)}
                      placeholder="200.00"
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-40"
                    />
                    <button
                      type="button"
                      onClick={() => removeAllowance(index)}
                      className="mb-0.5 rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove allowance"
                    >
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
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="mb-4 text-sm font-semibold text-gray-700">Overtime</h4>
            <div className="space-y-4">
              <Checkbox
                id="otEligible"
                label="OT Eligible"
                checked={otEligible}
                onChange={setOtEligible}
                description="Employee is eligible for overtime pay per Employment Act"
              />
              {otEligible && (
                <Input
                  id="otRate"
                  label="OT Rate Multiplier"
                  value={otRate}
                  onChange={(e) => setOtRate(e.target.value)}
                  placeholder="1.5"
                  type="number"
                  min="1"
                  step="0.5"
                  className="w-40"
                />
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const stepRenderers: Record<number, () => React.ReactNode> = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
    6: renderStep6,
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/employees" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Employees
        </Link>
      </div>
      <PageHeader
        title="Add Employee"
        subtitle={`Step ${currentStep} of 6 — ${STEPS[currentStep - 1]?.label ?? ""}`}
      />

      <div className="mt-6">
        <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />
      </div>

      {apiError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="mt-4">{stepRenderers[currentStep]?.()}</div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <div>
          {currentStep > 1 && (
            <Button variant="secondary" type="button" onClick={handleBack}>
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/employees"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Link>
          {currentStep < 6 ? (
            <Button type="button" onClick={handleNext}>
              Next
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} loading={submitting}>
              {submitting ? "Creating..." : "Create Employee"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
