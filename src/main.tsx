import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './i18n'
import { installDeployRecovery } from './lib/deployRecovery'
import { registerPwaUpdates } from './pwa'
import ErrorBoundary from './components/layout/ErrorBoundary'

installDeployRecovery()
registerPwaUpdates()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fullScreen>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
