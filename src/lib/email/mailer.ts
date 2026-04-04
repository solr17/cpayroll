/**
 * Simplified email interface for ClinicPay.
 *
 * Wraps the full email service with a simpler (to, subject, html) signature
 * for common use cases that don't need attachments.
 *
 * Configuration via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * If SMTP vars are not set, logs the email to console (dev fallback).
 */

import { sendEmail as sendEmailFull } from "./service";
import logger from "@/lib/logger";

/**
 * Send an email with a simple signature.
 *
 * In development (no SMTP configured), logs the email to console.
 * Never throws — failures are logged to console.error.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const smtpConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

  if (!smtpConfigured) {
    logger.info(
      { to, subject, bodyLength: html.length },
      "SMTP not configured — email logged instead of sent",
    );
    return;
  }

  const success = await sendEmailFull({ to, subject, html });
  if (!success) {
    logger.error({ to, subject }, "Failed to send email");
  }
}

export { sendEmailFull };
