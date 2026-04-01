/**
 * IRAS IR8A / AIS XML Generation.
 * Generates annual tax filing data per employee.
 */

import { centsToDisplay } from "@/lib/utils/money";

interface Ir8aEmployeeData {
  nricLast4: string;
  employeeName: string;
  dob: string;
  nationality: string;
  hireDate: string;
  terminationDate: string | null;
  totalGrossPayCents: number;
  totalBonusCents: number;
  totalEmployerCpfCents: number;
  totalEmployeeCpfCents: number;
  totalDirectorFeesCents: number;
  totalBenefitsInKindCents: number;
}

interface Ir8aResult {
  filename: string;
  content: string;
  recordCount: number;
  year: number;
}

function toDollars(cents: number): string {
  return centsToDisplay(cents).replace(/,/g, "");
}

export function generateIr8aXml(
  employees: Ir8aEmployeeData[],
  companyUen: string,
  companyName: string,
  year: number,
): Ir8aResult {
  const employeeElements = employees
    .map(
      (emp) => `
    <Employee>
      <EmployeeID>XXXXX${emp.nricLast4}</EmployeeID>
      <EmployeeName>${escapeXml(emp.employeeName)}</EmployeeName>
      <DateOfBirth>${emp.dob}</DateOfBirth>
      <Nationality>${escapeXml(emp.nationality)}</Nationality>
      <DateOfCommencement>${emp.hireDate}</DateOfCommencement>
      ${emp.terminationDate ? `<DateOfCessation>${emp.terminationDate}</DateOfCessation>` : ""}
      <GrossSalary>${toDollars(emp.totalGrossPayCents)}</GrossSalary>
      <Bonus>${toDollars(emp.totalBonusCents)}</Bonus>
      <DirectorFees>${toDollars(emp.totalDirectorFeesCents)}</DirectorFees>
      <BenefitsInKind>${toDollars(emp.totalBenefitsInKindCents)}</BenefitsInKind>
      <EmployerCPF>${toDollars(emp.totalEmployerCpfCents)}</EmployerCPF>
      <EmployeeCPF>${toDollars(emp.totalEmployeeCpfCents)}</EmployeeCPF>
    </Employee>`,
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<IR8ASubmission>
  <Header>
    <EmployerUEN>${companyUen}</EmployerUEN>
    <EmployerName>${escapeXml(companyName)}</EmployerName>
    <BasisYear>${year}</BasisYear>
    <RecordCount>${employees.length}</RecordCount>
  </Header>
  <Employees>${employeeElements}
  </Employees>
</IR8ASubmission>`;

  return {
    filename: `IR8A_${companyUen}_${year}.xml`,
    content: xml,
    recordCount: employees.length,
    year,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
