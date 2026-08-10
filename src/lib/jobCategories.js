// Fixed set of job categories offered across the app — used both when HR
// posts a job (JobPostingForm) and when HR builds the interview question
// bank (InterviewQuestions). Keeping this one fixed list as the single
// source of truth (rather than free text in both places) guarantees a job's
// category always matches a question-bank category exactly, so applicants
// never hit an empty interview question pool over a typo/wording mismatch.
export const JOB_CATEGORIES = [
  'Bus Driver',
  'Conductor',
  'Mechanic / Maintenance Technician',
  'Terminal Operations Staff',
  'Dispatcher / Trip Scheduler',
  'Customer Service / Ticketing',
  'Cashier / Teller',
  'Accounting & Finance',
  'Human Resources',
  'Administrative / Clerical',
  'Security Guard',
  'Safety & Compliance Inspector',
  'Information Technology',
  'Marketing & Sales',
  'Operations Supervisor / Management',
];
