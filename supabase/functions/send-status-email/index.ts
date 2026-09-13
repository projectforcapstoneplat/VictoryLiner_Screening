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

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// `link`, when available, points straight at the applicant's own next step —
// My Applications for a status they need to go check on, the matches page
// for a decline (where "apply for other open roles" is actually actionable)
// — rather than making them navigate there themselves from a bare "sign in"
// instruction. Null when ALLOWED_ORIGIN isn't configured (local/testing),
// since there'd be no real domain to link to.
const STATUS_CONTENT: Record<string, (jobTitle: string, link: string | null) => { subject: string; body: string }> = {
  interview_stage: (jobTitle, link) => ({
    subject: `Update on your application for ${jobTitle}`,
    body: `Good news — HR has reviewed your resume for <strong>${jobTitle}</strong> and moved your application to the next stage. ` +
      (link
        ? `<a href="${link}" style="color:#c0152f;font-weight:700;">Sign in to My Applications</a> to check whether your video interview is ready to start.`
        : `Sign in to My Applications to check whether your video interview is ready to start.`),
  }),
  advanced: (jobTitle, link) => ({
    subject: `You've advanced — ${jobTitle}`,
    body: `Congratulations! Your application for <strong>${jobTitle}</strong> has been advanced to the next step. Our HR team will reach out with details.` +
      (link ? ` <a href="${link}" style="color:#c0152f;font-weight:700;">View your application</a>.` : ''),
  }),
  declined: (jobTitle, link) => ({
    subject: `Update on your application for ${jobTitle}`,
    body: `Thank you for your interest in <strong>${jobTitle}</strong>. After careful review, we won't be moving forward with your application at this time. ` +
      `We encourage you to apply for other open roles that match your background.` +
      (link ? ` <a href="${link}" style="color:#c0152f;font-weight:700;">Browse roles that match you</a>.` : ''),
  }),
};

const LINK_SCREEN: Record<string, string> = {
  interview_stage: 'my-applications',
  advanced: 'my-applications',
  declined: 'matches',
};

Deno.serve(async (req) => {
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

    const { applicationId, status } = await req.json();
    if (!applicationId || !STATUS_CONTENT[status]) {
      return json({ error: 'applicationId and a valid status are required.' }, 400);
    }

    const { data: application, error: appError } = await callerClient
      .from('applications')
      .select('email, full_name, job_postings(title)')
      .eq('id', applicationId)
      .single();
    if (appError || !application?.email) {
      return json({ error: 'Application not found.' }, 404);
    }

    const jobTitle = application.job_postings?.title || 'the role you applied for';
    const siteUrl = Deno.env.get('ALLOWED_ORIGIN');
    const link = siteUrl && siteUrl !== '*' ? `${siteUrl}/?screen=${LINK_SCREEN[status]}` : null;
    const { subject, body } = STATUS_CONTENT[status](jobTitle, link);

    const result = await sendEmail({
      to: application.email,
      subject,
      html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">
        <p>Hi ${application.full_name || 'there'},</p>
        <p>${body}</p>
        <p style="margin-top:24px;color:#888;font-size:13px;">Victory Liner Careers</p>
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
