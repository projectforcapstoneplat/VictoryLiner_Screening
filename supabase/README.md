# Supabase setup — Victory Liner Careers

## 1. Create the project

1. Go to https://supabase.com, sign in (or create an account), then **New project**.
2. Pick an org, name it (e.g. `victory-liner-careers`), set a database password (save it somewhere — you won't need it for the app, only for direct DB access), pick the region closest to you, and create the project. It takes a minute or two to provision.

## 2. Get your API credentials

In the project dashboard: **Project Settings -> API**.

- **Project URL** -> `VITE_SUPABASE_URL`
- **anon / public** key (under "Project API keys") -> `VITE_SUPABASE_ANON_KEY`

Copy `victoryLiner_screening/.env.example` to `victoryLiner_screening/.env` and fill both values in. `.env` is gitignored — never commit it (and never put the **service_role** key in the frontend `.env`, only the anon key belongs there).

## 3. Run the schema migrations

**Dashboard -> SQL Editor -> New query**, paste the full contents of `supabase/migrations/0001_init.sql`, and click **Run**. This creates the `profiles` and `job_postings` tables, the auto-profile trigger, and the row-level-security policies.

Then repeat with `supabase/migrations/0002_applications.sql` in a new query. This adds the `applications` table (resume submissions) and a private `resumes` Storage bucket with its own access policies.

Then repeat once more with `supabase/migrations/0003_structured_resume.sql`. This replaces the file-upload column with structured fields (`work_experience`, `education`, `skills`, `certifications`) — applicants fill in a structured resume questionnaire instead of uploading a document, so the future NLP resume-analysis stage gets clean data instead of having to parse a scanned/blurry PDF.

Then repeat once more with `supabase/migrations/0004_criteria.sql`. This adds the `criteria` table (HR-defined keyword/weight pairs per job posting) and its RLS policies, editable from the "Screening Criteria" section of the job posting form.

Then repeat once more with `supabase/migrations/0005_resume_evaluations.sql`. This adds the `resume_evaluations` table, which caches each applicant's AI-generated match score, explanation, and per-criterion reasoning so the Applicants view doesn't re-call the AI on every visit.

Then repeat once more with `supabase/migrations/0006_interview.sql`. This adds the video-interview tables (`interview_questions`, `interview_responses`, `interview_evaluations`) and a private `interview-videos` Storage bucket with its own access policies.

Then repeat once more with `supabase/migrations/0007_application_status.sql`. This constrains `applications.status` to `submitted`/`advanced`/`declined` and adds the RLS policy letting HR actually update it — the candidate advance/decline decision on the HR Personnel dashboard.

Then repeat once more with `supabase/migrations/0008_application_extra_fields.sql`. This adds driver's-license type/restriction codes, years of driving experience, NBI/police clearance, and shifting-schedule willingness to `applications` — structured facts (shown only for the relevant job categories on the apply form) that give the AI resume evaluator concrete signals instead of relying entirely on free-text prose.

Then repeat once more with `supabase/migrations/0009_application_profile_fields.sql`. This adds a structured highest-educational-attainment level, the applicant's current location, and a medical/physical fitness certificate flag to `applications` — closing the remaining gaps between what the apply form collects and what the AI evaluator and HR reviewers actually need to screen accurately.

Then repeat once more with `supabase/migrations/0010_interview_response_attempts.sql`. This adds an `attempt_count` column to `interview_responses`, tracking how many times each interview answer has been (re-)recorded — capped client-side at 3 attempts per question, tracked server-side so the cap survives a page reload.

Then repeat once more with `supabase/migrations/0011_storage_limits.sql`. This caps the `interview-videos` bucket at 50MB per file and restricts uploads to `video/webm` — server-side enforcement of the same limit the client already checks, so it can't be bypassed by a tampered client.

Then repeat once more with `supabase/migrations/0012_ai_rate_limits.sql`. This adds the `ai_rate_limits` table the Gemini-calling edge functions use to cap how many requests one user can make in a 10-minute window, so a spammed button (or a script) can't run up an unbounded Gemini bill.

Then repeat once more with `supabase/migrations/0013_application_decision_log.sql`. This adds the `application_decision_log` table — an audit trail of who advanced/declined each application and when, shown on the Applicants view next to each decision.

Run any later `NNNN_*.sql` files the same way, in order — they're all safe to re-run (`create table if not exists` / `drop policy if exists`).

## 4. Bootstrap the first HR head account

Nothing in the app can create an HR account — that's intentional (see the main plan: HR accounts are never self-registered). For the very first HR head, create the user by hand once:

1. **Dashboard -> Authentication -> Users -> Add user**. Enter an email and password, and check "Auto Confirm User" so it doesn't need an email confirmation link.
2. The `on_auth_user_created` trigger will have given them a `profiles` row with `role = 'applicant'` (the default, since the dashboard doesn't set `user_metadata.role`). Promote them to HR head — **SQL Editor**:

   ```sql
   update public.profiles
   set role = 'hr_head', full_name = 'Your Name'
   where email = 'the-email-you-used@example.com';
   ```

3. That account can now sign in through the app's HR login screen. From there, the HR head creates HR personnel accounts through the in-app "Manage HR Personnel" screen (Phase 1, milestone 7) — no more manual SQL needed after this one-time step.

## 5. Deploy the "create HR account" edge function

The HR head's **Manage HR Personnel** screen creates new HR accounts through a Supabase Edge Function (`supabase/functions/create-hr-account`) — this is the only place that touches the service-role key, and it never runs in the browser. Deploying it requires the Supabase CLI.

1. Install the CLI (one of):
   ```
   npm install -g supabase
   ```
   or via Scoop on Windows: `scoop install supabase`.
2. From the `victoryLiner_screening/` folder, log in and link the project:
   ```
   supabase login
   supabase link --project-ref your-project-ref
   ```
   (`your-project-ref` is the part of your Project URL before `.supabase.co`, e.g. `kkwmktegwrqayomyfltw`.)
3. Deploy the function:
   ```
   supabase functions deploy create-hr-account
   ```

That's it — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are automatically available inside every edge function, so no extra secrets need to be set. Once deployed, the HR head's "Add HR Personnel" form on the **Manage HR Personnel** screen will work end-to-end.

## 6. Deploy the "suggest criteria" edge function (AI-assisted screening criteria)

The "✨ Suggest with AI" button on the job posting form's Screening Criteria section calls Google's Gemini API (via `supabase/functions/suggest-criteria`) to draft keyword/weight suggestions from the job title, description, and qualifications — HR then edits or removes suggestions before saving. This function needs a Gemini API key, which — unlike `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` — is **not** provided automatically and must be set as a function secret:

```
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
supabase functions deploy suggest-criteria
```

Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey) — no credit card required for the free tier. The key is only ever read inside this edge function — it's never sent to or stored in the browser.

## 7. Deploy the "evaluate application" edge function (AI resume matching)

The Applicants view calls Gemini (via `supabase/functions/evaluate-application`) to score each applicant against the job's screening criteria and description, matching on meaning rather than exact keywords (e.g. "followed all traffic regulations" satisfies a "Safe Driving" criterion), and writes an explanation plus per-criterion reasoning to the `resume_evaluations` table. It reads the same `GEMINI_API_KEY` secret as `suggest-criteria` — if you already set it in step 6, you only need to deploy the function:

```
supabase functions deploy evaluate-application
```

If you haven't set the secret yet, run `supabase secrets set GEMINI_API_KEY=your-gemini-api-key` first (see step 6). Every applicant without a saved evaluation is scored automatically, one at a time, the moment HR opens a job's Applicants list.

## 8. Deploy the video interview edge functions

The video interview module uses three more edge functions, all reading the same `GEMINI_API_KEY` secret as above — if it's already set, just deploy:

```
supabase functions deploy suggest-interview-questions
supabase functions deploy evaluate-interview-response
supabase functions deploy translate-question
```

- `suggest-interview-questions` powers the "✨ Suggest with AI" button on the HR **Interview Questions** screen (draft questions for a category — HR reviews and adds the ones they want to the bank).
- `evaluate-interview-response` sends a recorded answer's video directly to Gemini (it accepts video natively — no separate speech-to-text step) and gets back a transcript, sentiment tone, relevance to the question, an overall score, and an explanation, written to `interview_evaluations`. This runs automatically, one answer at a time, when HR opens a job's Applicants list, same as resume evaluation.
- `translate-question` powers the "🌐 Translate to Taglish" button an applicant sees on each interview question, once revealed — any signed-in user may call it (not HR-only), and nothing is persisted, it's translated on demand each time.

## 9. (Optional, before going live) Restrict edge function CORS to your real domain

Every edge function defaults to `Access-Control-Allow-Origin: *`, which is fine for local development but means any website's browser could technically call these endpoints (they're still gated by JWT auth + RLS underneath, so this isn't a data-access hole — it's just unnecessary exposure). Once you know the domain the frontend will actually be deployed to, lock it down:

