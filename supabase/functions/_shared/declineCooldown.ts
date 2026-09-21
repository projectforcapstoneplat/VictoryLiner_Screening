// Victory Liner HR policy: an applicant declined from any job can't submit
// a new application, or be matched against new job postings, until 6
// months after that decision — company-wide, not just the job they were
// declined from. application_decision_log is HR-read-only by RLS
// (application_decision_log_select_hr in 0013_application_decision_log.sql),
// so every read here needs the service-role client, never the caller's own.
export const DECLINE_COOLDOWN_MONTHS = 6;

// deno-lint-ignore no-explicit-any
export async function getCooldownUntil(adminClient: any, applicantId: string): Promise<Date | null> {
  const { data: apps } = await adminClient
    .from('applications')
    .select('id')
    .eq('applicant_id', applicantId);
  // deno-lint-ignore no-explicit-any
  const appIds = (apps ?? []).map((a: any) => a.id);
  if (appIds.length === 0) return null;

  const { data: lastDecline } = await adminClient
    .from('application_decision_log')
    .select('decided_at')
    .in('application_id', appIds)
    .eq('status', 'declined')
    .order('decided_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastDecline) return null;

  const cooldownEnd = new Date(lastDecline.decided_at);
  cooldownEnd.setMonth(cooldownEnd.getMonth() + DECLINE_COOLDOWN_MONTHS);
  return cooldownEnd > new Date() ? cooldownEnd : null;
}

// Batch form for match-job-to-resumes, which screens a whole applicant pool
// at once against one freshly published job — one query instead of one
// per applicant.
// deno-lint-ignore no-explicit-any
export async function getCooldownApplicantIds(adminClient: any): Promise<Set<string>> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - DECLINE_COOLDOWN_MONTHS);
  const { data } = await adminClient
    .from('application_decision_log')
    .select('applications(applicant_id)')
    .eq('status', 'declined')
    .gte('decided_at', cutoff.toISOString());
  // deno-lint-ignore no-explicit-any
  return new Set((data ?? []).map((row: any) => row.applications?.applicant_id).filter(Boolean));
}

export function formatCooldownDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
