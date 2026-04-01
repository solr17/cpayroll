"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface EmployeeDetail {
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
  terminationDate: string | null;
  terminationReason: string | null;
  bankDetails: { bankName: string; branchCode: string; accountNumber: string; payNowLinked?: string } | null;
  cpfAccountNumber: string | null;
  workPassType: string | null;
  workPassExpiry: string | null;
  taxRefNumber: string | null;
  status: string;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/employees/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setEmployee(data.data);
        } else {
          setError(data.error);
        }
      } catch {
        setError("Failed to load employee");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!employee) return <div className="p-8">Employee not found</div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Link href="/employees" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Employees
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{employee.fullName}</h1>
          <p className="text-sm text-gray-500">
            NRIC: {employee.nricDisplay} &middot; {employee.status} &middot; {employee.employmentType}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Personal Information</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Date of Birth" value={employee.dob} />
            <Field label="Gender" value={employee.gender} />
            <Field label="Nationality" value={employee.nationality} />
            <Field label="Citizenship Status" value={employee.citizenshipStatus} />
            <Field label="PR Effective Date" value={employee.prEffectiveDate} />
            <Field label="Mobile" value={employee.mobile} />
            <Field label="Email" value={employee.email} />
            <Field label="Address" value={employee.address} />
            <Field label="Emergency Contact" value={employee.emergencyContactName} />
            <Field label="Emergency Phone" value={employee.emergencyContactPhone} />
          </dl>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Employment</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Employee Code" value={employee.employeeCode} />
            <Field label="Position" value={employee.position} />
            <Field label="Department" value={employee.department} />
            <Field label="Hire Date" value={employee.hireDate} />
            <Field label="Confirmation Date" value={employee.confirmationDate} />
            <Field label="Probation End" value={employee.probationEnd} />
            <Field label="Employment Type" value={employee.employmentType} />
            <Field label="Contract End" value={employee.contractEndDate} />
          </dl>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Statutory</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="CPF Account" value={employee.cpfAccountNumber} />
            <Field label="Tax Ref" value={employee.taxRefNumber} />
            <Field label="Work Pass Type" value={employee.workPassType} />
            <Field label="Work Pass Expiry" value={employee.workPassExpiry} />
          </dl>
        </section>

        {employee.bankDetails && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Banking</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Bank" value={employee.bankDetails.bankName} />
              <Field label="Branch Code" value={employee.bankDetails.branchCode} />
              <Field label="Account Number" value={employee.bankDetails.accountNumber} />
              <Field label="PayNow" value={employee.bankDetails.payNowLinked} />
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
