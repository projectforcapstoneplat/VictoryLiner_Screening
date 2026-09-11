// Notifies an applicant — by email AND an in-website notification, same
// dual-channel pattern as match-job-to-resumes — the moment HR schedules
// their personal (in-person) interview. This isn't an applications.status
// change, so it doesn't fit send-status-email's STATUS_CONTENT map: it
// needs the actual date/time/location HR just picked, not a fixed
// template. Called by HR's own client right after a successful
// scheduleInterview (src/lib/applications.js) — best-effort, a failed send
// here never undoes the schedule that was just saved.
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

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!callerProfile || !['hr_personnel', 'hr_head'].includes(callerProfile.role)) {
      return json({ error: 'Only HR can trigger applicant notifications.' }, 403);
    }

    const { applicationId, scheduledAt, location, notes } = await req.json();
    if (!applicationId || !scheduledAt) {
      return json({ error: 'applicationId and scheduledAt are required.' }, 400);
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
    const link = siteUrl && siteUrl !== '*' ? `${siteUrl}/?screen=my-applications` : null;

    const formattedWhen = new Date(scheduledAt).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      timeZone: 'Asia/Manila',
    });

    // In-website notification first — same trigger point as the email
    // below, so the applicant sees this on their next visit even if the
    // email never arrives (spam filter, mistyped address, RESEND_API_KEY
    // not configured yet, etc.). Uses the service-role client since
    // applicant_notifications has no applicant-facing insert policy.
    let notified = false;
    if (application.applicant_id) {
      const { error: notifyError } = await adminClient.from('applicant_notifications').insert({
        applicant_id: application.applicant_id,
        job_id: application.job_id,
        title: `Your personal interview is scheduled — ${jobTitle}`,
        body: `HR has scheduled your in-person interview at the Cubao station for ${formattedWhen}.${location ? ` Location: ${location}.` : ''}`,
      });
      notified = !notifyError;
    }

    if (!resendKey) {
      return json({ notified, sent: false, error: 'Email is not configured yet (missing RESEND_API_KEY secret).' }, notified ? 200 : 501);
    }

    const detailRows = [
      `<tr><td style="padding:4px 12px 4px 0;color:#888;">When</td><td style="padding:4px 0;font-weight:700;">${formattedWhen}</td></tr>`,
      location ? `<tr><td style="padding:4px 12px 4px 0;color:#888;">Where</td><td style="padding:4px 0;">${location}</td></tr>` : '',
      notes ? `<tr><td style="padding:4px 12px 4px 0;color:#888;vertical-align:top;">Notes</td><td style="padding:4px 0;">${notes}</td></tr>` : '',
    ].filter(Boolean).join('');

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: application.email,
        subject: `Your personal interview is scheduled — ${jobTitle}`,
        html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">
          <p>Hi ${application.full_name || 'there'},</p>
          <p>Congratulations — HR has scheduled your personal interview for <strong>${jobTitle}</strong>.</p>
          <table style="margin:16px 0;border-collapse:collapse;">${detailRows}</table>
          <p>Please arrive on time and bring any documents HR may have requested.</p>
          ${link ? `<p><a href="${link}" style="color:#c0152f;font-weight:700;">View your application</a></p>` : ''}
          <p style="margin-top:24px;color:#888;font-size:13px;">Victory Liner Careers</p>
        </div>`,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json().catch(() => ({}));
      return json({ notified, sent: false, error: errBody.message || 'Failed to send email.' }, 502);
    }

    return json({ notified, sent: true });
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
