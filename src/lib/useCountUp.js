import { useEffect, useRef, useState } from 'react';

// Animates from the last *settled* value up (or down) to `target` whenever
// `trigger` is true and `target`/`trigger`/`duration` actually change —
// React's own effect dependency array already handles "don't replay on an
// unrelated re-render" for that, so nothing extra is needed here for it.
//
// Deliberately has no manual "already ran for this target" guard of its
// own (an earlier version tried two different ones, both broken the same
// way) — this app renders under <StrictMode> (see main.jsx), which
// intentionally mounts every component's effects twice in dev: run, cancel
// (simulated unmount), run again (simulated remount), specifically to catch
// effects that don't tolerate being interrupted and re-run. The first of
// those two runs gets its requestAnimationFrame loop cancelled by the
// cleanup before it ever reaches `target` — a self-tracking guard that
// treats "I already started animating toward this target" as "done" then
// permanently skips the second run too, freezing the displayed value at
// whatever it was the instant it got cancelled (often still ~0). Relying
// purely on the effect dependency array instead means the second,
// uninterrupted StrictMode run always fires and finishes normally, and a
// genuinely later target change (a live dashboard refresh) still re-runs
// and animates smoothly from the last value that actually finished
// (`fromRef`, only updated on a completed run, not a cancelled one).
export function useCountUp(target, trigger, duration = 1200) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!trigger) return;
    const from = fromRef.current;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [trigger, target, duration]);

  return value;
}
