// Cron-only — reminds an applicant by email when they're down to 1 day left
// on their 3-day video-screening deadline (interview_stage_at + 3 days) and
// still haven't finished. Nothing in the app calls this from the client;
// it's meant to be invoked on a daily schedule via Supabase's pg_cron (see
// supabase/README.md for the exact `cron.schedule(...)` statement to run
// once in the SQL editor). No interactive user is behind a cron trigger, so
// this authenticates the request itself against the service-role key rather
// than a user JWT — only Supabase's own cron job (or someone who already has
// that secret) can invoke it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_DAYS = 3;
const REMIND_AT_DAYS = 2; // 1 day of the 3 remaining once this old

// One invocation can in principle need to check every applicant currently
// mid-screening — cap it so a large pool can't blow through the function's
// execution time in one run. Anyone left uncapped simply gets picked up on
// tomorrow's run instead (they're not yet at their deadline either way).
const MAX_PER_CALL = 100;

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      return json({ error: 'Not authorized.' }, 401);
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Victory Liner Careers <onboarding@resend.dev>';
    if (!resendKey) {
      return json({ error: 'Email is not configured yet (missing RESEND_API_KEY secret).' }, 501);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const remindAtCutoff = new Date(Date.now() - REMIND_AT_DAYS * DAY_MS).toISOString();

    const { data: candidates, error: candidatesError } = await adminClient
      .from('applications')
      .select('id, email, full_name, job_postings(title)')
      .eq('status', 'interview_stage')
      .not('interview_stage_at', 'is', null)
      .lte('interview_stage_at', remindAtCutoff)
      .is('interview_deadline_reminder_sent_at', null)
      .limit(MAX_PER_CALL);
    if (candidatesError) {
      return json({ error: candidatesError.message }, 500);
    }

    const siteUrl = Deno.env.get('ALLOWED_ORIGIN');
    const link = siteUrl && siteUrl !== '*' ? `${siteUrl}/?screen=my-applications` : null;

    let remindedCount = 0;
    for (const app of candidates ?? []) {
      const { data: responses } = await adminClient
        .from('interview_responses')
        .select('video_path')
        .eq('application_id', app.id);
      const total = responses?.length ?? 0;
      const answered = responses?.filter((r) => r.video_path).length ?? 0;
      // No questions were ever assigned (a thin/empty category question
      // bank — see ensureAssignedResponses in src/lib/interview.js) — the
      // applicant has nothing they can even record yet, so a "1 day left"
      // email would just be misleading. Left unmarked (not
      // interview_deadline_reminder_sent_at) so this keeps getting
      // re-checked daily in case HR adds questions and the applicant's
      // next visit assigns them.
      if (total === 0) continue;
      // Already finished — no reminder needed, and mark it so this row
      // stops being re-checked on every future run.
      if (answered === total) {
        await adminClient.from('applications').update({ interview_deadline_reminder_sent_at: new Date().toISOString() }).eq('id', app.id);
        continue;
      }
      if (!app.email) continue;

      const jobTitle = app.job_postings?.title || 'the role you applied for';
      const sent = await sendReminderEmail(resendKey, fromEmail, app.email, app.full_name, jobTitle, link);
      if (sent) {
        remindedCount += 1;
        await adminClient.from('applications').update({ interview_deadline_reminder_sent_at: new Date().toISOString() }).eq('id', app.id);
      }
    }

    return json({ checked: candidates?.length ?? 0, reminded: remindedCount });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

async function sendReminderEmail(
  resendKey: string,
  fromEmail: string,
  toEmail: string,
  fullName: string | null,
  jobTitle: string,
  link: string | null,
): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        subject: `1 day left to complete your video interview — ${jobTitle}`,
        html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">
          <p>Hi ${fullName || 'there'},</p>
          <p>You have about <strong>1 day left</strong> to finish your video interview for <strong>${jobTitle}</strong> — it unlocks
          ${DEADLINE_DAYS} days from when your resume cleared screening, and that window is almost up.</p>
          <p>${link ? `<a href="${link}" style="color:#c0152f;font-weight:700;">Sign in to finish your interview</a>` : 'Sign in to Victory Liner Careers to finish your interview'} before it closes.</p>
          <p style="margin-top:24px;color:#888;font-size:13px;">Victory Liner Careers</p>
        </div>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
