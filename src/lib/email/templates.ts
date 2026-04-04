/**
 * Email HTML templates for ClinicPay.
 * Clean, professional, and compatible with major email clients.
 * All templates use inline styles for email client compatibility.
 */

// ---------------------------------------------------------------------------
// Shared layout wrapper
// ---------------------------------------------------------------------------

const BRAND_COLOR = "#0284c7";
const TEXT_PRIMARY = "#1a2a3a";
const TEXT_SECONDARY = "#4a5568";
const BG_LIGHT = "#f4f6f8";

function emailLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG_LIGHT};font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${BG_LIGHT};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">ClinicPay</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#8a9aaa;line-height:1.5;">
                This is an automated message from ClinicPay. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buttonHtml(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:${BRAND_COLOR};border-radius:6px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

// ---------------------------------------------------------------------------
// Template: Welcome
// ---------------------------------------------------------------------------

export function welcomeEmail(name: string, companyName: string): { subject: string; html: string } {
  const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`;
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:${TEXT_PRIMARY};line-height:1.5;">
      Hi ${name},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      Welcome to <strong style="color:${TEXT_PRIMARY};">ClinicPay</strong>! Your account for
      <strong style="color:${TEXT_PRIMARY};">${companyName}</strong> has been created successfully.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;font-weight:600;">
      Quick start tips:
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.8;">
      <li>Add your employees under the <strong>Employees</strong> tab</li>
      <li>Configure CPF and company settings in <strong>Settings</strong></li>
      <li>Run your first payroll from the <strong>Payroll</strong> page</li>
    </ul>
    ${buttonHtml("Log In to ClinicPay", loginUrl)}
    <p style="margin:0;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      If you have any questions, feel free to reach out to our support team.
    </p>`;

  return {
    subject: "Welcome to ClinicPay",
    html: emailLayout("Welcome to ClinicPay", body),
  };
}

// ---------------------------------------------------------------------------
// Template: Password Reset
// ---------------------------------------------------------------------------

export function passwordResetEmail(
  name: string,
  resetUrl: string,
): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:${TEXT_PRIMARY};line-height:1.5;">
      Hi ${name},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      We received a request to reset your ClinicPay password. Click the button below to set a new password.
    </p>
    ${buttonHtml("Reset Password", resetUrl)}
    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      This link is valid for <strong style="color:${TEXT_PRIMARY};">1 hour</strong>. If you did not request a password reset, you can safely ignore this email &mdash; your password will not be changed.
    </p>
    <p style="margin:0;font-size:12px;color:#8a9aaa;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:16px;">
      Security note: ClinicPay will never ask for your password via email. If you suspect unauthorised access to your account, please contact your administrator immediately.
    </p>`;

  return {
    subject: "Reset your ClinicPay password",
    html: emailLayout("Reset your ClinicPay password", body),
  };
}

// ---------------------------------------------------------------------------
// Template: Payslip Ready
// ---------------------------------------------------------------------------

export function payslipReadyEmail(
  name: string,
  period: string,
  loginUrl: string,
): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:${TEXT_PRIMARY};line-height:1.5;">
      Hi ${name},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      Your payslip for <strong style="color:${TEXT_PRIMARY};">${period}</strong> is now available.
    </p>
    ${buttonHtml("View Payslip", loginUrl)}
    <p style="margin:0;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      If you have any questions about your pay, please contact your HR or payroll administrator.
    </p>`;

  return {
    subject: `Your payslip for ${period} is ready`,
    html: emailLayout(`Your payslip for ${period} is ready`, body),
  };
}

// ---------------------------------------------------------------------------
// Template: Pay Run Approval
// ---------------------------------------------------------------------------

