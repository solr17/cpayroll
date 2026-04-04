/**
 * PDF Payslip Generation using pdf-lib (pure JS, serverless-compatible).
 * Mirrors the HTML payslip layout with lettered formula system.
 * Employment Act Part 12 compliant.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { centsToDisplay } from "@/lib/utils/money";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayslipPdfData {
  companyName: string;
  companyUen: string;
  employeeName: string;
  employeeId: string | undefined;
  nricLast4: string;
  department: string | undefined;
  position: string | undefined;
  hireDate: string | undefined;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  paymentMode?: string | undefined;
  bankName?: string | undefined;
  bankAccountMasked?: string | undefined;
  // Earnings
  basicSalaryCents: number;
  proratedDays: string | null | undefined;
  prevMonthAdjCents?: number | undefined;
  allowances: Array<{ name: string; amountCents: number }>;
  otHours: number;
  otPayCents: number;
  bonusCents: number;
  commissionCents: number;
  awsCents: number;
  // Deductions
  employeeCpfCents: number;
  shgCents?: number | undefined;
  shgFundType: string | undefined;
  otherDeductions?: Array<{ name: string; amountCents: number }>;
  // Reimbursements
  reimbursementCents?: number | undefined;
  // Employer contributions
  employerCpfCents: number;
  sdlCents: number;
  fwlCents?: number | undefined;
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

// ---------------------------------------------------------------------------
// Colours (RGB 0-1)
// ---------------------------------------------------------------------------

const NAVY = rgb(30 / 255, 58 / 255, 95 / 255); // #1e3a5f
const DARK_TEXT = rgb(26 / 255, 42 / 255, 58 / 255);
const GRAY_TEXT = rgb(107 / 255, 122 / 255, 141 / 255);
const LIGHT_BG = rgb(240 / 255, 244 / 255, 248 / 255);
const WHITE = rgb(1, 1, 1);
const LINE_COLOR = rgb(226 / 255, 232 / 255, 240 / 255);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

interface DrawCtx {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  width: number;
  marginLeft: number;
  marginRight: number;
  y: number;
}

function drawRect(
  ctx: DrawCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: ReturnType<typeof rgb>,
) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, color });
}

function drawText(
  ctx: DrawCtx,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {},
) {
  ctx.page.drawText(text, {
    x,
    y,
    size: opts.size ?? 10,
    font: opts.font ?? ctx.font,
    color: opts.color ?? DARK_TEXT,
  });
}

function drawLine(ctx: DrawCtx, x1: number, y: number, x2: number, color = LINE_COLOR) {
  ctx.page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 0.5,
    color,
  });
}

/** Draw a label + value row. Returns new y. */
function drawRow(
  ctx: DrawCtx,
  label: string,
  value: string,
  x: number,
  y: number,
  rightX: number,
  opts: {
    labelFont?: PDFFont;
    valueFont?: PDFFont;
    labelColor?: ReturnType<typeof rgb>;
    valueColor?: ReturnType<typeof rgb>;
    fontSize?: number;
    indent?: number;
  } = {},
): number {
  const fs = opts.fontSize ?? 9;
  const lFont = opts.labelFont ?? ctx.font;
  const vFont = opts.valueFont ?? ctx.font;
  const lColor = opts.labelColor ?? DARK_TEXT;
  const vColor = opts.valueColor ?? DARK_TEXT;
  const indent = opts.indent ?? 0;

  ctx.page.drawText(label, { x: x + indent, y, size: fs, font: lFont, color: lColor });

  // Right-align value
  const valWidth = vFont.widthOfTextAtSize(value, fs);
  ctx.page.drawText(value, { x: rightX - valWidth, y, size: fs, font: vFont, color: vColor });

  return y - (fs + 5);
}

// ---------------------------------------------------------------------------
// Main PDF generation
// ---------------------------------------------------------------------------

