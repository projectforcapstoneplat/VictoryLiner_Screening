// Dev-only debug overlay: Ctrl+Shift+G from anywhere on the site shows which
// of the rotating GEMINI_API_KEY pool (see supabase/functions/_shared/
// gemini.ts) are currently usable vs. rate-limited, so a long AI testing
// session doesn't quietly run out of quota without warning. Mounted once at
// the true root (src/main.jsx, alongside <App/>) rather than inside App.jsx
// itself, since App.jsx's screen switching is a long chain of early
// `return`s with no single wrapping point to hook a global overlay into —
// mounting it as a sibling means it's present on every screen without
// touching that branching at all.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient.js';

// Green is reserved for the one key actually in use right now -- a healthy
// key sitting in standby gets a neutral gray dot instead, so "green" never
// contradicts a "STANDBY" badge sitting right next to it.
function dotColor(status, role) {
  if (status === 'rate_limited') return 'var(--red-600)';
  if (role === 'active') return '#22c55e';
  return 'var(--gray-400)';
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const ROLE_BADGE = {
  active: { label: 'ACTIVE', bg: '#22c55e', color: '#fff' },
  standby: { label: 'STANDBY', bg: 'var(--surface-page-alt)', color: 'var(--text-primary)' },
};

function KeyRow({ row, now, role }) {
  const status = row.status === 'rate_limited' ? 'rate_limited' : 'ok';
  let detail;
  if (status === 'ok') {
    detail = row.last_success_at ? `last used ${formatDuration(now - new Date(row.last_success_at).getTime())} ago` : 'no activity yet';
  } else {
    const retryAfter = row.retry_after ? new Date(row.retry_after).getTime() : null;
    if (retryAfter && retryAfter > now) {
      detail = `resets in ${formatDuration(retryAfter - now)}`;
    } else if (retryAfter) {
      // "Unverified" alone reads the same whether this cleared 10 seconds
      // ago or was left stale from hours earlier (this key is the last
      // resort in rotation, so it can go a long time with no fresh attempt
      // to actually confirm it) — showing when it was last flagged makes
      // that distinction visible instead of hidden.
      detail = row.limited_at
        ? `should be free again — limited ${formatDuration(now - new Date(row.limited_at).getTime())} ago (unverified)`
        : 'should be free again (unverified)';
    } else {
      // Gemini didn't give us a retryDelay -- could be a per-minute or a
      // per-day limit, no way to tell which, so showing elapsed time is
      // honest where a countdown would just be a guess.
      detail = row.limited_at ? `limited ${formatDuration(now - new Date(row.limited_at).getTime())} ago (reset time unknown)` : 'rate limited';
    }
  }
  const badge = ROLE_BADGE[role];
  // Self-tracked, not Google's own data (the Gemini API exposes no quota
  // endpoint) -- just a count of calls this app has sent through this key
  // today. Only trusted when count_date matches today; otherwise it's a
  // stale number left over from a day this key hasn't been touched since.
  const countIsToday = row.count_date === new Date().toISOString().slice(0, 10);
  const requestsToday = countIsToday ? row.request_count_today || 0 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-hairline)' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor(status, role), flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 12 }}>{row.key_label}</span>
          {badge && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, padding: '1px 6px', borderRadius: 999, background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, opacity: 0.65 }}>{detail}</div>
        <div style={{ fontSize: 10, opacity: 0.45 }}>{requestsToday} request{requestsToday === 1 ? '' : 's'} today</div>
      </div>
    </div>
  );
}

// "Key N" -> N, so keys sort numerically (Key 2 before Key 10) instead of
// lexicographically, and so the first healthy one in that real order can be
// identified as the one callGemini's rotation would actually use next.
function keyNumber(label) {
  const match = /Key (\d+)/.exec(label || '');
  return match ? parseInt(match[1], 10) : 0;
}

export function ApiKeyMonitor() {
  const [visible, setVisible] = useState(false);
  const [rows, setRows] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setVisible((v) => !v);
      }
      if (e.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.from('api_key_status').select('*');
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setLoadError('');
      setRows((data || []).slice().sort((a, b) => keyNumber(a.key_label) - keyNumber(b.key_label)));
    };
    load();
    const pollId = setInterval(load, 4000);
    const tickId = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [visible]);

  if (!visible) return null;

  // Rotation always tries the lowest-numbered key first (see callGemini) --
  // so the "active" one is whichever healthy key sorts first, and every
  // other healthy key is only ever reached as a fallback, i.e. "standby."
  const activeIndex = rows.findIndex((r) => r.status !== 'rate_limited');

  return (
    <div
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 9999, width: 270,
        background: 'var(--surface-card)', color: 'var(--text-primary)', borderRadius: 14,
        boxShadow: '0 12px 32px rgba(0,0,0,0.25)', border: '1px solid var(--border-hairline)',
        padding: '14px 16px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.7 }}>Gemini Key Status</span>
        <button
          onClick={() => setVisible(false)}
          aria-label="Close"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', opacity: 0.5, fontSize: 14, lineHeight: 1, padding: 2 }}
        >
          ✕
        </button>
      </div>
      {rows.length > 0 && (
        <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 6 }}>{rows.length} key{rows.length === 1 ? '' : 's'} configured</div>
      )}
      {loadError && <div style={{ fontSize: 11, color: 'var(--red-600)' }}>{loadError}</div>}
      {!loadError && rows.length === 0 && (
        <div style={{ fontSize: 11, opacity: 0.6 }}>No key activity recorded yet — this fills in after the first AI call.</div>
      )}
      {rows.map((row, i) => (
        <KeyRow key={row.key_label} row={row} now={now} role={row.status === 'rate_limited' ? null : i === activeIndex ? 'active' : 'standby'} />
      ))}
      <div style={{ fontSize: 10, opacity: 0.45, marginTop: 8 }}>Ctrl+Shift+G to toggle · debug only</div>
    </div>
  );
}
export default ApiKeyMonitor;
