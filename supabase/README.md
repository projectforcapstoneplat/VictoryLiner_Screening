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

## Where the schema lives

- `supabase/migrations/0001_init.sql` — tables, trigger, RLS policies (source of truth for the DB schema).
- `supabase/functions/create-hr-account/` — edge function used by the HR head's "Manage HR Personnel" screen to create new HR accounts.

## Mapping to the thesis ERD (Figure 13)

The live schema uses different table/column names than Figure 13 in the capstone document — this is intentional (Supabase Auth owns credentials and sessions instead of us hand-rolling them), not a missed requirement. For the defense, the mapping is:

| Figure 13 | Live schema | Why it differs |
|---|---|---|
| `users_tbl` (incl. `password`) | `profiles` + Supabase's built-in `auth.users` | Supabase Auth stores/hashes credentials in `auth.users`; `profiles` only holds app-level fields (role, full_name, is_active). |
| `session_tbl` | *(not needed)* | Supabase Auth issues and manages JWT sessions itself. |
| `job_tbl` (`qualifications`, `requirements`) | `job_postings` (`required_qualifications`, `preferred_qualifications`, plus `accommodations_policy`, `ai_policy`, `status`, `application_deadline`) | Split into required/preferred per what the AI screening phase will read, and expanded with the applicant-facing policy fields. |
| `criteria_tbl` (keyword/weight per job) | *(not yet built)* | Deferred to the resume-analysis phase — will be added when the NLP scoring logic that consumes it is built. |
| `application_tbl`, `resume_tbl`, `interview_tbl`, `interview_questions_tbl`, `results_tbl`, `reports_tbl` | *(not yet built)* | Later phases (resume upload, video interview, AI scoring, HR reporting) — not in scope for Phase 1 (accounts + job postings). |