export async function generatePayslipPdf(data: PayslipPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // A4 dimensions in points (595.28 x 841.89)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const ml = 40; // margin left
  const mr = 40; // margin right
  const contentWidth = pageWidth - ml - mr;
  const rightEdge = pageWidth - mr;

  const ctx: DrawCtx = {
    page,
    font,
    fontBold,
    width: pageWidth,
    marginLeft: ml,
    marginRight: mr,
    y: pageHeight - 40,
  };

  // --- Calculate lettered formula values ---
  const A = data.basicSalaryCents;
  const B = data.prevMonthAdjCents ?? 0;
  const totalAllowancesCents = data.allowances
    .filter((a) => a.amountCents > 0)
    .reduce((sum, a) => sum + a.amountCents, 0);
  const C = totalAllowancesCents;

  const additionalItems: Array<{ name: string; amountCents: number }> = [];
  if (data.bonusCents > 0) additionalItems.push({ name: "Bonus", amountCents: data.bonusCents });
  if (data.commissionCents > 0)
    additionalItems.push({ name: "Commission", amountCents: data.commissionCents });
  if (data.awsCents > 0)
    additionalItems.push({ name: "AWS / 13th Month", amountCents: data.awsCents });
  const D = additionalItems.reduce((sum, item) => sum + item.amountCents, 0);

  const E = data.otPayCents;

  const otherDeductionsCents = (data.otherDeductions ?? []).reduce(
    (sum, d) => sum + d.amountCents,
    0,
  );
  const shgCents = data.shgCents ?? 0;
  const F = data.employeeCpfCents + shgCents + otherDeductionsCents;

  const G = data.reimbursementCents ?? 0;
  const H = data.netPayCents;

  const fwlCents = data.fwlCents ?? 0;
  const I = data.employerCpfCents + data.sdlCents + fwlCents;

  const periodMonth = formatPeriodMonth(data.periodEnd);
  const paymentDateFmt = formatDate(data.paymentDate);
  const hireDateFmt = data.hireDate ? formatDate(data.hireDate) : "-";
  const paymentMode = data.paymentMode ?? "Bank Transfer";

  // =========================================================================
  // HEADER — navy background
  // =========================================================================
  const headerH = 44;
  drawRect(ctx, ml, ctx.y - headerH, contentWidth, headerH, NAVY);

  drawText(ctx, `PAYSLIP — ${periodMonth}`, ml + 16, ctx.y - 18, {
    size: 14,
    font: fontBold,
    color: WHITE,
  });
  drawText(
    ctx,
    `${formatDate(data.periodStart)} to ${formatDate(data.periodEnd)}  |  Payday — ${paymentDateFmt}`,
    ml + 16,
    ctx.y - 33,
    { size: 8, color: rgb(1, 1, 1) },
  );
  ctx.y -= headerH + 1;

  // =========================================================================
  // COMPANY + EMPLOYEE INFO — light background
  // =========================================================================
  const infoH = 72;
  drawRect(ctx, ml, ctx.y - infoH, contentWidth, infoH, LIGHT_BG);

  const infoY = ctx.y - 14;
  drawText(
    ctx,
    `${data.companyName}${data.companyUen ? ` (${data.companyUen})` : ""}, Singapore.`,
    ml + 16,
    infoY,
    { size: 10, font: fontBold, color: NAVY },
  );

  const labelFs = 8;
  const valFs = 8;
  const col1 = ml + 16;
  const col2 = ml + contentWidth / 2 + 16;

  let iy = infoY - 16;
  // Row 1
  drawText(ctx, "Employee ID:", col1, iy, { size: labelFs, color: GRAY_TEXT });
  drawText(ctx, data.employeeId ?? "-", col1 + 62, iy, {
    size: valFs,
    font: fontBold,
    color: DARK_TEXT,
  });
  drawText(ctx, "Department:", col2, iy, { size: labelFs, color: GRAY_TEXT });
  drawText(ctx, data.department ?? "-", col2 + 58, iy, {
    size: valFs,
    font: fontBold,
    color: DARK_TEXT,
  });

  iy -= 13;
  // Row 2
  drawText(ctx, "Name:", col1, iy, { size: labelFs, color: GRAY_TEXT });
  drawText(ctx, data.employeeName, col1 + 62, iy, {
    size: valFs,
    font: fontBold,
    color: DARK_TEXT,
  });
  drawText(ctx, "Job Title:", col2, iy, { size: labelFs, color: GRAY_TEXT });
  drawText(ctx, data.position ?? "-", col2 + 58, iy, {
    size: valFs,
    font: fontBold,
    color: DARK_TEXT,
  });

  iy -= 13;
  // Row 3
  drawText(ctx, "NRIC/FIN:", col1, iy, { size: labelFs, color: GRAY_TEXT });
  drawText(ctx, `*****${data.nricLast4}`, col1 + 62, iy, {
    size: valFs,
    font: fontBold,
    color: DARK_TEXT,
  });
  drawText(ctx, "Hire Date:", col2, iy, { size: labelFs, color: GRAY_TEXT });
  drawText(ctx, hireDateFmt, col2 + 58, iy, { size: valFs, font: fontBold, color: DARK_TEXT });

  ctx.y -= infoH + 1;

  // =========================================================================
  // PAYMENT MODE
  // =========================================================================
  const pmH = data.bankName || data.bankAccountMasked ? 38 : 22;
  drawRect(ctx, ml, ctx.y - pmH, contentWidth, pmH, WHITE);
  drawLine(ctx, ml, ctx.y - pmH, rightEdge);

  drawText(ctx, `Mode of Payment: ${paymentMode}`, ml + 16, ctx.y - 12, {
    size: 8,
    font: fontBold,
    color: GRAY_TEXT,
  });

  if (data.bankName || data.bankAccountMasked) {
    const bankY = ctx.y - 28;
    drawText(ctx, "Bank", ml + 16, bankY, { size: 7, font: fontBold, color: GRAY_TEXT });
    drawText(ctx, "Account No.", ml + 160, bankY, { size: 7, font: fontBold, color: GRAY_TEXT });
    drawText(ctx, "Amount (SGD)", rightEdge - 70, bankY, {
      size: 7,
      font: fontBold,
      color: GRAY_TEXT,
    });

    const bvY = bankY - 11;
    drawText(ctx, data.bankName ?? "-", ml + 16, bvY, { size: 8 });
    drawText(ctx, data.bankAccountMasked ?? "-", ml + 160, bvY, { size: 8 });
    const hVal = fmt(H);
    const hW = font.widthOfTextAtSize(hVal, 8);
    drawText(ctx, hVal, rightEdge - 16 - hW, bvY, { size: 8 });
  }

  ctx.y -= pmH;

  // =========================================================================
  // MONTHLY PAYMENTS header
  // =========================================================================
  const secHeaderH = 18;
  drawRect(ctx, ml, ctx.y - secHeaderH, contentWidth, secHeaderH, NAVY);
  drawText(ctx, "MONTHLY PAYMENTS", ml + 16, ctx.y - 13, {
    size: 8,
    font: fontBold,
    color: WHITE,
  });
  ctx.y -= secHeaderH;

  // =========================================================================
  // TWO-COLUMN LAYOUT: Earnings (left) | Deductions (right)
  // =========================================================================

  const colDivX = ml + contentWidth / 2;
  const leftX = ml + 12;
  const leftRightEdge = colDivX - 12;
  const rightX = colDivX + 12;
  const rightRightEdge = rightEdge - 12;

  const colTopY = ctx.y;
  let ly = colTopY - 16; // left column y
  let ry = colTopY - 16; // right column y

  // --- LEFT: Earnings heading ---
  drawText(ctx, "EARNINGS", leftX, ly, { size: 8, font: fontBold, color: NAVY });
  ly -= 16;

  // A: Basic Salary
  const basicLabel = data.proratedDays
    ? `Basic Salary (A) (pro-rated: ${data.proratedDays} days)`
    : "Basic Salary (A)";
  ly = drawRow(ctx, basicLabel, fmt(A), leftX, ly, leftRightEdge, {
    labelFont: fontBold,
    valueFont: fontBold,
  });

  // B: Prev Month Adj
  ly = drawRow(ctx, "Prev Mth Adj (B)", fmt(B), leftX, ly, leftRightEdge, {
    labelFont: fontBold,
    valueFont: fontBold,
  });

  // C: Total Allowances
  ly = drawRow(ctx, "Total Allowances (C)", fmt(C), leftX, ly, leftRightEdge, {
    labelFont: fontBold,
    valueFont: fontBold,
  });

  // Allowance sub-lines
  for (const a of data.allowances.filter((a) => a.amountCents > 0)) {
    ly = drawRow(ctx, a.name, fmt(a.amountCents), leftX, ly, leftRightEdge, {
      indent: 12,
      labelColor: GRAY_TEXT,
      fontSize: 8,
    });
  }

  // D: Other Addl Payments
  ly = drawRow(ctx, "Other Addl Pymt (D)", fmt(D), leftX, ly, leftRightEdge, {
    labelFont: fontBold,
    valueFont: fontBold,
  });

  // Additional sub-lines
  for (const item of additionalItems) {
    ly = drawRow(ctx, item.name, fmt(item.amountCents), leftX, ly, leftRightEdge, {
      indent: 12,
      labelColor: GRAY_TEXT,
      fontSize: 8,
    });
  }

  ly -= 6;
  drawLine(ctx, leftX, ly, leftRightEdge);
  ly -= 10;

  // OT
  drawText(ctx, "Overtime Details", leftX, ly, { size: 8, font: fontBold, color: NAVY });
  ly -= 14;
  ly = drawRow(ctx, "Total OT Hours", data.otHours.toFixed(2), leftX, ly, leftRightEdge);
  ly = drawRow(ctx, "Total OT Pay (E)", fmt(E), leftX, ly, leftRightEdge, {
    labelFont: fontBold,
    valueFont: fontBold,
  });

  // --- RIGHT: Deductions heading ---
  drawText(ctx, "DEDUCTIONS", rightX, ry, { size: 8, font: fontBold, color: NAVY });
  ry -= 16;

  // F: Total Deductions
  ry = drawRow(ctx, "Total Deductions (F)", fmt(F), rightX, ry, rightRightEdge, {
    labelFont: fontBold,
    valueFont: fontBold,
  });

  // Deduction sub-lines
  if (shgCents > 0) {
    const shgLabel = data.shgFundType ?? "SHG Fund";
    ry = drawRow(ctx, shgLabel, fmt(shgCents), rightX, ry, rightRightEdge, {
      indent: 12,
      labelColor: GRAY_TEXT,
      fontSize: 8,
    });
  }
  ry = drawRow(ctx, "Employee CPF", fmt(data.employeeCpfCents), rightX, ry, rightRightEdge, {
    indent: 12,
    labelColor: GRAY_TEXT,
    fontSize: 8,
  });
  if (data.otherDeductions) {
    for (const d of data.otherDeductions) {
      if (d.amountCents > 0) {
        ry = drawRow(ctx, d.name, fmt(d.amountCents), rightX, ry, rightRightEdge, {
          indent: 12,
          labelColor: GRAY_TEXT,
          fontSize: 8,
        });
      }
    }
  }

  ry -= 6;
  // G: Total Reimbursements
  ry = drawRow(ctx, "Total Reimburse (G)", fmt(G), rightX, ry, rightRightEdge, {
    labelFont: fontBold,
    valueFont: fontBold,
  });

  ry -= 8;
  // H: Net Pay
  drawLine(ctx, rightX, ry + 4, rightRightEdge, NAVY);
  drawLine(ctx, rightX, ry + 3, rightRightEdge, NAVY);
  ry -= 4;
  ry = drawRow(ctx, "Net Pay (H)", fmt(H), rightX, ry, rightRightEdge, {
    labelFont: fontBold,
    valueFont: fontBold,
    labelColor: NAVY,
    valueColor: NAVY,
    fontSize: 11,
  });

  drawText(ctx, "H = (A + B + C + D + E - F + G)", rightX, ry, {
    size: 7,
    color: GRAY_TEXT,
  });
  ry -= 16;

  // Employer Contributions
  drawLine(ctx, rightX, ry + 4, rightRightEdge);
  ry -= 8;
  drawText(ctx, "EMPLOYER CONTRIBUTION", rightX, ry, { size: 8, font: fontBold, color: NAVY });
  ry -= 14;

  ry = drawRow(ctx, "Total ER Contrib (I)", fmt(I), rightX, ry, rightRightEdge, {
    labelFont: fontBold,
    valueFont: fontBold,
  });
  ry = drawRow(ctx, "Employer CPF", fmt(data.employerCpfCents), rightX, ry, rightRightEdge, {
    indent: 12,
    labelColor: GRAY_TEXT,
    fontSize: 8,
  });
  ry = drawRow(ctx, "SDL", fmt(data.sdlCents), rightX, ry, rightRightEdge, {
    indent: 12,
    labelColor: GRAY_TEXT,
    fontSize: 8,
  });
  if (fwlCents > 0) {
    ry = drawRow(ctx, "FWL", fmt(fwlCents), rightX, ry, rightRightEdge, {
      indent: 12,
      labelColor: GRAY_TEXT,
      fontSize: 8,
    });
  }

  // Draw column divider line
  const bottomY = Math.min(ly, ry) - 8;
  ctx.page.drawLine({
    start: { x: colDivX, y: colTopY },
    end: { x: colDivX, y: bottomY },
    thickness: 0.5,
    color: LINE_COLOR,
  });

  // Draw border around monthly payments section
  drawLine(ctx, ml, colTopY, rightEdge);
  drawLine(ctx, ml, bottomY, rightEdge);
  ctx.page.drawLine({
    start: { x: ml, y: colTopY },
    end: { x: ml, y: bottomY },
    thickness: 0.5,
    color: LINE_COLOR,
  });
  ctx.page.drawLine({
    start: { x: rightEdge, y: colTopY },
    end: { x: rightEdge, y: bottomY },
    thickness: 0.5,
    color: LINE_COLOR,
  });

  ctx.y = bottomY;

  // =========================================================================
  // YTD SECTION
  // =========================================================================
  if (data.ytd) {
    const ytdRange = formatYtdRange(data.periodEnd);

    // YTD header
    drawRect(ctx, ml, ctx.y - secHeaderH, contentWidth, secHeaderH, NAVY);
    drawText(ctx, `YEAR TO DATE DATA    ${ytdRange}`, ml + 16, ctx.y - 13, {
      size: 8,
      font: fontBold,
      color: WHITE,
    });
    ctx.y -= secHeaderH;

    // YTD table header
    const ytdHeaderH = 14;
    drawRect(ctx, ml, ctx.y - ytdHeaderH, contentWidth, ytdHeaderH, WHITE);
    drawText(ctx, "Tax Grouping", ml + 16, ctx.y - 10, {
      size: 7,
      font: fontBold,
      color: GRAY_TEXT,
    });
    const amtLabel = "Amount (SGD)";
    const amtLabelW = fontBold.widthOfTextAtSize(amtLabel, 7);
    drawText(ctx, amtLabel, rightEdge - 16 - amtLabelW, ctx.y - 10, {
      size: 7,
      font: fontBold,
      color: GRAY_TEXT,
    });
    drawLine(ctx, ml, ctx.y - ytdHeaderH, rightEdge);
    ctx.y -= ytdHeaderH;

    const ytdItems = [
      { label: "Gross Salary, Fees, Leave Pay", value: fmt(data.ytd.grossSalaryCents) },
      { label: "Bonus", value: fmt(data.ytd.bonusCents) },
      { label: "Non Taxable", value: fmt(data.ytd.nonTaxableCents) },
      {
        label: "Donation",
        value: data.ytd.donationCents > 0 ? "-" + fmt(data.ytd.donationCents) : fmt(0),
      },
      { label: "Employee CPF Contribution", value: "-" + fmt(data.ytd.employeeCpfCents) },
      { label: "Employer CPF Contribution", value: fmt(data.ytd.employerCpfCents) },
    ];

    let ytdY = ctx.y;
    for (let i = 0; i < ytdItems.length; i++) {
      const item = ytdItems[i]!;
      const rowH = 16;
      if (i % 2 === 1) {
        drawRect(ctx, ml, ytdY - rowH, contentWidth, rowH, LIGHT_BG);
      }
      drawText(ctx, item.label, ml + 16, ytdY - 11, { size: 9 });
      const vw = font.widthOfTextAtSize(item.value, 9);
      drawText(ctx, item.value, rightEdge - 16 - vw, ytdY - 11, { size: 9 });
      ytdY -= rowH;
    }
    drawLine(ctx, ml, ytdY, rightEdge);
    ctx.y = ytdY;
  }

  // =========================================================================
  // FOOTER
  // =========================================================================
  ctx.y -= 16;
  drawLine(ctx, ml, ctx.y + 8, rightEdge);

  const footerText1 = "Copyright \u00A9 2026 ClinicPay. All Rights Reserved.";
  const footerText2 = "This is a system generated payslip.";
  const ft1W = font.widthOfTextAtSize(footerText1, 7);
  const ft2W = font.widthOfTextAtSize(footerText2, 7);
  drawText(ctx, footerText1, ml + (contentWidth - ft1W) / 2, ctx.y - 4, {
    size: 7,
    color: GRAY_TEXT,
  });
  drawText(ctx, footerText2, ml + (contentWidth - ft2W) / 2, ctx.y - 14, {
    size: 7,
    color: GRAY_TEXT,
  });

  return pdfDoc.save();
}
