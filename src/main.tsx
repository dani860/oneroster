import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', color: 'red', direction: 'rtl' }}>
        <b>שגיאה:</b> {this.state.error}
      </div>
    )
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