export function payRunApprovalEmail(
  name: string,
  period: string,
  payRunUrl: string,
): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:${TEXT_PRIMARY};line-height:1.5;">
      Hi ${name},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      A pay run for <strong style="color:${TEXT_PRIMARY};">${period}</strong> has been submitted and requires your approval.
    </p>
    ${buttonHtml("Review Pay Run", payRunUrl)}
    <p style="margin:0;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      Please review the pay run details and approve or reject it at your earliest convenience.
    </p>`;

  return {
    subject: `Pay run for ${period} needs approval`,
    html: emailLayout(`Pay run for ${period} needs approval`, body),
  };
}

// ---------------------------------------------------------------------------
// Template: Leave Request (to approver)
// ---------------------------------------------------------------------------

export function leaveRequestEmail(
  approverName: string,
  employeeName: string,
  leaveType: string,
  dates: string,
): { subject: string; html: string } {
  const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard`;
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:${TEXT_PRIMARY};line-height:1.5;">
      Hi ${approverName},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      <strong style="color:${TEXT_PRIMARY};">${employeeName}</strong> has submitted a leave request that requires your attention.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f0f4f8;border-radius:6px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size:12px;color:#6b7a8d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:4px;">Leave Type</td>
              <td style="font-size:12px;color:#6b7a8d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:4px;text-align:right;">Dates</td>
            </tr>
            <tr>
              <td style="font-size:14px;color:${TEXT_PRIMARY};font-weight:600;">${leaveType}</td>
              <td style="font-size:14px;color:${TEXT_PRIMARY};font-weight:600;text-align:right;">${dates}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${buttonHtml("Approve / Reject", loginUrl)}`;

  return {
    subject: `${employeeName} submitted a leave request`,
    html: emailLayout(`${employeeName} submitted a leave request`, body),
  };
}

// ---------------------------------------------------------------------------
// Template: Leave Status (to employee)
// ---------------------------------------------------------------------------

export function leaveStatusEmail(
  employeeName: string,
  leaveType: string,
  dates: string,
  status: "approved" | "rejected",
): { subject: string; html: string } {
  const statusColor = status === "approved" ? "#16a34a" : "#dc2626";
  const statusLabel = status === "approved" ? "Approved" : "Rejected";

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:${TEXT_PRIMARY};line-height:1.5;">
      Hi ${employeeName},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      Your leave request has been updated:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f0f4f8;border-radius:6px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size:12px;color:#6b7a8d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:4px;">Leave Type</td>
              <td style="font-size:12px;color:#6b7a8d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:4px;text-align:right;">Dates</td>
            </tr>
            <tr>
              <td style="font-size:14px;color:${TEXT_PRIMARY};font-weight:600;">${leaveType}</td>
              <td style="font-size:14px;color:${TEXT_PRIMARY};font-weight:600;text-align:right;">${dates}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 20px 16px;">
          <p style="margin:0;font-size:14px;">
            Status: <strong style="color:${statusColor};">${statusLabel}</strong>
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      If you have any questions, please contact your HR administrator.
    </p>`;

  return {
    subject: `Your leave request has been ${status}`,
    html: emailLayout(`Your leave request has been ${status}`, body),
  };
}

// ---------------------------------------------------------------------------
// Template: Work Pass Expiry Alert (weekly digest)
// ---------------------------------------------------------------------------

interface WorkPassAlertEmployee {
  name: string;
  passType: string;
  expiryDate: string;
}