```
supabase secrets set ALLOWED_ORIGIN=https://your-real-domain.com
supabase functions deploy suggest-criteria
supabase functions deploy evaluate-application
supabase functions deploy suggest-interview-questions
supabase functions deploy evaluate-interview-response
supabase functions deploy translate-question
supabase functions deploy create-hr-account
```

## Where the schema lives

- `supabase/migrations/0001_init.sql` — tables, trigger, RLS policies (source of truth for the DB schema).
- `supabase/functions/create-hr-account/` — edge function used by the HR head's "Manage HR Personnel" screen to create new HR accounts.
- `supabase/functions/suggest-criteria/` — edge function used by the "✨ Suggest with AI" button on the job posting form to draft screening criteria.
- `supabase/functions/evaluate-application/` — edge function used by the Applicants view to score each applicant against the job's criteria and cache the result in `resume_evaluations`.
- `supabase/functions/suggest-interview-questions/` — edge function used by the HR Interview Questions screen to draft category-scoped interview questions.
- `supabase/functions/evaluate-interview-response/` — edge function used by the Applicants view to transcribe and score one recorded video answer, caching the result in `interview_evaluations`.
- `supabase/functions/translate-question/` — edge function used by the applicant's Interview screen to translate a question into Taglish on demand.
- `supabase/functions/_shared/rateLimit.ts` — shared helper the AI edge functions import to enforce a per-user rate limit against `ai_rate_limits`.
- `supabase/migrations/0010_interview_response_attempts.sql` — adds `attempt_count` to `interview_responses`, enforcing a 3-attempt cap per question.
- `supabase/migrations/0011_storage_limits.sql` — caps the `interview-videos` bucket at 50MB and `video/webm` only.
- `supabase/migrations/0012_ai_rate_limits.sql` — adds `ai_rate_limits`, backing the per-user rate limit on the Gemini-calling edge functions.
- `supabase/migrations/0013_application_decision_log.sql` — adds `application_decision_log`, an audit trail of HR advance/decline decisions.

