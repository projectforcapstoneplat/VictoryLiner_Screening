// Notifies every active HR account the moment a job posting gets
// auto-drafted because its open positions just got filled by an Advance
// decision (see migration 0046's applications_auto_draft_job_on_advance
// trigger) — otherwise HR has no way to find out except by noticing the
// posting quietly disappeared from the published list. Called by whichever
// HR account's own client just performed the Advance (src/lib/applications.js),
// right after confirming the job actually flipped to 'draft' as a result of
// that exact call, so this doesn't re-notify every time someone's advanced
// on an already-filled, already-drafted job.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/mailer.ts';

import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

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

    const { jobId } = await req.json();
    if (!jobId) {
      return json({ error: 'jobId is required.' }, 400);
    }

    const { data: job, error: jobError } = await adminClient
      .from('job_postings')
      .select('title, open_positions, status')
      .eq('id', jobId)
      .single();
    if (jobError || !job) {
      return json({ error: 'Job not found.' }, 404);
    }
    // Caller already checks this client-side before invoking, but re-verify
    // server-side too — a stale/racing call shouldn't send a misleading
    // "auto-drafted" email for a job that isn't actually in that state.
    if (job.status !== 'draft') {
      return json({ sent: false, skipped: true }, 200);
    }

    const siteUrl = Deno.env.get('ALLOWED_ORIGIN');
    const link = siteUrl && siteUrl !== '*' ? `${siteUrl}/?screen=hr-dashboard` : null;

    // Every active HR account, not just Personnel — same audience as
    // send-interview-completed-email, for the same reason: HR Head should
    // know a posting just closed itself too, not only the Personnel account
    // that happened to click Advance.
    const { data: hrProfiles } = await adminClient
      .from('profiles')
      .select('email')
      .in('role', ['hr_personnel', 'hr_head'])
      .eq('is_active', true);
    const hrEmails = (hrProfiles || []).map((p) => p.email).filter(Boolean);

    if (hrEmails.length === 0) {
      return json({ sent: false, error: 'No active HR accounts to notify.' }, 200);
    }

    const positionsLabel = `${job.open_positions} open position${job.open_positions === 1 ? '' : 's'}`;
    const subject = `Job auto-drafted: ${job.title} has filled all ${positionsLabel}`;
    const html = `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">
      <p><strong>${job.title}</strong> just reached its target of ${positionsLabel} filled, so it's been automatically moved to <strong>Draft</strong> and taken off the public job board.</p>
      <p>If you still want to keep accepting applicants for this role (for example, as backups in case an offer falls through), you can republish it any time from the job postings list.</p>
      ${link ? `<p><a href="${link}" style="color:#c0152f;font-weight:700;">Open the HR dashboard</a></p>` : ''}
      <p style="margin-top:24px;color:#888;font-size:13px;">Victory Liner Careers — HR Command Center</p>
    </div>`;
    const results = await Promise.all(hrEmails.map((to: string) => sendEmail({ to, subject, html })));
    const sentCount = results.filter((r) => r.ok).length;

    if (sentCount === 0) {
      return json({ sent: false, error: results[0]?.error || 'Failed to send email.' }, results[0]?.status || 502);
    }

    return json({ sent: true, notifiedCount: sentCount, totalHr: hrEmails.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});
