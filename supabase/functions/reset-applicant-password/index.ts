// Lets HR generate a fresh temporary password for an applicant who's locked
// out and can't self-serve via "Forgot Password" yet — Supabase's shared/
// free email sender only delivers to accounts on the project's own team
// (see supabase/README.md), so real applicants can't receive that email
// until custom SMTP is configured. HR reads/relays the temp password to the
// applicant directly (phone, in person, etc.) as a stopgap during testing.
// Only callable by HR; never runs in the browser since it needs the service
// role key to touch another user's password.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mirrors src/lib/passwordRules.js (10+ chars, upper, lower, number) so the
// generated password would pass the same form validation the applicant's
// own password went through.
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pw = pick(upper) + pick(lower) + pick(digits);
  for (let i = 0; i < 7; i += 1) pw += pick(all);
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return json({ error: 'Not authenticated.' }, 401);
    }

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['hr_personnel', 'hr_head'].includes(callerProfile.role)) {
      return json({ error: 'Only HR can reset an applicant’s password.' }, 403);
    }

    const { applicantId } = await req.json();
    if (!applicantId) {
      return json({ error: 'applicantId is required.' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Defense in depth — this path is for applicants only, never for
    // resetting another HR/admin account's credentials.
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', applicantId)
      .single();
    if (!targetProfile || targetProfile.role !== 'applicant') {
      return json({ error: 'That account is not an applicant.' }, 400);
    }

    const tempPassword = generateTempPassword();
    const { error: updateError } = await adminClient.auth.admin.updateUserById(applicantId, { password: tempPassword });
    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    return json({ password: tempPassword });
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
