// Applies to a job the applicant's AI matches already scored (see
// match-resume-to-jobs) — reuses that existing score/explanation/criteria
// instead of running the AI a second time on the same resume/job pair, and
// sets status straight to 'interview_stage' when that score genuinely
// clears the effective threshold for this job, skipping the manual HR
// "advance" click that would otherwise just be reconfirming what the AI
// already established before this job was ever shown to the applicant as a
// match. A score that doesn't clear the threshold (e.g. screening settings
// changed since matching) falls back to the normal 'submitted' status, same
// as any other application — HR still reviews it manually.
//
// resume_evaluations is HR-write-only by RLS (see 0005_resume_evaluations.sql)
// — copying the match into it is the one privileged step here, so it goes
// through the service-role client. Everything else runs as the caller
// (the applicant), same as their own RLS grants already allow.
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
    if (!callerProfile || callerProfile.role !== 'applicant') {
      return json({ error: 'Only applicants can apply.' }, 403);
    }

    const { jobId } = await req.json();
    if (!jobId) {
      return json({ error: 'jobId is required.' }, 400);
    }

    // Already applied — hand back what's there instead of erroring, so a
    // repeat click (or a race with a previous one) is harmless.
    const { data: existing } = await callerClient
      .from('applications')
      .select('*, job_postings(title, category, min_resume_match_percent)')
      .eq('job_id', jobId)
      .eq('applicant_id', user.id)
      .maybeSingle();
    if (existing) {
      return json({ application: existing });
    }

    const { data: resume } = await callerClient
      .from('applicant_resumes')
      .select('*')
      .eq('applicant_id', user.id)
      .maybeSingle();
    if (!resume || !resume.completed_at) {
      return json({ error: 'Please finish building your resume first.' }, 400);
    }

    const { data: job, error: jobError } = await callerClient
      .from('job_postings')
      .select('*')
      .eq('id', jobId)
      .single();
    if (jobError || !job) {
      // Covers "not published" too, not just "doesn't exist" — the
      // job_postings_select_published RLS policy already means a
      // draft/closed job's row never comes back for an applicant's own
      // client, so jobError/null here is the only signal needed for that.
      return json({ error: 'Job posting not found.' }, 404);
    }
    // RLS only gates *status*, not the deadline — a job left 'published'
    // past its own application_deadline is still selectable here, and
    // JobDetails.jsx's "Applications Closed" button is purely a client-side
    // derived value that a stale open tab (or a direct call) bypasses
    // entirely. Same day-boundary calculation as src/lib/deadline.js so a
    // deadline day itself still counts as open on both sides.
    if (job.application_deadline) {
      const deadline = new Date(`${job.application_deadline}T23:59:59`);
      if (deadline.getTime() < Date.now()) {
        return json({ error: 'The application deadline for this job has passed.' }, 400);
      }
    }

    const { data: match } = await callerClient
      .from('resume_job_matches')
      .select('*')
      .eq('applicant_id', user.id)
      .eq('job_id', jobId)
      .maybeSingle();
    if (!match) {
      return json({ error: 'No AI match on file for this job yet.' }, 400);
    }

    const { data: settings } = await callerClient
      .from('screening_settings')
      .select('min_resume_match_percent')
      .eq('id', 1)
      .single();
    const effectiveMinPercent = job.min_resume_match_percent ?? settings?.min_resume_match_percent ?? 50;
    const clearsThreshold = match.score >= effectiveMinPercent;

    const { data: newApp, error: insertError } = await callerClient
      .from('applications')
      .insert({
        job_id: jobId,
        applicant_id: user.id,
        full_name: resume.full_name,
        email: resume.email,
        phone: resume.phone,
        work_experience: resume.work_experience,
        education: resume.education,
        skills: resume.skills,
        certifications: resume.certifications,
        cover_note: resume.summary,
        drivers_license_type: resume.drivers_license_type,
        drivers_license_restrictions: resume.drivers_license_restrictions,
        years_driving_experience: resume.years_driving_experience,
        has_nbi_clearance: resume.has_nbi_clearance,
        willing_shifting_schedule: resume.willing_shifting_schedule,
        education_level: resume.education_level,
        current_location: resume.current_location,
        has_medical_certificate: resume.has_medical_certificate,
        status: clearsThreshold ? 'interview_stage' : 'submitted',
        // Starts the 3-day video-screening deadline clock right here for the
        // fast-tracked path — this insert never goes through
        // updateApplicationStatus (src/lib/applications.js), which is the
        // only other place that stamps it, so it has to happen in both spots.
        interview_stage_at: clearsThreshold ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (insertError) {
      if (insertError.code === '23505') {
        return json({ error: 'You have already applied to this job.' }, 409);
      }
      return json({ error: insertError.message }, 500);
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    await adminClient.from('resume_evaluations').upsert(
      {
        application_id: newApp.id,
        job_id: jobId,
        score: match.score,
        explanation: match.explanation,
        criteria_assessment: match.criteria_assessment ?? [],
        model: match.model,
        evaluated_at: match.matched_at,
      },
      { onConflict: 'application_id' },
    );

    const { data: fullApp } = await callerClient
      .from('applications')
      .select('*, job_postings(title, category, min_resume_match_percent)')
      .eq('id', newApp.id)
      .single();

    return json({ application: fullApp ?? newApp });
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
