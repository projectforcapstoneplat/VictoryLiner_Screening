// Cron-only for the real daily batch — reminds an applicant by email 1 day
// before their scheduled personal (in-person) interview
// (applications.scheduled_interview_at, set by HR via scheduleInterview in
// src/lib/applications.js). Distinct from send-interview-reminders, which
// nags about the video-screening upload deadline, not an actual appointment
// date. Meant to run daily via Supabase's Cron Jobs, authenticated against
// the service-role key since no interactive user is behind a cron trigger.
//
// Also reachable by an authenticated HR account with an explicit
// `applicationId` — a one-off preview send for that specific applicant,
// bypassing the real batch's 24h window and already-sent gate. Never
// touches scheduled_interview_reminder_sent_at, so it can't suppress or
// duplicate the real cron's own bookkeeping for that applicant.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/mailer.ts';
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

// One invocation can in principle need to check every applicant with an
// upcoming scheduled interview — cap it so a large pool can't blow through
// the function's execution time in one run. Anyone left uncapped simply
// gets picked up on tomorrow's run instead (their interview is further out
// either way, since this only ever looks at the next ~24 hours).
const MAX_PER_CALL = 100;

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const isCron = authHeader === `Bearer ${serviceRoleKey}`;

    let previewApplicationId: string | null = null;
    if (!isCron) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await callerClient.auth.getUser();
      if (!user) return json(corsHeaders, { error: 'Not authorized.' }, 401);
      const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', user.id).single();
      if (!callerProfile || !['hr_personnel', 'hr_head'].includes(callerProfile.role)) {
        return json(corsHeaders, { error: 'Not authorized.' }, 403);
      }
      const body = await req.json().catch(() => ({}));
      if (!body.applicationId) return json(corsHeaders, { error: 'applicationId is required for a preview send.' }, 400);
      previewApplicationId = body.applicationId;
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const siteUrl = Deno.env.get('ALLOWED_ORIGIN');
    const link = siteUrl && siteUrl !== '*' ? `${siteUrl}/?screen=my-applications` : null;

    if (previewApplicationId) {
      const { data: app, error: appError } = await adminClient
        .from('applications')
        .select('id, email, full_name, scheduled_interview_at, scheduled_interview_location, job_postings(title)')
        .eq('id', previewApplicationId)
        .single();
      if (appError || !app?.email || !app.scheduled_interview_at) {
        return json(corsHeaders, { error: 'Application not found or has no scheduled interview.' }, 404);
      }
      const jobTitle = app.job_postings?.title || 'the role you applied for';
      const sent = await sendReminderEmail(app.email, app.full_name, jobTitle, app.scheduled_interview_at, app.scheduled_interview_location, link);
      if (!sent) return json(corsHeaders, { preview: true, sent: false, error: 'Failed to send email.' }, 502);
      return json(corsHeaders, { preview: true, sent: true });
    }

    // A daily cron catches "happens within the next 24h" once per day, so
    // anyone whose interview lands tomorrow (relative to whenever today's
    // run happens to fire) gets exactly one reminder, roughly a day out.
    // The lower bound excludes interviews that have already passed, in case
    // a run was ever missed.
    const now = new Date();
    const in24h = new Date(now.getTime() + DAY_MS);

    const { data: candidates, error: candidatesError } = await adminClient
      .from('applications')
      .select('id, email, full_name, scheduled_interview_at, scheduled_interview_location, job_postings(title)')
      .not('scheduled_interview_at', 'is', null)
      .gt('scheduled_interview_at', now.toISOString())
      .lte('scheduled_interview_at', in24h.toISOString())
      .is('scheduled_interview_reminder_sent_at', null)
      .limit(MAX_PER_CALL);
    if (candidatesError) {
      return json(corsHeaders, { error: candidatesError.message }, 500);
    }

    let remindedCount = 0;
    for (const app of candidates ?? []) {
      if (!app.email) continue;

      const jobTitle = app.job_postings?.title || 'the role you applied for';
      const sent = await sendReminderEmail(app.email, app.full_name, jobTitle, app.scheduled_interview_at, app.scheduled_interview_location, link);
      if (sent) {
        remindedCount += 1;
        await adminClient.from('applications').update({ scheduled_interview_reminder_sent_at: new Date().toISOString() }).eq('id', app.id);
      }
    }

    return json(corsHeaders, { checked: candidates?.length ?? 0, reminded: remindedCount });
  } catch (err) {
    return json(buildCorsHeaders(req), { error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

// Same branded card shell as every other applicant-facing email in this app.
async function sendReminderEmail(
  toEmail: string,
  fullName: string | null,
  jobTitle: string,
  scheduledAt: string,
  location: string | null,
  link: string | null,
): Promise<boolean> {
  const formattedWhen = new Date(scheduledAt).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
  const result = await sendEmail({
    to: toEmail,
    subject: `Reminder: your interview is tomorrow (${jobTitle})`,
    html: `<div style="background:#f4f4f4;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
        <div style="background:#c0152f;padding:26px 32px;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Victory Liner Careers</span>
        </div>
        <div style="padding:32px;">
          <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;">Hi ${fullName || 'there'},</p>
          <p style="font-size:15px;color:#1a1a1a;line-height:1.6;margin:0 0 20px;">This is a reminder that your personal interview for <strong>${jobTitle}</strong> is coming up.</p>
          <div style="background:#fdf0f1;border-radius:10px;padding:18px 20px;margin:0 0 22px;">
            <div style="margin-bottom:${location ? '10px' : '0'};">
              <span style="display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c0152f;">When</span>
              <span style="display:block;font-size:16px;font-weight:700;color:#1a1a1a;margin-top:2px;">${formattedWhen}</span>
            </div>
            ${location ? `<div><span style="display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c0152f;">Where</span><span style="display:block;font-size:16px;font-weight:700;color:#1a1a1a;margin-top:2px;">${location}</span></div>` : ''}
          </div>
          <p style="font-size:14px;color:#1a1a1a;line-height:1.5;margin:0 0 22px;">Please arrive on time and bring any documents HR may have requested.</p>
          ${link ? `<div style="text-align:center;"><a href="${link}" style="display:inline-block;background:#c0152f;color:#ffffff;font-weight:700;font-size:14px;padding:13px 30px;border-radius:999px;text-decoration:none;">View Your Application</a></div>` : ''}
        </div>
        <div style="padding:18px 32px;border-top:1px solid #eeeeee;text-align:center;">
          <span style="font-size:12px;color:#999999;">Victory Liner Careers</span>
        </div>
      </div>
    </div>`,
  });
  return result.ok;
}

function json(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
