-- Victory Liner Careers — fixes re-recording a video interview answer.
-- Run once in the Supabase SQL editor, after 0026_applicant_notifications.sql.

-- uploadResponseVideo (src/lib/interview.js) re-uploads to the *same* storage
-- path on every re-record (`${applicant_id}/${application_id}/${question_id}.webm`,
-- upsert: true) so the same answer is always found at the same place. Storage's
-- upsert is an insert-or-update, but 0006_interview.sql only ever added an
-- insert policy for this bucket — a second recording of the same question hits
-- the implicit update with no policy allowing it at all, which Postgres reports
-- as "new row violates row-level security policy" and the re-record silently
-- fails to save. This adds the missing update policy, same ownership check as
-- the existing insert one.
drop policy if exists "interview_videos_update_own" on storage.objects;
create policy "interview_videos_update_own" on storage.objects
  for update using (
    bucket_id = 'interview-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'interview-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
