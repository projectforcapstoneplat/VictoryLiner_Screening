// Notifies an applicant — by email AND an in-website notification, same
// dual-channel pattern as match-job-to-resumes — the moment HR schedules
// their personal (in-person) interview. This isn't an applications.status
// change, so it doesn't fit send-status-email's STATUS_CONTENT map: it
// needs the actual date/time/location HR just picked, not a fixed
// template. Called by HR's own client right after a successful
// scheduleInterview (src/lib/applications.js) — best-effort, a failed send
// here never undoes the schedule that was just saved.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/mailer.ts';

import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

// Same for every applicant, every job — scheduling only ever collects a
// date/time/location now (see HrApplicantsList.jsx's SchedulePanel, which
// dropped its old free-text "notes for the applicant" field), so what to
// actually bring stopped being something HR types per-person and became a
// fixed checklist instead.
const WHAT_TO_BRING = [
  'A valid government-issued ID',
  'A printed copy of your resume',
  'Original and photocopy of any relevant certificates or licenses (e.g. Driver’s License, NBI Clearance)',
  'Smart casual attire',
];

// "Quick add" event URL — no Google account access needed on our end, no
// API key, just a pre-filled form the applicant's own browser opens.
// Google's own dates param wants UTC in YYYYMMDDTHHMMSSZ; scheduledAt is
// already a UTC ISO string, so this just reformats it. No stored duration
// anywhere in this app's schema, so this assumes a 1-hour interview.
function toGCalUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function buildGoogleCalendarLink(jobTitle: string, scheduledAt: string, location: string | null): string {
  const start = toGCalUtc(scheduledAt);
  const end = toGCalUtc(new Date(new Date(scheduledAt).getTime() + 60 * 60 * 1000).toISOString());
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Personal Interview: ${jobTitle}`,
    dates: `${start}/${end}`,
    details: `Victory Liner Careers personal interview for ${jobTitle}. Bring a valid ID, a printed resume, and any relevant certificates or licenses.`,
    location: location || 'Victory Liner Careers',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

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

    const { applicationId, scheduledAt, location, isReschedule } = await req.json();
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
    // email never arrives (spam filter, mistyped address, Gmail SMTP not
    // configured yet, etc.). Uses the service-role client since
    // applicant_notifications has no applicant-facing insert policy.
    let notified = false;
    if (application.applicant_id) {
      const { error: notifyError } = await adminClient.from('applicant_notifications').insert({
        applicant_id: application.applicant_id,
        job_id: application.job_id,
        title: isReschedule ? `Your personal interview has been rescheduled: ${jobTitle}` : `Your personal interview is scheduled: ${jobTitle}`,
        body: `HR has ${isReschedule ? 're' : ''}scheduled your in-person interview for ${formattedWhen}${location ? ` at ${location}` : ''}.`,
      });
      notified = !notifyError;
    }

    const gcalLink = buildGoogleCalendarLink(jobTitle, scheduledAt, location || null);
    const checklistHtml = WHAT_TO_BRING.map((item) => `<li style="margin-bottom:6px;">${item}</li>`).join('');

    // Same branded card shell as the match-job-to-resumes email (red header
    // bar, white card, pill CTAs) — this one used to be a bare unstyled div,
    // the one part of the scheduling flow that still looked unfinished next
    // to every other applicant-facing email.
    const result = await sendEmail({
      to: application.email,
      subject: isReschedule ? `Your personal interview has been rescheduled: ${jobTitle}` : `Your personal interview is scheduled: ${jobTitle}`,
      html: `<div style="background:#f4f4f4;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
          <div style="background:#c0152f;padding:26px 32px;text-align:center;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Victory Liner Careers</span>
          </div>
          <div style="padding:32px;">
            <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;">Hi ${application.full_name || 'there'},</p>
            <p style="font-size:15px;color:#1a1a1a;line-height:1.6;margin:0 0 20px;">${
              isReschedule
                ? `Your personal interview for <strong>${jobTitle}</strong> has been rescheduled. Here are the updated details.`
                : `Congratulations! HR has scheduled your personal interview for <strong>${jobTitle}</strong>.`
            }</p>
            <div style="background:#fdf0f1;border-radius:10px;padding:18px 20px;margin:0 0 22px;">
              <div style="margin-bottom:${location ? '10px' : '0'};">
                <span style="display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c0152f;">When</span>
                <span style="display:block;font-size:16px;font-weight:700;color:#1a1a1a;margin-top:2px;">${formattedWhen}</span>
              </div>
              ${location ? `<div><span style="display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c0152f;">Where</span><span style="display:block;font-size:16px;font-weight:700;color:#1a1a1a;margin-top:2px;">${location}</span></div>` : ''}
            </div>
            <p style="font-size:13px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">What to bring</p>
            <ul style="font-size:14px;color:#1a1a1a;line-height:1.5;margin:0 0 26px;padding-left:20px;">${checklistHtml}</ul>
            <div style="text-align:center;margin:0 0 10px;">
              <a href="${gcalLink}" style="display:inline-block;background:#ffffff;color:#c0152f;font-weight:700;font-size:14px;padding:12px 28px;border-radius:999px;text-decoration:none;border:1.5px solid #c0152f;">Add to Google Calendar</a>
            </div>
            ${link ? `<div style="text-align:center;"><a href="${link}" style="display:inline-block;background:#c0152f;color:#ffffff;font-weight:700;font-size:14px;padding:13px 30px;border-radius:999px;text-decoration:none;">View Your Application</a></div>` : ''}
          </div>
          <div style="padding:18px 32px;border-top:1px solid #eeeeee;text-align:center;">
            <span style="font-size:12px;color:#999999;">Victory Liner Careers</span>
          </div>
        </div>
      </div>`,
    });

    if (!result.ok) {
      return json({ notified, sent: false, error: result.error || 'Failed to send email.' }, notified ? 200 : (result.status || 502));
    }

    return json({ notified, sent: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});
