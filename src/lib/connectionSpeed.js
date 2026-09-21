// Lightweight, dependency-free connection check — times how long it takes to
// download a fixed-size file (public/speedtest/test-file.bin, random bytes
// so it can't be compressed away in transit and skew the timing) with
// caching disabled, then converts bytes/seconds into an approximate Mbps.
// Not a certified speed test (a real one runs multiple parallel streams and
// tests upload/download separately) — just enough signal to warn an
// applicant before they run into a slow connection mid-interview, when
// they're about to upload several video answers.
const TEST_FILE_URL = '/speedtest/test-file.bin';
const TIMEOUT_MS = 10000;

export async function measureDownloadSpeedMbps() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(`${TEST_FILE_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Speed check file returned ${res.status}.`);
    const blob = await res.blob();
    const elapsedSeconds = (performance.now() - start) / 1000;
    clearTimeout(timeout);
    if (elapsedSeconds <= 0 || blob.size === 0) throw new Error('Invalid connection speed measurement.');
    const mbps = (blob.size * 8) / elapsedSeconds / 1_000_000;
    return { mbps, error: null };
  } catch (err) {
    clearTimeout(timeout);
    const message = err?.name === 'AbortError'
      ? "Connection check timed out — your connection may be very slow or unstable."
      : (err?.message || 'Could not measure your connection speed.');
    return { mbps: null, error: message };
  }
}

// Thresholds picked around what a ~60-second, several-MB webm interview
// answer needs to upload without a frustrating wait — not a general-purpose
// "is this fast enough for streaming video" scale.
export function classifySpeed(mbps) {
  if (mbps === null || mbps === undefined) return null;
  if (mbps >= 5) return 'good';
  if (mbps >= 1.5) return 'fair';
  return 'poor';
}
