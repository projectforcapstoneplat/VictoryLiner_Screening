import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/styles.css'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './lib/ThemeContext.jsx'
import { ErrorBoundary } from './components/feedback/ErrorBoundary/ErrorBoundary.jsx'
import { ApiKeyMonitor } from './components/debug/ApiKeyMonitor/ApiKeyMonitor.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
        <ApiKeyMonitor />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
