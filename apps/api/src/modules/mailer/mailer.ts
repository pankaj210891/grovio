import nodemailer from "nodemailer";
import type { Env } from "../../config/env.js";

/**
 * Typed alias for the nodemailer Transporter — used for Awilix injection
 * and for the `mailer` dep in CustomerAuthService.
 */
export type Mailer = nodemailer.Transporter;

/**
 * createMailerTransport
 *
 * Factory that returns a nodemailer transport configured for the current environment.
 *
 * Behavior:
 * - When SMTP_HOST, SMTP_USER, and SMTP_PASS are ALL set: returns a real SMTP transport
 *   configured for port 587 (STARTTLS) — suitable for Gmail "App Password" auth (D-07).
 * - When ANY of the three SMTP vars is missing: returns a jsonTransport stub that resolves
 *   `sendMail()` calls without sending — the API boots and operates correctly without email
 *   configuration.
 *
 * The CustomerAuthService dev fallback (logging the reset link to console) handles the
 * no-SMTP case at the application layer. This factory never throws on missing config.
 *
 * Covers: SMTP env vars from Plan 04-02, nodemailer dependency from Plan 04-01.
 */
export function createMailerTransport(env: Env): Mailer {
  const isSmtpConfigured =
    Boolean(env.SMTP_HOST) && Boolean(env.SMTP_USER) && Boolean(env.SMTP_PASS);

  if (isSmtpConfigured) {
    // Real SMTP transport — Gmail uses port 587 with STARTTLS (secure: false)
    return nodemailer.createTransport({
      host: env.SMTP_HOST!,
      port: 587,
      secure: false, // STARTTLS — Gmail app password flow
      auth: {
        user: env.SMTP_USER!,
        pass: env.SMTP_PASS!,
      },
    });
  }

  // Dev/test fallback: jsonTransport resolves sendMail without sending anything.
  // CustomerAuthService handles the "no SMTP" case by logging the reset link instead.
  return nodemailer.createTransport({ jsonTransport: true });
}
