// Checks whether a sign-up email's domain belongs to a known disposable/
// temporary email provider. Runs server-side (not bundled into the client)
// because the curated domain list this checks against is ~120k entries —
// multiple MB, which would otherwise bloat the public-facing bundle every
// applicant downloads before they've even signed up. Public/unauthenticated
// by design: it runs on the Create Account form, before any session exists.
import disposableDomains from 'npm:disposable-email-domains@1.0.62';

const DISPOSABLE_DOMAINS = new Set(disposableDomains as string[]);

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isDisposable(email: string): boolean {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  if (at === -1) return false;
  const parts = email.trim().toLowerCase().slice(at + 1).split('.');
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email?.trim()) {
      return json({ error: 'Email is required.' }, 400);
    }

    return json({ disposable: isDisposable(email) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
