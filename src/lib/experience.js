// Mirrors the date-math done server-side in supabase/functions/evaluate-application
// (see computeYearsOfExperience there) — used here purely for display, so HR sees
// the same "years of experience" figure the AI evaluation reasoned from instead of
// having to re-derive it by hand from each work-experience date range.
export function computeYearsOfExperience(workExperience) {
  if (!workExperience?.length) return null;
  let totalMonths = 0;
  let hasValidRange = false;
  for (const exp of workExperience) {
    if (!exp.startDate) continue;
    const start = new Date(exp.startDate);
    const end = exp.endDate ? new Date(exp.endDate) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) continue;
    totalMonths += Math.max((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()), 0);
    hasValidRange = true;
  }
  if (!hasValidRange) return null;
  return Math.round((totalMonths / 12) * 10) / 10;
}
