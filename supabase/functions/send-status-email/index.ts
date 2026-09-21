// Notifies an applicant by email when their application status changes
// (advanced to interview stage, advanced to next step, or declined) — the
// system otherwise only ever surfaces this in-app on My Applications, which
// applicants have no reason to keep re-checking. Called by HR's own client
// right after a successful updateApplicationStatus (src/lib/applications.js)
// — best-effort: a failed send here never undoes the status change that
// already happened, it just means the applicant finds out next time they
// check the site instead of by email.
//
// Sends over real Gmail SMTP rather than Supabase's built-in email — that's
// auth-flow-only (signup confirmation, password reset) and has no API for
// sending arbitrary custom-content notifications like this one. See
// supabase/functions/_shared/mailer.ts for the required secrets.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/mailer.ts';

import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

// `ctaLabel` pairs with `link` (built once below, common to every status)
// for a single button rendered under the message, same shape as the
// scheduled-interview and job-match emails' CTA — no more inline links
// buried mid-sentence, so every applicant-facing email actually looks like
// the same product instead of an older, plainer one.
const STATUS_CONTENT: Record<string, (jobTitle: string, extra: { hadSchedule?: boolean }) => { subject: string; bodyHtml: string; ctaLabel: string }> = {
  interview_stage: (jobTitle) => ({
    subject: `Update on your application for ${jobTitle}`,
    bodyHtml: `Good news! HR has reviewed your resume for <strong>${jobTitle}</strong> and moved your application to the next stage.`,
    ctaLabel: 'Sign In to My Applications',
  }),
  advanced: (jobTitle) => ({
    subject: `You've advanced: ${jobTitle}`,
    bodyHtml: `Congratulations! Your application for <strong>${jobTitle}</strong> has been advanced to the next step. Our HR team will reach out with details.`,
    ctaLabel: 'View Your Application',
  }),
  declined: (jobTitle) => ({
    subject: `Update on your application for ${jobTitle}`,
    bodyHtml: `Thank you so much for taking the time to apply for <strong>${jobTitle}</strong> and for your interest in Victory Liner Careers. After carefully reviewing your application, we've decided to move forward with other candidates whose current experience is a closer match for this particular role. This decision isn't a reflection of your skills or potential, and we'd genuinely love for you to apply again for future openings that fit your background. Thank you again, and we wish you the best in your job search.`,
    ctaLabel: 'Browse Roles That Might Be a Great Fit',
  }),
  // The only place an application's status ever moves back to 'submitted'
  // is HrApplicantsList.jsx's Reopen action (handleDecide(id, 'submitted')
  // — see its own ConfirmModal there), so this key is an unambiguous signal
  // for "reopened," never a first-time submission (quickApply never calls
  // this function at all). `hadSchedule` (set by the caller based on
  // whether scheduled_interview_at was already set before this reopen —
  // updateApplicationStatus clears it as part of the same reopen write)
  // swaps in copy that actually says the personal interview was canceled,
  // instead of a generic "reopened" message that silently ignores it.
  submitted: (jobTitle, { hadSchedule }) => ({
    subject: hadSchedule
      ? `Your scheduled interview has been canceled: ${jobTitle}`
      : `Your application for ${jobTitle} has been reopened`,
    bodyHtml: hadSchedule
      ? `Your previously scheduled personal interview for <strong>${jobTitle}</strong> has been canceled. HR is taking another look at your application for further consideration.`
      : `Good news! HR has reopened your application for <strong>${jobTitle}</strong> for reconsideration.`,
    ctaLabel: 'Sign In to My Applications',
  }),
};

const LINK_SCREEN: Record<string, string> = {
  interview_stage: 'my-applications',
  advanced: 'my-applications',
  declined: 'matches',
  submitted: 'my-applications',
};

