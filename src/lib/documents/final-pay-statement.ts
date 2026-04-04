/**
 * Final Pay Statement HTML Template.
 * Generates a professional document showing termination pay breakdown
 * per Singapore Employment Act requirements.
 */

import { centsToDisplay } from "@/lib/utils/money";
import type { FinalPayResult } from "@/lib/payroll/final-pay";

interface FinalPayStatementData {
  companyName: string;
  companyUen: string;
  employeeName: string;
  nricLast4: string;
  employeeCode?: string;
  department?: string;
  position?: string;
  hireDate: string;
  terminationDate: string;
  terminationReason?: string;
  basicSalaryCents: number;
  finalPay: FinalPayResult;
}

function fmt(cents: number): string {
  return centsToDisplay(cents);
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function generateFinalPayStatement(data: FinalPayStatementData): string {
  const { finalPay } = data;

  const breakdownRows = finalPay.breakdown
    .map(
      (item) => `
      <tr>
        <td class="item-label">${item.label}</td>
        <td class="item-desc">${item.description}</td>
        <td class="item-amt">${fmt(item.amountCents)}</td>
      </tr>`,
    )
    .join("");

  // If no breakdown items, show a zero row
  const noItemsRow =
    finalPay.breakdown.length === 0
      ? '<tr><td colspan="3" class="no-items">No final pay entitlements applicable.</td></tr>'
      : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Final Pay Statement - ${data.employeeName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 12px; color: #333; background: #fff; }
  .statement { max-width: 800px; margin: 0 auto; padding: 30px 40px; }

  /* Header */
  .header { background: #1e3a5f; color: #fff; padding: 20px 24px; border-radius: 6px 6px 0 0; }
  .header h1 { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px; }
  .header .sub { font-size: 11px; opacity: 0.85; }

  /* Company info */
  .company-bar { background: #f0f4f8; padding: 14px 24px; border-bottom: 1px solid #d0d8e0; }
  .company-bar .company-name { font-size: 14px; font-weight: 600; color: #1e3a5f; }
  .company-bar .company-uen { font-size: 11px; color: #6b7a8d; margin-top: 2px; }

  /* Employee info grid */
  .info-section { padding: 16px 24px; border: 1px solid #e2e8f0; border-top: none; }
  .info-section h2 { font-size: 12px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 40px; font-size: 12px; }
  .info-grid .label { color: #6b7a8d; font-weight: 500; }
  .info-grid .value { color: #1a2a3a; font-weight: 600; }

  /* Service summary */
  .service-section { padding: 16px 24px; border: 1px solid #e2e8f0; border-top: none; background: #fafbfc; }
  .service-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .service-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; }
  .service-card .card-value { font-size: 18px; font-weight: 700; color: #1e3a5f; }
  .service-card .card-label { font-size: 10px; color: #6b7a8d; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

  /* Breakdown table */
  .breakdown-section { border: 1px solid #e2e8f0; border-top: none; }
  .breakdown-header { background: #1e3a5f; color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 10px 24px; }
  .breakdown-table { width: 100%; border-collapse: collapse; }
  .breakdown-table th { text-align: left; font-size: 10px; font-weight: 600; color: #6b7a8d; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
  .breakdown-table th:last-child { text-align: right; }
  .breakdown-table td { padding: 10px 24px; border-bottom: 1px solid #f0f4f8; font-size: 12px; }
  .item-label { font-weight: 600; color: #1a2a3a; }
  .item-desc { color: #5a6a7a; font-size: 11px; }
  .item-amt { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .no-items { text-align: center; color: #8a9aaa; padding: 20px 24px; }

  /* Total row */
  .total-row { background: #1e3a5f; }
  .total-row td { padding: 14px 24px; color: #fff; font-size: 14px; font-weight: 700; border: none; }
  .total-row .total-amt { text-align: right; font-variant-numeric: tabular-nums; }

  /* Signature section */
  .signature-section { padding: 40px 24px 24px; border: 1px solid #e2e8f0; border-top: none; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-block { border-top: 1px solid #333; padding-top: 8px; }
  .sig-block .sig-label { font-size: 10px; color: #6b7a8d; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-block .sig-name { font-size: 12px; font-weight: 600; color: #1a2a3a; margin-top: 4px; }
  .sig-block .sig-date { font-size: 11px; color: #6b7a8d; margin-top: 2px; }

  /* Notice */
  .notice { padding: 12px 24px; border: 1px solid #e2e8f0; border-top: none; background: #fffbeb; font-size: 10px; color: #92400e; }

  /* Footer */
  .footer { padding: 16px 24px; text-align: center; font-size: 10px; color: #8a9aaa; border-top: 1px solid #e2e8f0; }

  /* Print */
  @media print {
    body { margin: 0; }
    .statement { padding: 10px 20px; max-width: 100%; }
    .header, .breakdown-header, .total-row { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
<div class="statement">

  <!-- Header -->
  <div class="header">
    <h1>FINAL PAY STATEMENT</h1>
    <div class="sub">Employment Act (Chapter 91) &mdash; Final Settlement</div>
  </div>

  <!-- Company -->
  <div class="company-bar">
    <div class="company-name">${data.companyName}</div>
    ${data.companyUen ? `<div class="company-uen">UEN: ${data.companyUen}</div>` : ""}
  </div>

  <!-- Employee Info -->
  <div class="info-section">
    <h2>Employee Details</h2>
    <div class="info-grid">
      <div><span class="label">Name:</span> <span class="value">${data.employeeName}</span></div>
      <div><span class="label">NRIC/FIN:</span> <span class="value">&bull;&bull;&bull;&bull;&bull;${data.nricLast4}</span></div>
      ${data.employeeCode ? `<div><span class="label">Employee Code:</span> <span class="value">${data.employeeCode}</span></div>` : ""}
      ${data.department ? `<div><span class="label">Department:</span> <span class="value">${data.department}</span></div>` : ""}
      ${data.position ? `<div><span class="label">Position:</span> <span class="value">${data.position}</span></div>` : ""}
      <div><span class="label">Basic Salary:</span> <span class="value">S$${fmt(data.basicSalaryCents)}</span></div>
      <div><span class="label">Hire Date:</span> <span class="value">${formatDate(data.hireDate)}</span></div>
      <div><span class="label">Last Day:</span> <span class="value">${formatDate(data.terminationDate)}</span></div>
      ${data.terminationReason ? `<div><span class="label">Reason:</span> <span class="value">${data.terminationReason}</span></div>` : ""}
    </div>
  </div>

  <!-- Service Summary -->
  <div class="service-section">
    <div class="service-grid">
      <div class="service-card">
        <div class="card-value">${finalPay.yearsOfService.toFixed(1)}</div>
        <div class="card-label">Years of Service</div>
      </div>
      <div class="service-card">
        <div class="card-value">${finalPay.noticePeriodDays}</div>
        <div class="card-label">Notice Period (Days)</div>
      </div>
      <div class="service-card">
        <div class="card-value">S$${fmt(finalPay.dailyRateCents)}</div>
        <div class="card-label">Daily Rate (Basic/26)</div>
      </div>
    </div>
  </div>

  <!-- Breakdown -->
  <div class="breakdown-section">
    <div class="breakdown-header">Final Pay Breakdown</div>
    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Component</th>
          <th>Details</th>
          <th style="text-align:right">Amount (SGD)</th>
        </tr>
      </thead>
      <tbody>
        ${breakdownRows}
        ${noItemsRow}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="2">TOTAL FINAL PAY</td>
          <td class="total-amt">S$${fmt(finalPay.totalFinalPayCents)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Notice -->
  <div class="notice">
    This final pay statement is prepared in accordance with the Employment Act (Chapter 91) of Singapore.
    All amounts are in Singapore Dollars (SGD). Daily rate is calculated as basic salary divided by 26 working days per the Employment Act.
    Pro-rated AWS is calculated based on completed months in the final calendar year.
  </div>

  <!-- Signature -->
  <div class="signature-section">
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-label">Authorised Signatory (Employer)</div>
        <div class="sig-name">${data.companyName}</div>
        <div class="sig-date">Date: _______________</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Acknowledged by (Employee)</div>
        <div class="sig-name">${data.employeeName}</div>
        <div class="sig-date">Date: _______________</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>Generated by ClinicPay &mdash; ${new Date().toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" })}</div>
    <div>This is a system-generated document.</div>
  </div>

</div>
</body></html>`;
}
