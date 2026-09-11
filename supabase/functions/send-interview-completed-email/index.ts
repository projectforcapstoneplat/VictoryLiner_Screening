// Notifies HR the moment an applicant finishes recording every assigned
// video question — until now this was completely silent: HR only found out
// by happening to open a dashboard and noticing the "ready for decision"
// queue grew (see getPersonnelOverview in src/lib/reports.js). That's a
// pull, not a push — an applicant could finish their interview and just sit
// there, unreviewed, until HR happened to look. Called by the applicant's
// own client right after their last answer uploads (src/pages/Interview.jsx)
// — best-effort, a failed send here never blocks the applicant from seeing
// their own "You're All Done!" screen.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return json({ error: 'Not authenticated.' }, 401);
    }

    const { applicationId } = await req.json();
    if (!applicationId) {
      return json({ error: 'applicationId is required.' }, 400);
    }

    // No separate ownership check needed — applications' own RLS policy
    // already restricts an applicant's select to `applicant_id = auth.uid()`
    // (see 0002_applications.sql), so a row only comes back here at all if
    // this caller is the applicant on it.
    const { data: application, error: appError } = await callerClient
      .from('applications')
      .select('full_name, job_postings(title)')
      .eq('id', applicationId)
      .single();
    if (appError || !application) {
      return json({ error: 'Application not found.' }, 404);
    }

    const jobTitle = application.job_postings?.title || 'a job posting';
    const siteUrl = Deno.env.get('ALLOWED_ORIGIN');
    const link = siteUrl && siteUrl !== '*' ? `${siteUrl}/?screen=hr-decisions` : null;

    // Every active HR account, not just Personnel — HR Head has no decide
    // button, but they're the ones who'd notice if Personnel is falling
    // behind, same audience send-interview-reminders (applicant-facing,
    // different trigger) doesn't need to reason about.
    const { data: hrProfiles } = await adminClient
      .from('profiles')
      .select('email')
      .in('role', ['hr_personnel', 'hr_head'])
      .eq('is_active', true);
    const hrEmails = (hrProfiles || []).map((p) => p.email).filter(Boolean);

    if (!resendKey) {
      return json({ sent: false, error: 'Email is not configured yet (missing RESEND_API_KEY secret).' }, 501);
    }
    if (hrEmails.length === 0) {
      return json({ sent: false, error: 'No active HR accounts to notify.' }, 200);
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: hrEmails,
        subject: `Video interview ready to review — ${application.full_name || 'an applicant'} (${jobTitle})`,
        html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">
          <p><strong>${application.full_name || 'An applicant'}</strong> just finished their video interview for <strong>${jobTitle}</strong> — every question is answered and ready for your review.</p>
          ${link ? `<p><a href="${link}" style="color:#c0152f;font-weight:700;">Review it on the Decisions tab</a></p>` : ''}
          <p style="margin-top:24px;color:#888;font-size:13px;">Victory Liner Careers — HR Command Center</p>
        </div>`,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json().catch(() => ({}));
      return json({ sent: false, error: errBody.message || 'Failed to send email.' }, 502);
    }

    return json({ sent: true, notifiedCount: hrEmails.length });
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
