// Builds this app's CORS headers per-request, matched against whichever
// origin the browser actually sent — ALLOWED_ORIGIN (the real production
// domain, also used to build every email link this app sends) can't safely
// be the one static CORS-allowed origin too: that would block every local
// dev server from calling these functions at all, which is exactly what
// happened the moment ALLOWED_ORIGIN got set to a real domain for the first
// time. Every endpoint here already requires a real bearer token regardless
// of which site's JS initiated the request, so echoing back a request's own
// origin isn't a meaningful new security exposure — the token is what
// actually gates access, not this header.
export function corsHeaders(req: Request): Record<string, string> {
  const allowed = Deno.env.get('ALLOWED_ORIGIN');
  const origin = req.headers.get('Origin') || '';
  const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowOrigin = !allowed || origin === allowed || isLocalDev ? (origin || '*') : allowed;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    // Tells any caching layer the response varies by request Origin, since
    // this is no longer a single fixed value for every request.
    'Vary': 'Origin',
  };
}
