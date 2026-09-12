// Shared by HrApplicantsList.jsx and HrPersonnelDashboard.jsx — a score's
// color should reflect how good it actually is, not just whether it happens
// to be the currently-selected/emphasized column. A 90% shouldn't render in
// the same red as a 20% just because red is the app's brand accent color.
export function scoreColor(score) {
  if (score == null) return 'var(--gray-500)';
  if (score >= 80) return '#0ca30c';
  if (score >= 60) return '#c98500';
  return 'var(--red-700)';
}
