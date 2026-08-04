// figma reference: "Interview Process" stepper, application + application-CREATE frames
import React from 'react';
const busPath = "M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1A1.5 1.5 0 1 1 7.5 14a1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM18 10H6V6h12v4z";
export function Stepper({ steps = ['Create an Account/ Sign In', 'My Information/ Resume', 'Processing', 'Video Screening', 'Review'], current = 0 }) {
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-ui)' }}>
      <div style={{ position: 'absolute', left: 24, right: 24, top: 24, height: 1.5, background: 'var(--gray-500)', zIndex: 0 }} />
      {steps.map((label, i) => (
        <div key={i} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1 }}>
          {i === 0 ? (
            <svg width={24} height={24} viewBox="0 0 24 24" fill="var(--action-primary-bg)" style={{ background: 'var(--surface-page)' }}><path d={busPath} /></svg>
          ) : (
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              background: i <= current ? 'var(--action-primary-bg)' : 'var(--gray-500)',
              boxShadow: '0 0 0 6px var(--surface-page)',
            }} />
          )}
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textAlign: 'center' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
export default Stepper;
