// Branded full-screen loader — shown while the initial auth session/profile
// check resolves, so the app never flashes the wrong screen (logged-out
// homepage, then a jump to HR dashboard) while that request is in flight.
import React from 'react';
import mark from '../../../assets/victory-liner-mark.png';

export function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--surface-page)', zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <img src={mark} alt="" className="loading-pulse" style={{ width: 72, height: 72, animation: 'pulseScale 1.3s ease-in-out infinite' }} />
    </div>
  );
}
export default LoadingScreen;
