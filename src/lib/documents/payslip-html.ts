/**
 * HTML Payslip Template — GPayroll-style with lettered formula system.
 * Employment Act Part 12 compliant.
 * Lettered formula: A (Basic) + B (Prev Adj) + C (Allowances) + D (Addl Payments) + E (OT) - F (Deductions) + G (Reimbursements) = H (Net Pay)
 * Employer Contributions: I (Total ER Contrib)
 */

import { centsToDisplay } from "@/lib/utils/money";

interface PayslipData {
  companyName: string;
  companyUen: string;
  employeeName: string;
  employeeId?: string;
  nricLast4: string;
  department?: string;
  position?: string;
  hireDate?: string;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  paymentMode?: string;
  bankName?: string;
  bankAccountMasked?: string;
  // Earnings
  basicSalaryCents: number;
  proratedDays?: string | null;
  prevMonthAdjCents?: number;
  allowances: Array<{ name: string; amountCents: number }>;
  otHours: number;
  otPayCents: number;
  bonusCents: number;
  commissionCents: number;
  awsCents: number;
  // Deductions
  employeeCpfCents: number;
  shgCents?: number;
  shgFundType?: string;
  otherDeductions?: Array<{ name: string; amountCents: number }>;
  // Reimbursements
  reimbursementCents?: number;
  // Employer contributions
  employerCpfCents: number;
  sdlCents: number;
  fwlCents?: number;
  // Totals
  grossPayCents: number;
  netPayCents: number;
  // YTD data
  ytd?: {
    grossSalaryCents: number;
    bonusCents: number;
    nonTaxableCents: number;
    donationCents: number;
    employeeCpfCents: number;
    employerCpfCents: number;
  };
}

function fmt(cents: number): string {
  return centsToDisplay(cents);
}

