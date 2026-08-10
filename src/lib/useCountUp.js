import { useEffect, useRef, useState } from 'react';

// Animates 0 -> target once `trigger` becomes true (e.g. a stat tile
// scrolling into view). Ease-out cubic so it settles rather than ticking evenly.
export function useCountUp(target, trigger, duration = 1200) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!trigger || startedRef.current) return;
    startedRef.current = true;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [trigger, target, duration]);

  return value;
}
