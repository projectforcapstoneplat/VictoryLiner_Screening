// Shared between Interview.jsx (applicant recording flow) and
// HrApplicantsList.jsx (HR's "reset attempts" recovery action) so the two
// can never silently drift apart on what the limit actually is.
export const MAX_ATTEMPTS = 3;