export function workPassExpiryEmail(
  adminName: string,
  employees: WorkPassAlertEmployee[],
): { subject: string; html: string } {
  const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/employees`;
  const expiredList = employees.filter((e) => new Date(e.expiryDate) < new Date());
  const expiringList = employees.filter((e) => new Date(e.expiryDate) >= new Date());

  let tableRows = "";

  if (expiredList.length > 0) {
    for (const emp of expiredList) {
      tableRows += `
        <tr>
          <td style="padding:8px 12px;font-size:13px;color:${TEXT_PRIMARY};border-bottom:1px solid #e2e8f0;">${emp.name}</td>
          <td style="padding:8px 12px;font-size:13px;color:${TEXT_SECONDARY};border-bottom:1px solid #e2e8f0;">${emp.passType}</td>
          <td style="padding:8px 12px;font-size:13px;color:#dc2626;font-weight:600;border-bottom:1px solid #e2e8f0;">${emp.expiryDate} (Expired)</td>
        </tr>`;
    }
  }

  if (expiringList.length > 0) {
    for (const emp of expiringList) {
      tableRows += `
        <tr>
          <td style="padding:8px 12px;font-size:13px;color:${TEXT_PRIMARY};border-bottom:1px solid #e2e8f0;">${emp.name}</td>
          <td style="padding:8px 12px;font-size:13px;color:${TEXT_SECONDARY};border-bottom:1px solid #e2e8f0;">${emp.passType}</td>
          <td style="padding:8px 12px;font-size:13px;color:#d97706;font-weight:600;border-bottom:1px solid #e2e8f0;">${emp.expiryDate}</td>
        </tr>`;
    }
  }

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:${TEXT_PRIMARY};line-height:1.5;">
      Hi ${adminName},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      The following <strong style="color:${TEXT_PRIMARY};">${employees.length} employee${employees.length !== 1 ? "s" : ""}</strong> have work passes that are expired or expiring within the next 90 days. Please take action to ensure continuity of payroll processing.
    </p>
    ${
      expiredList.length > 0
        ? `<p style="margin:0 0 8px;font-size:13px;color:#dc2626;font-weight:600;">Employees with expired passes will be automatically excluded from payroll runs.</p>`
        : ""
    }
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;border-radius:6px;margin-bottom:24px;border:1px solid #e2e8f0;">
      <tr>
        <th style="padding:10px 12px;font-size:12px;color:#6b7a8d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:2px solid #e2e8f0;">Employee</th>
        <th style="padding:10px 12px;font-size:12px;color:#6b7a8d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:2px solid #e2e8f0;">Pass Type</th>
        <th style="padding:10px 12px;font-size:12px;color:#6b7a8d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:2px solid #e2e8f0;">Expiry Date</th>
      </tr>
      ${tableRows}
    </table>
    ${buttonHtml("View Employees", dashboardUrl)}
    <p style="margin:0;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      This is an automated weekly check. Please renew work passes before their expiry dates to avoid disruption to payroll processing.
    </p>`;

  const count = employees.length;
  return {
    subject: `Work pass expiry alert \u2014 ${count} employee${count !== 1 ? "s" : ""} need attention`,
    html: emailLayout("Work Pass Expiry Alert", body),
  };
}

// ---------------------------------------------------------------------------
// Existing: Payslip email (used by pay-run email route with PDF attachment)
// ---------------------------------------------------------------------------

interface PayslipEmailData {
  employeeName: string;
  companyName: string;
  period: string;
  payDate: string;
}

/**
 * HTML email template for payslip delivery.
 * Uses inline styles for maximum email client compatibility.
 */
export function payslipEmailHtml(data: PayslipEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Payslip - ${data.period}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f6f8;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background-color:#ffffff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1e3a5f;padding:24px 32px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${data.companyName}</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Payslip Notification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#1a2a3a;line-height:1.5;">
                Dear ${data.employeeName},
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#4a5568;line-height:1.6;">
                Please find attached your payslip for the period of <strong style="color:#1a2a3a;">${data.period}</strong>.
              </p>

              <!-- Info Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f0f4f8;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:12px;color:#6b7a8d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Pay Period</td>
                        <td style="font-size:12px;color:#6b7a8d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;text-align:right;">Payment Date</td>
                      </tr>
                      <tr>
                        <td style="font-size:14px;color:#1a2a3a;font-weight:600;">${data.period}</td>
                        <td style="font-size:14px;color:#1a2a3a;font-weight:600;text-align:right;">${data.payDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#4a5568;line-height:1.6;">
                Your payslip is attached to this email as a PDF document. If you have any questions regarding your pay, please contact your HR or payroll administrator.
              </p>

              <p style="margin:24px 0 0;font-size:14px;color:#4a5568;line-height:1.6;">
                Best regards,<br>
                <strong style="color:#1a2a3a;">${data.companyName} Payroll</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#8a9aaa;line-height:1.5;">
                This is an automated message from ClinicPay. Please do not reply to this email.<br>
                Confidential: This payslip contains personal salary information.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
