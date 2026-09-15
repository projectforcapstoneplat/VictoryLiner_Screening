-- Victory Liner Careers — storage bucket for uploaded resume files (PDF/DOCX),
-- parsed server-side by parse-resume-upload into the same structured fields
-- the manual wizard already collects (see 0021_applicant_resumes.sql). Bucket-
-- level file_size_limit/allowed_mime_types enforce the accepted formats
-- regardless of what the client claims — same defense-in-depth pattern as
-- 0011_storage_limits.sql for interview videos. Run once in the Supabase SQL
-- editor, after 0032_scheduled_interview_reminder.sql.

insert into storage.buckets (id, name, public)
values ('resume-uploads', 'resume-uploads', false)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'resume-uploads';

-- Paths stored as `${applicant_id}/${random-uuid}.${ext}` — never the user's
-- original filename (see uploadResumeFile in src/lib/resumeUpload.js) — same
-- reasoning as interview-videos: an applicant's own uid is always the first
-- path segment, and a random name avoids any path-traversal/injection risk
-- from a crafted original filename.
drop policy if exists "resume_uploads_insert_own" on storage.objects;
create policy "resume_uploads_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'resume-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resume_uploads_select_own" on storage.objects;
create policy "resume_uploads_select_own" on storage.objects
  for select using (
    bucket_id = 'resume-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- parse-resume-upload deletes the raw file itself right after a successful
-- parse (best-effort — no need to retain a second copy of PII once its
-- contents are already folded into applicant_resumes), so this exists as a
-- safety net for any file left behind by an abandoned/failed upload.
drop policy if exists "resume_uploads_delete_own" on storage.objects;
create policy "resume_uploads_delete_own" on storage.objects
  for delete using (
    bucket_id = 'resume-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
