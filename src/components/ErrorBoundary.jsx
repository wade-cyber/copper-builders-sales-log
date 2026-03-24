import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: 520, margin: '3rem auto', padding: '2rem 1rem', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 18, color: 'var(--slate-dark)', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 16 }}>
            Please refresh the page to try again.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              height: 36, padding: '0 20px', background: 'var(--slate-dark)', color: 'var(--white)',
              border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, letterSpacing: '.06em',
              textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
