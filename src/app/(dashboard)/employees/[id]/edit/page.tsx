"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Card, Button, Input, Select, Modal, PageHeader, Spinner, Badge } from "@/components/ui";

// ---------------------------------------------------------------------------
// Validation schema (mirrors server schema, minus nric for update)
// ---------------------------------------------------------------------------

const updateEmployeeSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(200).optional(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  gender: z.enum(["M", "F"]).optional(),
  nationality: z.string().optional(),
  citizenshipStatus: z.enum(["SC", "PR1", "PR2", "PR3", "FW"]).optional(),
  prEffectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  mobile: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  employeeCode: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  hireDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  confirmationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  probationEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  employmentType: z.enum(["FT", "PT", "CONTRACT", "LOCUM"]).optional(),
  contractEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  bankDetails: z
    .object({
      bankName: z.string(),
      branchCode: z.string(),
      accountNumber: z.string(),
      payNowLinked: z.string().optional(),
    })
    .optional(),
  cpfAccountNumber: z.string().optional(),
  workPassType: z.string().optional(),
  workPassExpiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  taxRefNumber: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeData {
  id: string;
  fullName: string;
  nricDisplay: string;
  nricLast4: string;
  dob: string;
  gender: string | null;
  nationality: string | null;
  citizenshipStatus: string;
  prEffectiveDate: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  employeeCode: string | null;
  position: string | null;
  department: string | null;
  hireDate: string;
  confirmationDate: string | null;
  probationEnd: string | null;
  employmentType: string;
  contractEndDate: string | null;
  bankDetails: {
    bankName: string;
    branchCode: string;
    accountNumber: string;
    payNowLinked?: string;
  } | null;
  cpfAccountNumber: string | null;
  workPassType: string | null;
  workPassExpiry: string | null;
  taxRefNumber: string | null;
  status: string;
}

interface SalaryRecord {
  id: string;
  effectiveDate: string;
  basicSalaryCents: number;
  allowancesJson: Record<string, number> | null;
  otEligible: boolean;
  otRateMultiplier: string;
  awsMonths: string;
  createdAt: string;
}

type FormErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// Constants
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

const employmentTypeOptions = [
  { value: "FT", label: "Full-Time" },
  { value: "PT", label: "Part-Time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "LOCUM", label: "Locum" },
];

const bankNameOptions = [
  { value: "", label: "Select bank..." },
  { value: "DBS", label: "DBS" },
  { value: "OCBC", label: "OCBC" },
  { value: "UOB", label: "UOB" },
  { value: "Others", label: "Others" },
];

const otEligibleOptions = [
  { value: "false", label: "No" },
  { value: "true", label: "Yes" },
];

// ---------------------------------------------------------------------------
// Helper: format cents to dollars
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `S$${dollars.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  // Identity
  const [fullName, setFullName] = useState("");
  const [nricDisplay, setNricDisplay] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [citizenshipStatus, setCitizenshipStatus] = useState("");
  const [prEffectiveDate, setPrEffectiveDate] = useState("");

  // Contact
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  // Employment
  const [employeeCode, setEmployeeCode] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [confirmationDate, setConfirmationDate] = useState("");
  const [probationEnd, setProbationEnd] = useState("");
  const [employmentType, setEmploymentType] = useState("FT");
  const [contractEndDate, setContractEndDate] = useState("");

  // Banking
  const [bankName, setBankName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [payNowId, setPayNowId] = useState("");

  // Statutory
  const [cpfAccountNumber, setCpfAccountNumber] = useState("");
  const [taxRefNumber, setTaxRefNumber] = useState("");
  const [workPassType, setWorkPassType] = useState("");
  const [workPassExpiry, setWorkPassExpiry] = useState("");

  // Salary history
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(true);

  // Salary modal
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [newEffectiveDate, setNewEffectiveDate] = useState("");
  const [newBasicSalary, setNewBasicSalary] = useState("");
  const [newOtEligible, setNewOtEligible] = useState("false");
  const [newOtMultiplier, setNewOtMultiplier] = useState("1.50");
  const [newAwsMonths, setNewAwsMonths] = useState("0");
  const [salarySubmitting, setSalarySubmitting] = useState(false);
  const [salaryError, setSalaryError] = useState("");

  // ---------------------------------------------------------------------------
  // Populate form from employee data
  // ---------------------------------------------------------------------------

  function populateForm(emp: EmployeeData) {
    setFullName(emp.fullName);
    setNricDisplay(emp.nricDisplay);
    setDob(emp.dob);
    setGender(emp.gender ?? "");
    setNationality(emp.nationality ?? "");
    setCitizenshipStatus(emp.citizenshipStatus);
    setPrEffectiveDate(emp.prEffectiveDate ?? "");
    setMobile(emp.mobile ?? "");
    setEmail(emp.email ?? "");
    setAddress(emp.address ?? "");
    setEmergencyContactName(emp.emergencyContactName ?? "");
    setEmergencyContactPhone(emp.emergencyContactPhone ?? "");
    setEmployeeCode(emp.employeeCode ?? "");
    setPosition(emp.position ?? "");
    setDepartment(emp.department ?? "");
    setHireDate(emp.hireDate);
    setConfirmationDate(emp.confirmationDate ?? "");
    setProbationEnd(emp.probationEnd ?? "");
    setEmploymentType(emp.employmentType);
    setContractEndDate(emp.contractEndDate ?? "");
    setBankName(emp.bankDetails?.bankName ?? "");
    setBranchCode(emp.bankDetails?.branchCode ?? "");
    setAccountNumber(emp.bankDetails?.accountNumber ?? "");
    setPayNowId(emp.bankDetails?.payNowLinked ?? "");
    setCpfAccountNumber(emp.cpfAccountNumber ?? "");
    setTaxRefNumber(emp.taxRefNumber ?? "");
    setWorkPassType(emp.workPassType ?? "");
    setWorkPassExpiry(emp.workPassExpiry ?? "");
  }

  // ---------------------------------------------------------------------------
  // Load employee data
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadEmployee() {
      try {
        const res = await fetch(`/api/employees/${employeeId}`);
        const data = await res.json();
        if (data.success) {
          populateForm(data.data);
        } else {
          setLoadError(data.error || "Failed to load employee");
        }
      } catch {
        setLoadError("Network error loading employee");
      } finally {
        setLoading(false);
      }
    }
    loadEmployee();
  }, [employeeId]);

  // ---------------------------------------------------------------------------
  // Load salary records
  // ---------------------------------------------------------------------------

  const loadSalaryRecords = useCallback(async () => {
    setSalaryLoading(true);
    try {
      const res = await fetch(`/api/salary?employeeId=${employeeId}`);
      const data = await res.json();
      if (data.success) {
        setSalaryRecords(data.data);
      }
    } catch {
      // Silently fail — salary section will show empty state
    } finally {
      setSalaryLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadSalaryRecords();
  }, [loadSalaryRecords]);

  // ---------------------------------------------------------------------------
  // Build update payload
  // ---------------------------------------------------------------------------

  function buildPayload() {
    const payload: Record<string, unknown> = {
      fullName,
      dob,
      citizenshipStatus,
      hireDate,
      employmentType,
    };

    if (gender) payload.gender = gender;
    if (nationality) payload.nationality = nationality;
    payload.prEffectiveDate = prEffectiveDate || null;
    if (mobile) payload.mobile = mobile;
    if (email) payload.email = email;
    if (address) payload.address = address;
    if (emergencyContactName) payload.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone) payload.emergencyContactPhone = emergencyContactPhone;
    if (employeeCode) payload.employeeCode = employeeCode;
    if (position) payload.position = position;
    if (department) payload.department = department;
    payload.confirmationDate = confirmationDate || null;
    payload.probationEnd = probationEnd || null;
    payload.contractEndDate = contractEndDate || null;
    if (cpfAccountNumber) payload.cpfAccountNumber = cpfAccountNumber;
    if (taxRefNumber) payload.taxRefNumber = taxRefNumber;
    if (workPassType) payload.workPassType = workPassType;
    payload.workPassExpiry = workPassExpiry || null;

    if (bankName || branchCode || accountNumber) {
      payload.bankDetails = {
        bankName,
        branchCode,
        accountNumber,
        ...(payNowId ? { payNowLinked: payNowId } : {}),
      };
    }

    return payload;
  }

  // ---------------------------------------------------------------------------
  // Submit update
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setApiError("");

    const payload = buildPayload();
    const result = updateEmployeeSchema.safeParse(payload);

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/employees/${employeeId}`);
      } else {
        setApiError(data.error || "Failed to update employee");
      }
    } catch {
      setApiError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Add salary record
  // ---------------------------------------------------------------------------

  async function handleAddSalary(e: React.FormEvent) {
    e.preventDefault();
    setSalaryError("");

    if (!newEffectiveDate || !newBasicSalary) {
      setSalaryError("Effective date and basic salary are required.");
      return;
    }

    const basicSalaryCents = Math.round(parseFloat(newBasicSalary) * 100);
    if (isNaN(basicSalaryCents) || basicSalaryCents <= 0) {
      setSalaryError("Basic salary must be a positive number.");
      return;
    }

    setSalarySubmitting(true);
    try {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          effectiveDate: newEffectiveDate,
          basicSalaryCents,
          otEligible: newOtEligible === "true",
          otRateMultiplier: newOtMultiplier,
          awsMonths: newAwsMonths,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSalaryModalOpen(false);
        setNewEffectiveDate("");
        setNewBasicSalary("");
        setNewOtEligible("false");
        setNewOtMultiplier("1.50");
        setNewAwsMonths("0");
        await loadSalaryRecords();
      } else {
        setSalaryError(data.error || "Failed to create salary record");
      }
    } catch {
      setSalaryError("Network error. Please try again.");
    } finally {
      setSalarySubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
        <Link href="/employees" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          &larr; Back to Employees
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <div className="mb-6">
        <Link href={`/employees/${employeeId}`} className="text-sm text-blue-600 hover:underline">
          &larr; Back to Employee
        </Link>
      </div>
      <PageHeader title="Edit Employee" subtitle={fullName} />

      {apiError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {/* Identity */}
        <Card title="Identity">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input
              id="fullName"
              label="Full Name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors["fullName"]}
            />
            <Input id="nric" label="NRIC/FIN" value={nricDisplay} disabled onChange={() => {}} />
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
            />
            <Input
              id="nationality"
              label="Nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />
            <Select
              id="citizenshipStatus"
              label="Citizenship Status"
              required
              options={citizenshipOptions}
              value={citizenshipStatus}
              onChange={(e) => setCitizenshipStatus(e.target.value)}
              error={errors["citizenshipStatus"]}
            />
            <Input
              id="prEffectiveDate"
              label="PR Effective Date"
              type="date"
              value={prEffectiveDate}
              onChange={(e) => setPrEffectiveDate(e.target.value)}
            />
          </div>
        </Card>

        {/* Contact */}
        <Card title="Contact">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input
              id="mobile"
              label="Mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors["email"]}
            />
            <Input
              id="address"
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Input
              id="emergencyContactName"
              label="Emergency Contact Name"
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
            />
            <Input
              id="emergencyContactPhone"
              label="Emergency Phone"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
            />
          </div>
        </Card>

        {/* Employment */}
        <Card title="Employment">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input
              id="employeeCode"
              label="Employee Code"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
            />
            <Input
              id="position"
              label="Position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
            <Input
              id="department"
              label="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <Input
              id="hireDate"
              label="Hire Date"
              type="date"
              required
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              error={errors["hireDate"]}
            />
            <Input
              id="confirmationDate"
              label="Confirmation Date"
              type="date"
              value={confirmationDate}
              onChange={(e) => setConfirmationDate(e.target.value)}
            />
            <Input
              id="probationEnd"
              label="Probation End"
              type="date"
              value={probationEnd}
              onChange={(e) => setProbationEnd(e.target.value)}
            />
            <Select
              id="employmentType"
              label="Employment Type"
              required
              options={employmentTypeOptions}
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            />
            <Input
              id="contractEndDate"
              label="Contract End Date"
              type="date"
              value={contractEndDate}
              onChange={(e) => setContractEndDate(e.target.value)}
            />
          </div>
        </Card>

        {/* Banking */}
        <Card title="Banking">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Select
              id="bankNameEmp"
              label="Bank Name"
              options={bankNameOptions}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
            <Input
              id="branchCodeEmp"
              label="Branch Code"
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
            />
            <Input
              id="accountNumberEmp"
              label="Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
            <Input
              id="payNowId"
              label="PayNow ID"
              value={payNowId}
              onChange={(e) => setPayNowId(e.target.value)}
            />
          </div>
        </Card>

        {/* Statutory */}
        <Card title="Statutory">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input
              id="cpfAccountNumber"
              label="CPF Account Number"
              value={cpfAccountNumber}
              onChange={(e) => setCpfAccountNumber(e.target.value)}
            />
            <Input
              id="taxRefNumber"
              label="Tax Ref Number"
              value={taxRefNumber}
              onChange={(e) => setTaxRefNumber(e.target.value)}
            />
            <Input
              id="workPassType"
              label="Work Pass Type"
              value={workPassType}
              onChange={(e) => setWorkPassType(e.target.value)}
            />
            <Input
              id="workPassExpiry"
              label="Work Pass Expiry"
              type="date"
              value={workPassExpiry}
              onChange={(e) => setWorkPassExpiry(e.target.value)}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
          <Link
            href={`/employees/${employeeId}`}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Salary History */}
      <div className="mt-12">
        <Card title="Salary History">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              All salary records are immutable. New salary changes create a new record with an
              effective date.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setSalaryError("");
                setSalaryModalOpen(true);
              }}
            >
              Add Salary Record
            </Button>
          </div>

          {salaryLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-6 w-6 text-blue-600" />
            </div>
          ) : salaryRecords.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No salary records yet. Add the first salary record for this employee.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                      Effective Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                      Basic Salary
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                      OT Eligible
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                      OT Multiplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                      AWS (months)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {salaryRecords.map((rec, idx) => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">
                        {rec.effectiveDate}
                        {idx === 0 && <Badge variant="success">Current</Badge>}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">
                        {formatCents(rec.basicSalaryCents)}
                      </td>
                      <td className="px-4 py-3">
                        {rec.otEligible ? (
                          <Badge variant="info">Yes</Badge>
                        ) : (
                          <Badge variant="neutral">No</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{rec.otRateMultiplier}x</td>
                      <td className="px-4 py-3 text-gray-700">{rec.awsMonths}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(rec.createdAt).toLocaleDateString("en-SG")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add Salary Modal */}
      <Modal
        open={salaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        title="Add Salary Record"
      >
        <form onSubmit={handleAddSalary} className="space-y-4">
          {salaryError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {salaryError}
            </div>
          )}
          <Input
            id="newEffectiveDate"
            label="Effective Date"
            type="date"
            required
            value={newEffectiveDate}
            onChange={(e) => setNewEffectiveDate(e.target.value)}
          />
          <Input
            id="newBasicSalary"
            label="Basic Salary (S$)"
            type="number"
            step="0.01"
            min="0"
            required
            value={newBasicSalary}
            onChange={(e) => setNewBasicSalary(e.target.value)}
            placeholder="3500.00"
          />
          <Select
            id="newOtEligible"
            label="OT Eligible"
            options={otEligibleOptions}
            value={newOtEligible}
            onChange={(e) => setNewOtEligible(e.target.value)}
          />
          <Input
            id="newOtMultiplier"
            label="OT Rate Multiplier"
            type="number"
            step="0.5"
            min="1"
            max="3"
            value={newOtMultiplier}
            onChange={(e) => setNewOtMultiplier(e.target.value)}
          />
          <Input
            id="newAwsMonths"
            label="AWS (months)"
            type="number"
            step="0.5"
            min="0"
            value={newAwsMonths}
            onChange={(e) => setNewAwsMonths(e.target.value)}
          />
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={salarySubmitting}>
              {salarySubmitting ? "Adding..." : "Add Record"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSalaryModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
