import { supabase } from './supabaseClient.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB — matches the bucket's own file_size_limit (server-enforced too)
const ALLOWED_EXTENSIONS = ['pdf', 'docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Client-side checks are a UX convenience (fail fast, clear message) — never
// the actual security boundary. The bucket itself rejects anything over the
// size cap or outside the two allowed MIME types regardless of what's
// checked here, and parse-resume-upload independently re-validates the
// file's real magic bytes before touching it (0033_resume_upload_bucket.sql,
// parse-resume-upload/index.ts).
export function validateResumeFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Please upload a PDF or Word (.docx) file.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'File is too large — please upload something under 5MB.';
  }
  return null;
}

// Uploads to a private, per-applicant path with a random filename — never
// the user's original filename (avoids any path-traversal/injection risk
// from a crafted name) — then asks parse-resume-upload to read it and
// return structured fields for the wizard to pre-fill. Nothing is saved to
// applicant_resumes here; the applicant still reviews and explicitly saves
// via the normal wizard flow afterward.
export async function uploadAndParseResume(applicantId, file) {
  const validationError = validateResumeFile(file);
  if (validationError) return { error: validationError };

  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${applicantId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('resume-uploads').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return { error: 'Could not upload the file. Please try again.' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { error: 'Not signed in.' };
  }

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-resume-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ path }),
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || 'Could not read this resume.' };
    return { data: body.data };
  } catch {
    return { error: 'Could not reach the parsing service. Check your connection and try again.' };
  }
}
