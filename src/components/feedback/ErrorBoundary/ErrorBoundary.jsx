// Catches unexpected render errors anywhere below it so the whole app
// doesn't unmount to a blank white screen — must be a class component,
// React only supports error boundaries via getDerivedStateFromError/
// componentDidCatch, there's no hook equivalent.
import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: 40, textAlign: 'center', fontFamily: 'system-ui, sans-serif', background: '#fff', color: '#1a1a1a',
      }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, opacity: 0.75, maxWidth: 420, margin: 0 }}>
          An unexpected error occurred. Reloading the page usually fixes this — if it keeps happening, please contact us.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            border: 'none', cursor: 'pointer', borderRadius: 999, padding: '12px 28px',
            background: '#b93232', color: '#fff', fontWeight: 700, fontSize: 14,
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }
}
export default ErrorBoundary;
