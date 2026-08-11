-- Victory Liner Careers — server-side enforcement of the interview video
-- upload cap. The client already refuses to upload anything over 50MB (see
-- MAX_UPLOAD_BYTES in src/lib/interview.js), but a client-side check alone
-- can be bypassed — this makes Supabase Storage itself reject oversized or
-- wrong-mime-type uploads regardless of what the client claims.
-- Run once in the Supabase SQL editor, after 0010_interview_response_attempts.sql.

update storage.buckets
set file_size_limit = 52428800, -- 50 MB, in bytes
    allowed_mime_types = array['video/webm']
where id = 'interview-videos';
