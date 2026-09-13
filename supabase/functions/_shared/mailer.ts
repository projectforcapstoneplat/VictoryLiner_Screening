// Sends an email via a real Gmail SMTP connection instead of a third-party
// email API (Resend, EmailJS) — a regular Gmail account allows roughly 500
// sends/day (~15,000/month), well above any free-tier API's cap, and it's
// entirely free with no separate account/dashboard to configure.
//
// Uses denomailer, not Nodemailer — Nodemailer is built on Node's raw socket
// APIs, which don't reliably translate through Deno's npm-compatibility
// layer inside a constrained edge-function runtime. denomailer is a
// Deno-native SMTP client built for exactly this environment, so this
// keeps the actual goal (send straight over SMTP, no third-party API)
// without betting on an npm shim working correctly here.
//
// Every caller already builds a plain {to, subject, html} — same shape
// Resend/EmailJS took — so this is the only file that needs to know how the
// email actually gets sent. Requires two secrets: GMAIL_USER (the sending
// Gmail address) and GMAIL_APP_PASSWORD (a 16-character App Password from
// Google Account -> Security -> 2-Step Verification -> App Passwords —
// this requires 2FA enabled on the account first, and is NOT the account's
// normal login password).
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

export async function sendEmail(
  { to, subject, html, fromName = 'Victory Liner Careers' }: { to: string; subject: string; html: string; fromName?: string },
): Promise<{ ok: boolean; status: number; error?: string }> {
  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');

  if (!gmailUser || !gmailAppPassword) {
    return { ok: false, status: 501, error: 'Email is not configured yet (missing GMAIL_USER/GMAIL_APP_PASSWORD secrets).' };
  }

  // A fresh connection per call, not a shared/pooled client — each edge
  // function invocation is its own isolated serverless execution, so there's
  // no long-lived process to hold a persistent SMTP connection across calls.
  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: gmailUser, password: gmailAppPassword },
    },
  });

  try {
    await client.send({
      from: `${fromName} <${gmailUser}>`,
      to,
      subject,
      content: 'auto',
      html,
    });
    return { ok: true, status: 200 };
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof Error ? err.message : 'Failed to send email via Gmail SMTP.' };
  } finally {
    // Best-effort — an already-broken connection failing to close cleanly
    // shouldn't mask the real send error/success determined above.
    try {
      await client.close();
    } catch {
      /* already closed or never opened */
    }
  }
}
