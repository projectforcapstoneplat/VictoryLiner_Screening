// A screening criterion's weight (1-5) previously had no defined meaning
// anywhere in the system — not in the HR-facing form, and not even in what
// got sent to the AI (just a bare "weight 3/5" with nothing telling either
// a human or the model what "3" is actually supposed to represent). This is
// the single source of truth for what each number means, shared by every
// AI prompt that references a criterion's weight (match-resume-to-jobs,
// match-job-to-resumes, evaluate-application) and mirrored in the HR-facing
// dropdown in JobPostingForm.jsx, so both sides agree on the same scale.
export const WEIGHT_LABELS: Record<number, string> = {
  1: 'Nice to Have',
  2: 'Helpful',
  3: 'Important',
  4: 'Very Important',
  5: 'Critical / Required',
};

export function formatWeight(weight: number): string {
  const label = WEIGHT_LABELS[weight] || WEIGHT_LABELS[3];
  return `${weight}/5: ${label}`;
}
