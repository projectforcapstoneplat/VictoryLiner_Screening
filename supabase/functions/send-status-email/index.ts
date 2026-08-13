// Notifies an applicant by email when their application status changes
// (advanced to interview stage, advanced to next step, or declined) — the
// system otherwise only ever surfaces this in-app on My Applications, which
// applicants have no reason to keep re-checking. Called by HR's own client
// right after a successful updateApplicationStatus (src/lib/applications.js)
// — best-effort: a failed send here never undoes the status change that
// already happened, it just means the applicant finds out next time they
// check the site instead of by email.
//
// Uses Resend's REST API directly rather than Supabase's built-in email —
// that's auth-flow-only (signup confirmation, password reset) and has no
// API for sending arbitrary custom-content notifications like this one.
// Requires the RESEND_API_KEY secret (supabase secrets set RESEND_API_KEY=...).
// RESEND_FROM_EMAIL defaults to Resend's shared test address, which only
// delivers reliably to your own verified account — swap in a real address
// on your own verified domain once you have one (see supabase/README.md).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATUS_CONTENT: Record<string, (jobTitle: string) => { subject: string; body: string }> = {
  interview_stage: (jobTitle) => ({
    subject: `Update on your application for ${jobTitle}`,
    body: `Good news — HR has reviewed your resume for <strong>${jobTitle}</strong> and moved your application to the next stage. ` +
      `Sign in to My Applications to check whether your video interview is ready to start.`,
  }),
  advanced: (jobTitle) => ({
    subject: `You've advanced — ${jobTitle}`,
    body: `Congratulations! Your application for <strong>${jobTitle}</strong> has been advanced to the next step. Our HR team will reach out with details.`,
  }),
  declined: (jobTitle) => ({
    subject: `Update on your application for ${jobTitle}`,
    body: `Thank you for your interest in <strong>${jobTitle}</strong>. After careful review, we won't be moving forward with your application at this time. ` +
      `We encourage you to apply for other open roles that match your background.`,
  }),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Victory Liner Careers <onboarding@resend.dev>';

    if (!resendKey) {
      return json({ error: 'Email is not configured yet (missing RESEND_API_KEY secret).' }, 501);
    }

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
    const { subject, body } = STATUS_CONTENT[status](jobTitle);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: application.email,
        subject,
        html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">
          <p>Hi ${application.full_name || 'there'},</p>
          <p>${body}</p>
          <p style="margin-top:24px;color:#888;font-size:13px;">Victory Liner Careers</p>
        </div>`,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json().catch(() => ({}));
      return json({ error: errBody.message || 'Failed to send email.' }, 502);
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
