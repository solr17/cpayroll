/**
 * Email service abstraction using nodemailer with SMTP transport.
 *
 * Configuration via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * If env vars are not set, logs a warning and returns false (does not crash).
 */

import nodemailer from "nodemailer";

export interface EmailAttachment {
  filename: string;
  content: Buffer | Uint8Array;
  contentType: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: parseInt(port ?? "587", 10),
    user,
    pass,
    from: from ?? `ClinicPay <${user}>`,
  };
}

/**
 * Send an email. Returns true on success, false on failure.
 * Never throws — failures are logged and returned as false.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const config = getSmtpConfig();

  if (!config) {
    console.warn(
      "[email] SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables. Email not sent to:",
      options.to,
    );
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    const mailOptions: nodemailer.SendMailOptions = {
      from: config.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    if (options.attachments && options.attachments.length > 0) {
      mailOptions.attachments = options.attachments.map((att) => ({
        filename: att.filename,
        content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content),
        contentType: att.contentType,
      }));
    }

    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error(
      "[email] Failed to send email to",
      options.to,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
