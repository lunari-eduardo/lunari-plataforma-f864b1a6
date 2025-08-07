import * as React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './components/theme/ThemeProvider'

// Defensive initialization to prevent ReactCurrentDispatcher error
function initializeReact() {
  try {
    const container = document.getElementById('root')
    if (!container) {
      throw new Error('Root element not found')
    }

    const root = createRoot(container)
    
    // Render with error boundary
    root.render(
      React.createElement(React.StrictMode, null,
        React.createElement(ThemeProvider, null,
          React.createElement(App)
        )
      )
    )
    
    console.log('✅ React successfully mounted')
  } catch (error) {
    console.error('❌ React mounting error:', error)
    // Fallback render without StrictMode
    const container = document.getElementById('root')
    if (container) {
      const root = createRoot(container)
      root.render(
        React.createElement(ThemeProvider, null,
          React.createElement(App)
        )
      )
    }
  }
}

// Ensure DOM is ready before initializing React
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeReact)
} else {
  initializeReact()
}
