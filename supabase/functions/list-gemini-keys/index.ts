// Lets the Ctrl+Shift+G debug panel (src/components/debug/ApiKeyMonitor)
// show every configured Gemini key immediately on open — previously the
// key-status table only ever got seeded as a side effect of a real Gemini
// call inside callGemini(), so an unused key (or a freshly-added one, or
// the panel on a brand-new day before anything else has run yet) stayed
// invisible until someone happened to trigger an actual AI feature. This
// function does the same seeding callGemini() does, without ever calling
// Gemini's API itself — checking "how many keys do I have" shouldn't cost
// a real request or require using the app first.
//
// Deliberately no auth check: the panel is meant to work anywhere on the
// site, including the Sign In page before anyone's signed in at all, and
// the only thing this ever returns is a count of keys plus generic "Key
// 1/2/3" labels — no key material, no user data, nothing worth gating.
import { collectGeminiKeys, seedKeyLabels } from '../_shared/gemini.ts';

import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const keys = collectGeminiKeys();
    await seedKeyLabels(keys.length);

    return json({ count: keys.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});
