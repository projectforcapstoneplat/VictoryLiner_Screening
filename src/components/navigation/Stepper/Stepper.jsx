// figma reference: "Interview Process" stepper, application + application-CREATE frames
// The bus is a live position indicator, not a fixed step-0 icon — it drives
// along the track to sit above whichever step is current, with a filled
// "road already traveled" line trailing behind it.
import React from 'react';

function BusIcon() {
  return (
    <svg width={60} height={36} viewBox="0 0 60 36" aria-hidden="true" style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.25))' }}>
      {/* Exhaust smoke — puffs drift up from the back of the bus, only
          animating (and becoming visible) in dark mode, see .stepper-smoke
          in styles.css. */}
      <circle className="stepper-smoke" style={{ animationDelay: '0s' }} cx="1.5" cy="19" r="2" fill="#cfcfcf" />
      <circle className="stepper-smoke" style={{ animationDelay: '0.7s' }} cx="0.5" cy="20" r="1.6" fill="#cfcfcf" />
      <circle className="stepper-smoke" style={{ animationDelay: '1.4s' }} cx="2" cy="18.5" r="1.3" fill="#cfcfcf" />

      <rect x="3" y="5" width="52" height="17" rx="5" fill="var(--action-primary-bg)" />
      <rect x="3" y="5" width="52" height="5.5" rx="5" fill="#fff" opacity="0.14" />
      <rect x="7.5" y="9" width="8" height="7" rx="1.5" fill="var(--surface-card)" />
      <rect x="19.5" y="9" width="8" height="7" rx="1.5" fill="var(--surface-card)" />
      <rect x="31.5" y="9" width="8" height="7" rx="1.5" fill="var(--surface-card)" />
      <rect x="43.5" y="9" width="7.5" height="7" rx="1.5" fill="var(--surface-card)" />
      <g className="stepper-wheel" style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
        <circle cx="15" cy="24" r="5" fill="#2b2b2b" stroke="var(--surface-card)" strokeWidth="1.4" />
        <circle cx="15" cy="24" r="1.7" fill="var(--surface-card)" />
      </g>
      <g className="stepper-wheel" style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
        <circle cx="45" cy="24" r="5" fill="#2b2b2b" stroke="var(--surface-card)" strokeWidth="1.4" />
        <circle cx="45" cy="24" r="1.7" fill="var(--surface-card)" />
      </g>
      {/* Headlight beams — two curved rays fanning out from the headlight,
          invisible in light mode, switched on with the headlight itself in
          dark mode via .stepper-headlight-beam in styles.css. */}
      <path className="stepper-headlight-beam" d="M 57 11 Q 68 4 81 1" fill="none" strokeLinecap="round" strokeWidth="2" />
      <path className="stepper-headlight-beam" d="M 57 16 Q 68 22 79 25" fill="none" strokeLinecap="round" strokeWidth="2" />

      {/* Headlight — off (dim gray) in light mode, switches on with a warm
          glow in dark mode via the .stepper-headlight rule in styles.css. */}
      <circle className="stepper-headlight" cx="54" cy="13.5" r="2.9" fill="var(--gray-400)" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function Stepper({ steps = ['Create an Account/ Sign In', 'My Information/ Resume', 'Processing', 'Video Screening', 'Review'], current = 0 }) {
  // Each step's dot sits at the horizontal center of its own flex column
  // (columns are equal-width, `flex: 1`, content centered) — i.e. at
  // (i + 0.5) / steps.length of the row. The track/fill/bus must be
  // positioned against that same formula, not a fixed pixel inset, or they
  // drift out of alignment with the actual dots at any width other than the
  // one the pixel value happened to be tuned for.
  const centerPct = (i) => ((i + 0.5) / steps.length) * 100;
  const startPct = centerPct(0);
  const endPct = centerPct(steps.length - 1);
  const busPct = centerPct(current);

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-ui)', paddingTop: 30 }}>
      {/* Solid, high-contrast gray (gray-400, not the near-white gray-200) at
          5px — real browser page-zoom (not just the CSS `zoom` property)
          rescales rasterization in ways a low-contrast hairline doesn't
          survive. Contrast against the page background, not just non-zero
          opacity, is what actually keeps this visible across zoom levels. */}
      <div style={{ position: 'absolute', left: `${startPct}%`, right: `${100 - endPct}%`, top: 24, height: 5, borderRadius: 999, background: 'var(--gray-400)', zIndex: 0 }} />
      <div
        style={{
          position: 'absolute', left: `${startPct}%`, top: 24, height: 5, borderRadius: 999, zIndex: 0,
          width: `${Math.max(busPct - startPct, 0)}%`,
          background: 'linear-gradient(90deg, var(--red-700), var(--action-primary-bg))',
          transition: 'width 0.9s cubic-bezier(0.65, 0, 0.35, 1)',
        }}
      />
      <div
        style={{
          position: 'absolute', top: 24, zIndex: 2, transform: 'translateY(-50%)',
          left: `calc(${busPct}% - 30px)`,
          transition: 'left 0.9s cubic-bezier(0.65, 0, 0.35, 1)',
        }}
      >
        <div className="stepper-bus">
          <BusIcon />
        </div>
      </div>

      {steps.map((label, i) => (
        <div key={i} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1 }}>
          {i < current ? (
            <span style={{
              width: 16, height: 16, borderRadius: '50%', background: 'var(--action-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 5px var(--surface-page)', transition: 'background 0.4s ease',
            }}>
              <CheckIcon />
            </span>
          ) : (
            <span
              className={i === current ? 'stepper-dot-current' : ''}
              style={{
                width: 12, height: 12, borderRadius: '50%',
                background: i === current ? 'var(--action-primary-bg)' : 'var(--gray-500)',
                boxShadow: '0 0 0 6px var(--surface-page)',
                transition: 'background 0.4s ease',
              }}
            />
          )}
          <span style={{
            fontSize: 'var(--text-sm)', color: i === current ? 'var(--action-primary-bg)' : 'var(--text-primary)',
            fontWeight: i === current ? 700 : 400, textAlign: 'center', transition: 'color 0.3s ease',
          }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
export default Stepper;
