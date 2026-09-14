// Cron-only — reminds an applicant by email 1 day before their scheduled
// personal (in-person) interview (applications.scheduled_interview_at, set
// by HR via scheduleInterview in src/lib/applications.js). Distinct from
// send-interview-reminders, which nags about the video-screening upload
// deadline, not an actual appointment date. Nothing in the app calls this
// from the client; it's meant to run daily via Supabase's Cron Jobs
// (Database -> Cron Jobs in the dashboard), calling this Edge Function on a
// schedule with the service-role key as its Authorization header. No
// interactive user is behind a cron trigger, so this authenticates the
// request itself against the service-role key rather than a user JWT — only
// the cron job (or someone who already has that secret) can invoke it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/mailer.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

// One invocation can in principle need to check every applicant with an
// upcoming scheduled interview — cap it so a large pool can't blow through
// the function's execution time in one run. Anyone left uncapped simply
// gets picked up on tomorrow's run instead (their interview is further out
// either way, since this only ever looks at the next ~24 hours).
const MAX_PER_CALL = 100;

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      return json({ error: 'Not authorized.' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

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
      return json({ error: candidatesError.message }, 500);
    }

    const siteUrl = Deno.env.get('ALLOWED_ORIGIN');
    const link = siteUrl && siteUrl !== '*' ? `${siteUrl}/?screen=my-applications` : null;

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

    return json({ checked: candidates?.length ?? 0, reminded: remindedCount });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

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
    subject: `Reminder: your interview is tomorrow — ${jobTitle}`,
    html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">
      <p>Hi ${fullName || 'there'},</p>
      <p>This is a reminder that your personal interview for <strong>${jobTitle}</strong> is coming up:</p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#888;">When</td><td style="padding:4px 0;font-weight:700;">${formattedWhen}</td></tr>
        ${location ? `<tr><td style="padding:4px 12px 4px 0;color:#888;">Where</td><td style="padding:4px 0;">${location}</td></tr>` : ''}
      </table>
      <p>Please arrive on time and bring any documents HR may have requested.</p>
      ${link ? `<p><a href="${link}" style="color:#c0152f;font-weight:700;">View your application</a></p>` : ''}
      <p style="margin-top:24px;color:#888;font-size:13px;">Victory Liner Careers</p>
    </div>`,
  });
  return result.ok;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