function formatPeriodMonth(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatYtdRange(periodEnd: string): string {
  try {
    const d = new Date(periodEnd + "T00:00:00");
    const year = d.getFullYear();
    const month = d.toLocaleDateString("en-SG", { month: "short" });
    return `Jan ${year} - ${month} ${year}`;
  } catch {
    return "";
  }
}

export function generatePayslipHtml(data: PayslipData): string {
  // --- Calculate lettered formula values ---
  const A = data.basicSalaryCents;
  const B = data.prevMonthAdjCents ?? 0;
  const totalAllowancesCents = data.allowances
    .filter((a) => a.amountCents > 0)
    .reduce((sum, a) => sum + a.amountCents, 0);
  const C = totalAllowancesCents;

  // D = Other Additional Payments (Bonus, Commission, AWS)
  const additionalItems: Array<{ name: string; amountCents: number }> = [];
  if (data.bonusCents > 0) additionalItems.push({ name: "Bonus", amountCents: data.bonusCents });
  if (data.commissionCents > 0)
    additionalItems.push({ name: "Commission", amountCents: data.commissionCents });
  if (data.awsCents > 0)
    additionalItems.push({ name: "AWS / 13th Month", amountCents: data.awsCents });
  const D = additionalItems.reduce((sum, item) => sum + item.amountCents, 0);

  const E = data.otPayCents;

  // F = Total Deductions
  const otherDeductionsCents = (data.otherDeductions ?? []).reduce(
    (sum, d) => sum + d.amountCents,
    0,
  );
  const shgCents = data.shgCents ?? 0;
  const F = data.employeeCpfCents + shgCents + otherDeductionsCents;

  const G = data.reimbursementCents ?? 0;

  // H = Net Pay = A + B + C + D + E - F + G
  const H = data.netPayCents;

  // I = Total Employer Contributions
  const fwlCents = data.fwlCents ?? 0;
  const I = data.employerCpfCents + data.sdlCents + fwlCents;

  const periodMonth = formatPeriodMonth(data.periodEnd);
  const paymentDateFmt = formatDate(data.paymentDate);
  const hireDateFmt = data.hireDate ? formatDate(data.hireDate) : "-";
  const paymentMode = data.paymentMode ?? "Bank Transfer";

  // --- Allowance sub-lines ---
  const allowanceLines = data.allowances
    .filter((a) => a.amountCents > 0)
    .map(
      (a) =>
        `<tr><td class="sub-line">${a.name}</td><td class="amt">${fmt(a.amountCents)}</td></tr>`,
    )
    .join("");

  // --- Additional payment sub-lines ---
  const additionalLines = additionalItems
    .map(
      (item) =>
        `<tr><td class="sub-line">${item.name}</td><td class="amt">${fmt(item.amountCents)}</td></tr>`,
    )
    .join("");

  // --- Deduction sub-lines ---
  const deductionSubLines: string[] = [];
  if (shgCents > 0) {
    const shgLabel = data.shgFundType ? `${data.shgFundType}` : "SHG Fund";
    deductionSubLines.push(
      `<tr><td class="sub-line">${shgLabel}</td><td class="amt">${fmt(shgCents)}</td></tr>`,
    );
  }
  deductionSubLines.push(
    `<tr><td class="sub-line">Employee CPF</td><td class="amt">${fmt(data.employeeCpfCents)}</td></tr>`,
  );
  if (data.otherDeductions) {
    for (const d of data.otherDeductions) {
      if (d.amountCents > 0) {
        deductionSubLines.push(
          `<tr><td class="sub-line">${d.name}</td><td class="amt">${fmt(d.amountCents)}</td></tr>`,
        );
      }
    }
  }

  // --- Employer contribution sub-lines ---
  const erLines: string[] = [];
  erLines.push(
    `<tr><td class="sub-line">Employer CPF</td><td class="amt">${fmt(data.employerCpfCents)}</td></tr>`,
  );
  erLines.push(`<tr><td class="sub-line">SDL</td><td class="amt">${fmt(data.sdlCents)}</td></tr>`);
  if (fwlCents > 0) {
    erLines.push(`<tr><td class="sub-line">FWL</td><td class="amt">${fmt(fwlCents)}</td></tr>`);
  }

  // --- Bank info row ---
  const bankRow =
    data.bankName || data.bankAccountMasked
      ? `<table class="bank-table">
        <thead><tr><th>Bank</th><th>Account No.</th><th class="amt-header">Amount (SGD)</th></tr></thead>
        <tbody><tr><td>${data.bankName ?? "-"}</td><td>${data.bankAccountMasked ?? "-"}</td><td class="amt">${fmt(H)}</td></tr></tbody>
       </table>`
      : "";

  // --- YTD Section ---
  let ytdSection = "";
  if (data.ytd) {
    const ytdRange = formatYtdRange(data.periodEnd);
    ytdSection = `
    <div class="section ytd-section">
      <div class="section-header">Year to Date Data <span class="ytd-range">${ytdRange}</span></div>
      <table class="ytd-table">
        <thead><tr><th>Tax Grouping</th><th class="amt-header">Amount (SGD)</th></tr></thead>
        <tbody>
          <tr><td>Gross Salary, Fees, Leave Pay</td><td class="amt">${fmt(data.ytd.grossSalaryCents)}</td></tr>
          <tr><td>Bonus</td><td class="amt">${fmt(data.ytd.bonusCents)}</td></tr>
          <tr><td>Non Taxable</td><td class="amt">${fmt(data.ytd.nonTaxableCents)}</td></tr>
          <tr><td>Donation</td><td class="amt">${data.ytd.donationCents > 0 ? "-" + fmt(data.ytd.donationCents) : fmt(0)}</td></tr>
          <tr><td>Employee CPF Contribution</td><td class="amt">-${fmt(data.ytd.employeeCpfCents)}</td></tr>
          <tr><td>Employer CPF Contribution</td><td class="amt">${fmt(data.ytd.employerCpfCents)}</td></tr>
        </tbody>
      </table>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Payslip - ${data.employeeName} - ${periodMonth}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 12px; color: #333; background: #fff; }
  .payslip { max-width: 800px; margin: 0 auto; padding: 30px 40px; }

  /* Header */
  .header { background: #1e3a5f; color: #fff; padding: 16px 24px; border-radius: 6px 6px 0 0; }
  .header h1 { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px; }
  .header .sub { font-size: 11px; opacity: 0.85; }

  /* Company + Employee info */
  .info-bar { background: #f0f4f8; padding: 14px 24px; border-bottom: 1px solid #d0d8e0; }
  .info-bar .company { font-size: 13px; font-weight: 600; color: #1e3a5f; margin-bottom: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 40px; font-size: 12px; }
  .info-grid .label { color: #6b7a8d; font-weight: 500; }
  .info-grid .value { color: #1a2a3a; font-weight: 600; }

  /* Payment mode */
  .payment-bar { padding: 12px 24px; border-bottom: 1px solid #e2e8f0; }
  .payment-bar .mode-label { font-size: 11px; color: #6b7a8d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .bank-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .bank-table th { text-align: left; font-size: 10px; font-weight: 600; color: #6b7a8d; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 0; border-bottom: 1px solid #e2e8f0; }
  .bank-table td { padding: 6px 0; }

  /* Two-column layout */
  .section { border: 1px solid #e2e8f0; border-top: none; }
  .section-header { background: #1e3a5f; color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 8px 24px; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; min-height: 200px; }
  .col { padding: 12px 24px; }
  .col-left { border-right: 1px solid #e2e8f0; }
  .col-heading { font-size: 11px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }

  /* Table rows inside columns */
  .col table { width: 100%; border-collapse: collapse; }
  .col td { padding: 3px 0; font-size: 12px; vertical-align: top; }
  .col .amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .col .formula-row { font-weight: 600; color: #1a2a3a; }
  .col .formula-row td { padding-top: 6px; }
  .col .sub-line { padding-left: 16px; color: #5a6a7a; font-size: 11px; }
  .col .spacer td { height: 10px; }
  .col .net-row { font-weight: 700; color: #1e3a5f; font-size: 13px; border-top: 2px solid #1e3a5f; }
  .col .net-row td { padding-top: 8px; }
  .col .formula-hint { font-size: 10px; color: #8a9aaa; margin-top: 4px; }
  .col .er-heading { font-size: 11px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 16px; margin-bottom: 6px; padding-top: 10px; border-top: 1px solid #e2e8f0; }

  /* YTD Section */
  .ytd-section { margin-top: 0; }
  .ytd-section .section-header .ytd-range { font-weight: 400; opacity: 0.85; margin-left: 10px; }
  .ytd-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .ytd-table th { text-align: left; font-size: 10px; font-weight: 600; color: #6b7a8d; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 24px; border-bottom: 1px solid #e2e8f0; }
  .ytd-table td { padding: 6px 24px; }
  .ytd-table tbody tr:nth-child(even) { background: #f8fafc; }

  .amt-header { text-align: right; }
  .amt { text-align: right; font-variant-numeric: tabular-nums; }

  /* Footer */
  .footer { padding: 16px 24px; text-align: center; font-size: 10px; color: #8a9aaa; border-top: 1px solid #e2e8f0; margin-top: 0; }
  .footer .copyright { margin-bottom: 2px; }

  /* Print */
  @media print {
    body { margin: 0; }
    .payslip { padding: 10px 20px; max-width: 100%; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .section-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
<div class="payslip">

  <!-- Header -->
  <div class="header">
    <h1>PAYSLIP &mdash; ${periodMonth}</h1>
    <div class="sub">${formatDate(data.periodStart)} to ${formatDate(data.periodEnd)} &nbsp;|&nbsp; Main Run Payday &mdash; ${paymentDateFmt}</div>
  </div>

  <!-- Company + Employee Info -->
  <div class="info-bar">
    <div class="company">${data.companyName}${data.companyUen ? ` (${data.companyUen})` : ""}, Singapore.</div>
    <div class="info-grid">
      <div><span class="label">Employee ID:</span> <span class="value">${data.employeeId ?? "-"}</span></div>
      <div><span class="label">Department:</span> <span class="value">${data.department ?? "-"}</span></div>
      <div><span class="label">Name:</span> <span class="value">${data.employeeName}</span></div>
      <div><span class="label">Job Title:</span> <span class="value">${data.position ?? "-"}</span></div>
      <div><span class="label">NRIC/FIN:</span> <span class="value">&bull;&bull;&bull;&bull;&bull;${data.nricLast4}</span></div>
      <div><span class="label">Hire Date:</span> <span class="value">${hireDateFmt}</span></div>
    </div>
  </div>

  <!-- Payment Mode -->
  <div class="payment-bar">
    <div class="mode-label">Mode of Payment: ${paymentMode}</div>
    ${bankRow}
  </div>

  <!-- Monthly Payments -->
  <div class="section">
    <div class="section-header">Monthly Payments</div>
    <div class="columns">
      <!-- Left: Earnings -->
      <div class="col col-left">
        <div class="col-heading">Earnings</div>
        <table>
          <tr class="formula-row">
            <td>Basic Salary (A)${data.proratedDays ? ` <span style="font-weight:400;font-size:11px;color:#6b7a8d">(pro-rated: ${data.proratedDays} days)</span>` : ""}</td>
            <td class="amt">${fmt(A)}</td>
          </tr>
          <tr class="formula-row">
            <td>Prev Mth Adj (B)</td>
            <td class="amt">${fmt(B)}</td>
          </tr>
          <tr class="formula-row">
            <td>Total Allowances (C)</td>
            <td class="amt">${fmt(C)}</td>
          </tr>
          ${allowanceLines}
          <tr class="formula-row">
            <td>Other Addl Pymt (D)</td>
            <td class="amt">${fmt(D)}</td>
          </tr>
          ${additionalLines}
          <tr class="spacer"><td></td><td></td></tr>
          <tr class="formula-row">
            <td colspan="2" style="font-size:11px;font-weight:600;color:#1e3a5f;border-top:1px solid #e2e8f0;padding-top:10px;">Overtime Details</td>
          </tr>
          <tr>
            <td>Total OT Hours</td>
            <td class="amt">${data.otHours.toFixed(2)}</td>
          </tr>
          <tr class="formula-row">
            <td>Total OT Pay (E)</td>
            <td class="amt">${fmt(E)}</td>
          </tr>
        </table>
      </div>

      <!-- Right: Deductions + Net Pay + ER Contrib -->
      <div class="col">
        <div class="col-heading">Deductions</div>
        <table>
          <tr class="formula-row">
            <td>Total Deductions (F)</td>
            <td class="amt">${fmt(F)}</td>
          </tr>
          ${deductionSubLines.join("")}
          <tr class="spacer"><td></td><td></td></tr>
          <tr class="formula-row">
            <td>Total Reimburse (G)</td>
            <td class="amt">${fmt(G)}</td>
          </tr>
          <tr class="spacer"><td></td><td></td></tr>
          <tr class="net-row">
            <td>Net Pay (H)</td>
            <td class="amt">${fmt(H)}</td>
          </tr>
        </table>
        <div class="formula-hint">H = (A + B + C + D + E - F + G)</div>

        <!-- Employer Contributions -->
        <div class="er-heading">Employer Contribution</div>
        <table>
          <tr class="formula-row">
            <td>Total ER Contrib (I)</td>
            <td class="amt">${fmt(I)}</td>
          </tr>
          ${erLines.join("")}
        </table>
      </div>
    </div>
  </div>

  <!-- YTD -->
  ${ytdSection}

  <!-- Footer -->
  <div class="footer">
    <div class="copyright">Copyright &copy; 2026 ClinicPay. All Rights Reserved.</div>
    <div>This is a system generated payslip.</div>
  </div>

</div>
</body></html>`;
}
