// Cron-only for the real daily batch — reminds an applicant by email when
// they're down to 1 day left on their 3-day video-screening deadline
// (interview_stage_at + 3 days) and still haven't finished. Meant to be
// invoked on a daily schedule via Supabase's pg_cron (see supabase/README.md
// for the exact `cron.schedule(...)` statement), authenticated against the
// service-role key rather than a user JWT since no interactive user is
// behind a cron trigger.
//
// Also reachable by an authenticated HR account with an explicit
// `applicationId` — a one-off preview send for that specific applicant,
// bypassing every real-batch gate (the 2-day cutoff, already-sent,
// already-finished). There was previously no way for HR to see what this
// email actually looks like short of waiting on real elapsed time; this is
// a manual "send it to me/them now" path, not part of the real reminder
// logic, and never touches interview_deadline_reminder_sent_at so it can't
// suppress or duplicate the real cron's own bookkeeping for that applicant.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/mailer.ts';
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_DAYS = 3;
const REMIND_AT_DAYS = 2; // 1 day of the 3 remaining once this old

// One invocation can in principle need to check every applicant currently
// mid-screening — cap it so a large pool can't blow through the function's
// execution time in one run. Anyone left uncapped simply gets picked up on
// tomorrow's run instead (they're not yet at their deadline either way).
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
        .select('id, email, full_name, job_postings(title)')
        .eq('id', previewApplicationId)
        .single();
      if (appError || !app?.email) return json(corsHeaders, { error: 'Application not found.' }, 404);
      const jobTitle = app.job_postings?.title || 'the role you applied for';
      const sent = await sendReminderEmail(app.email, app.full_name, jobTitle, link);
      if (!sent) return json(corsHeaders, { preview: true, sent: false, error: 'Failed to send email.' }, 502);
      return json(corsHeaders, { preview: true, sent: true });
    }

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
      return json(corsHeaders, { error: candidatesError.message }, 500);
    }

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
      const sent = await sendReminderEmail(app.email, app.full_name, jobTitle, link);
      if (sent) {
        remindedCount += 1;
        await adminClient.from('applications').update({ interview_deadline_reminder_sent_at: new Date().toISOString() }).eq('id', app.id);
      }
    }

    return json(corsHeaders, { checked: candidates?.length ?? 0, reminded: remindedCount });
  } catch (err) {
    return json(buildCorsHeaders(req), { error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

// Same branded card shell as every other applicant-facing email in this app
// (red header bar, white card, pill CTA) — this used to be a bare unstyled
// div, the odd one out once send-status-email and the scheduled-interview
// email were both brought in line with it.
async function sendReminderEmail(
  toEmail: string,
  fullName: string | null,
  jobTitle: string,
  link: string | null,
): Promise<boolean> {
  const result = await sendEmail({
    to: toEmail,
    subject: `1 day left to complete your video interview: ${jobTitle}`,
    html: `<div style="background:#f4f4f4;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
        <div style="background:#c0152f;padding:26px 32px;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Victory Liner Careers</span>
        </div>
        <div style="padding:32px;">
          <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;">Hi ${fullName || 'there'},</p>
          <p style="font-size:15px;color:#1a1a1a;line-height:1.6;margin:0 0 22px;">You have about <strong>1 day left</strong> to finish your video interview for <strong>${jobTitle}</strong>. It unlocks ${DEADLINE_DAYS} days from when your resume cleared screening, and that window is almost up.</p>
          ${link ? `<div style="text-align:center;"><a href="${link}" style="display:inline-block;background:#c0152f;color:#ffffff;font-weight:700;font-size:14px;padding:13px 30px;border-radius:999px;text-decoration:none;">Finish Your Interview</a></div>` : ''}
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
