// Shared, DB-backed rate limiter for the Gemini-calling edge functions — an
// in-memory counter wouldn't reliably hold across separate Deno isolates or
// cold starts, so this counts recent calls logged in ai_rate_limits instead
// (see migration 0012_ai_rate_limits.sql). Uses the caller's own scoped
// client, so it's bound by the same RLS as everything else that client does.
// deno-lint-ignore no-explicit-any
export async function checkRateLimit(
  client: any,
  userId: string,
  functionName: string,
  maxCalls: number,
  windowMinutes: number,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count } = await client
    .from('ai_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .gte('called_at', windowStart);

  if ((count ?? 0) >= maxCalls) {
    return true;
  }

  await client.from('ai_rate_limits').insert({ user_id: userId, function_name: functionName });
  return false;
}