## Mapping to the thesis ERD (Figure 13)

The live schema uses different table/column names than Figure 13 in the capstone document — this is intentional (Supabase Auth owns credentials and sessions instead of us hand-rolling them), not a missed requirement. For the defense, the mapping is:

| Figure 13 | Live schema | Why it differs |
|---|---|---|
| `users_tbl` (incl. `password`) | `profiles` + Supabase's built-in `auth.users` | Supabase Auth stores/hashes credentials in `auth.users`; `profiles` only holds app-level fields (role, full_name, is_active). |
| `session_tbl` | *(not needed)* | Supabase Auth issues and manages JWT sessions itself. |
| `job_tbl` (`qualifications`, `requirements`) | `job_postings` (`required_qualifications`, `preferred_qualifications`, plus `accommodations_policy`, `ai_policy`, `status`, `application_deadline`) | Split into required/preferred per what the AI screening phase will read, and expanded with the applicant-facing policy fields. |
| `criteria_tbl` (keyword/weight per job) | `criteria` | Editable from the "Screening Criteria" section of the job posting form; consumed by the AI resume-evaluation stage. |
| `application_tbl` | `applications` | Structured fields (`work_experience`, `education`, `skills`, `certifications`) instead of a single `form_data` blob — see `0003_structured_resume.sql`. |
| `resume_tbl` (`file_path`, `parsed_data`) | *(not built — superseded)* | The paper's design uploads a resume file and parses it; this system skips that step entirely by having applicants fill structured fields directly (Phase 2 decision), so there's no file to store or parse. |
| `results_tbl` (`resume_score`, `interview_score`, `total_score`, `ranking`) | `resume_evaluations` + `interview_evaluations`, combined live | The paper models one bare row per applicant with both scores plus a ranking. Rather than a stored `results` table, `src/lib/reports.js` computes `total_score` (mean of the two) and `ranking` on read, from the two richer evaluation tables — same approach HrApplicants.jsx already used for its per-job ranked list, now shared across the per-job Applicants view, the HR Personnel decision queue, and the HR Head "Candidate Ranking" report. |
| `interview_questions_tbl` (`job_id` FK) | `interview_questions` (`category`, no `job_id`) | The paper scopes questions to one job; the live schema scopes them to a job *category* instead, so HR authors a question bank once per category (e.g. "Driver") and every job posting sharing that category reuses it, rather than re-entering the same questions per job posting. |
| `interview_tbl` (`video_path`, `transcript`, `response_data`, `evaluation_score`, one row per application) | `interview_responses` (applicant-writable: `video_path`) + `interview_evaluations` (AI-written: `transcript`, `sentiment_label`/`score`, `relevance_score`, `evaluation_score`) — one row per (application, question) | Split into two tables for the same reason `criteria`/`resume_evaluations` are split: applicants can only ever write their own raw video, never the AI's score. Also more granular than Figure 13 — one row per question (3 per application) instead of one combined row, so each answer's transcript/sentiment/relevance is visible individually, not just an aggregate. |
| `reports_tbl` | *(not built — computed, not stored)* | HR Head's dashboard (`src/pages/HrHeadDashboard.jsx` + `src/lib/reports.js`) is the paper's "HR Reporting Dashboard" — recruitment funnel, per-job pipelines, candidate ranking, sentiment breakdown, HR personnel activity. It's generated fresh from the live tables on every load rather than persisted rows in a `reports` table, so there's nothing to go stale or reconcile. |
