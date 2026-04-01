"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Card, Button, Input, Select, PageHeader } from "@/components/ui";

const createEmployeeSchema = z.object({
  nric: z.string().regex(/^[STFGM]\d{7}[A-Z]$/i, "Invalid NRIC/FIN format"),
  fullName: z.string().min(1, "Full name is required").max(200),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  gender: z.enum(["M", "F"]).optional(),
  nationality: z.string().optional(),
  citizenshipStatus: z.enum(["SC", "PR1", "PR2", "PR3", "FW"]),
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
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
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
  employmentType: z.enum(["FT", "PT", "CONTRACT", "LOCUM"]).default("FT"),
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

type FormErrors = Record<string, string>;

export default function NewEmployeePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  // Identity
  const [fullName, setFullName] = useState("");
  const [nric, setNric] = useState("");
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

  function buildPayload() {
    const payload: Record<string, unknown> = {
      fullName,
      nric,
      dob,
      citizenshipStatus,
      hireDate,
      employmentType,
    };

    if (gender) payload.gender = gender;
    if (nationality) payload.nationality = nationality;
    if (prEffectiveDate) payload.prEffectiveDate = prEffectiveDate;
    if (mobile) payload.mobile = mobile;
    if (email) payload.email = email;
    if (address) payload.address = address;
    if (emergencyContactName) payload.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone) payload.emergencyContactPhone = emergencyContactPhone;
    if (employeeCode) payload.employeeCode = employeeCode;
    if (position) payload.position = position;
    if (department) payload.department = department;
    if (confirmationDate) payload.confirmationDate = confirmationDate;
    if (probationEnd) payload.probationEnd = probationEnd;
    if (contractEndDate) payload.contractEndDate = contractEndDate;
    if (cpfAccountNumber) payload.cpfAccountNumber = cpfAccountNumber;
    if (taxRefNumber) payload.taxRefNumber = taxRefNumber;
    if (workPassType) payload.workPassType = workPassType;
    if (workPassExpiry) payload.workPassExpiry = workPassExpiry;

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setApiError("");

    const payload = buildPayload();
    const result = createEmployeeSchema.safeParse(payload);

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
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const data = await res.json();
      if (data.success) {
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

  return (
    <div>
      <div className="mb-6">
        <Link href="/employees" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Employees
        </Link>
      </div>
      <PageHeader title="Add Employee" subtitle="Create a new employee record" />

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
            <Input
              id="nationality"
              label="Nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="Singaporean"
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
              error={errors["prEffectiveDate"]}
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
              placeholder="+65 9123 4567"
            />
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
              id="address"
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Block 123, #01-456"
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
              placeholder="+65 9123 4567"
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
              placeholder="EMP-001"
            />
            <Input
              id="position"
              label="Position"
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
              error={errors["employmentType"]}
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
              placeholder="001"
            />
            <Input
              id="accountNumberEmp"
              label="Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="012-345678-9"
            />
            <Input
              id="payNowId"
              label="PayNow ID"
              value={payNowId}
              onChange={(e) => setPayNowId(e.target.value)}
              placeholder="NRIC or mobile"
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
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button type="submit" loading={submitting}>
            {submitting ? "Creating..." : "Create Employee"}
          </Button>
          <Link
            href="/employees"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
