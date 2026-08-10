// Shared between JobDetails.jsx and JobFilter.jsx so "closed" / "urgent"
// logic can't drift between the two places it's shown.
export function deadlineInfo(deadline) {
  if (!deadline) return null;
  const due = new Date(`${deadline}T23:59:59`);
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const formatted = due.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  if (daysLeft < 0) return { formatted, label: 'Applications closed', urgent: false, closed: true };
  if (daysLeft === 0) return { formatted, label: 'Closes today', urgent: true, closed: false };
  if (daysLeft <= 7) return { formatted, label: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left to apply`, urgent: true, closed: false };
  return { formatted, label: `Apply by ${formatted}`, urgent: false, closed: false };
}