// Short, plain-text counterparts to STATUS_CONTENT above, for the
// notification bell rather than an email body — no HTML, no link (the bell
// itself already routes a click straight to My Applications, see
// migration 0040_applicant_notifications_type.sql).
const NOTIFICATION_CONTENT: Record<string, (jobTitle: string, extra: { hadSchedule?: boolean }) => { title: string; body: string }> = {
  interview_stage: (jobTitle) => ({
    title: `You've moved to the next stage — ${jobTitle}`,
    body: 'HR reviewed your resume and you’re through to the video interview. Check My Applications to get started.',
  }),
  advanced: (jobTitle) => ({
    title: `You've advanced — ${jobTitle}`,
    body: 'Congratulations! Our HR team will reach out with next steps.',
  }),
  declined: (jobTitle) => ({
    title: `Update on your application — ${jobTitle}`,
    body: 'We’ve decided to move forward with other candidates for this one, but we’d love to see you apply again — other open roles may still be a great fit for you.',
  }),
  submitted: (jobTitle, { hadSchedule }) => ({
    title: hadSchedule ? `Your interview has been canceled — ${jobTitle}` : `Your application has been reopened — ${jobTitle}`,
    body: hadSchedule
      ? 'Your scheduled personal interview has been canceled and HR is taking another look at your application. Check My Applications for the latest status.'
      : 'HR has reopened your application for reconsideration. Check My Applications for the latest status.',
  }),
};

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return json({ error: 'Not authenticated.' }, 401);
    }

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!callerProfile || !['hr_personnel', 'hr_head'].includes(callerProfile.role)) {
      return json({ error: 'Only HR can trigger applicant notifications.' }, 403);
    }

    const { applicationId, status, hadSchedule } = await req.json();
    if (!applicationId || !STATUS_CONTENT[status]) {
      return json({ error: 'applicationId and a valid status are required.' }, 400);
    }

    const { data: application, error: appError } = await callerClient
      .from('applications')
      .select('applicant_id, job_id, email, full_name, job_postings(title)')
      .eq('id', applicationId)
      .single();
    if (appError || !application?.email) {
      return json({ error: 'Application not found.' }, 404);
    }

    const jobTitle = application.job_postings?.title || 'the role you applied for';
    const siteUrl = Deno.env.get('ALLOWED_ORIGIN');
    const link = siteUrl && siteUrl !== '*' ? `${siteUrl}/?screen=${LINK_SCREEN[status]}` : null;
    const { subject, bodyHtml, ctaLabel } = STATUS_CONTENT[status](jobTitle, { hadSchedule });

    // Written before the email send attempt, not after — this is the
    // applicant's only notice of the status change that doesn't depend on
    // an email actually reaching them. Gmail's SMTP relay accepts a message
    // for a nonexistent mailbox the same way it accepts a real one (the
    // bounce comes back later, asynchronously, to GMAIL_USER's own inbox —
    // sendEmail() below has no visibility into that), so a bad address on
    // file used to mean the applicant found out nothing at all, on either
    // channel. applicant_notifications has no applicant-facing insert
    // policy (system-generated only — see 0026_applicant_notifications.sql),
    // so this needs the service-role client, same reasoning as every other
    // on-someone-else's-behalf write in this codebase (resume_evaluations,
    // resume_job_matches, applicant_notifications from match-job-to-resumes).
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { title: notifTitle, body: notifBody } = NOTIFICATION_CONTENT[status](jobTitle, { hadSchedule });
    const { error: notifError } = await adminClient.from('applicant_notifications').insert({
      applicant_id: application.applicant_id,
      job_id: application.job_id,
      type: 'status_change',
      title: notifTitle,
      body: notifBody,
    });
    if (notifError) {
      console.error('send-status-email: failed to write in-app notification', notifError);
    }

    // Same branded card shell as send-interview-scheduled-email and the
    // job-match email (red header bar, white card, pill CTA) — this used to
    // be a bare unstyled div, the one applicant-facing email template that
    // still looked like an older, different product.
    const result = await sendEmail({
      to: application.email,
      subject,
      html: `<div style="background:#f4f4f4;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
          <div style="background:#c0152f;padding:26px 32px;text-align:center;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Victory Liner Careers</span>
          </div>
          <div style="padding:32px;">
            <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;">Hi ${application.full_name || 'there'},</p>
            <p style="font-size:15px;color:#1a1a1a;line-height:1.6;margin:0 0 ${link ? '24px' : '0'};">${bodyHtml}</p>
            ${link ? `<div style="text-align:center;"><a href="${link}" style="display:inline-block;background:#c0152f;color:#ffffff;font-weight:700;font-size:14px;padding:13px 30px;border-radius:999px;text-decoration:none;">${ctaLabel}</a></div>` : ''}
          </div>
          <div style="padding:18px 32px;border-top:1px solid #eeeeee;text-align:center;">
            <span style="font-size:12px;color:#999999;">Victory Liner Careers</span>
          </div>
        </div>
      </div>`,
    });

    if (!result.ok) {
      return json({ error: result.error || 'Failed to send email.' }, result.status || 502);
    }

    return json({ sent: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});
