import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

// ── Sentry — monitoreo de errores y performance ────────────────────────────────
// Solo se activa si VITE_SENTRY_DSN está definido.
// En desarrollo: dejar vacío en .env.local para no contaminar métricas de producción.
// En producción (Railway): configurar VITE_SENTRY_DSN en las env vars del servicio.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),   // Traza navegación y fetch
      Sentry.replayIntegration({
        maskAllText: false,                 // No enmascarar texto (ajustar si hay PII)
        blockAllMedia: false,
      }),
    ],
    // Muestra el 20% de requests en el panel de performance
    tracesSampleRate: 0.2,
    // Graba sesión solo en el 5% del tráfico normal...
    replaysSessionSampleRate: 0.05,
    // ...pero el 100% de las sesiones donde ocurre un error
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,     // "development" | "production"
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
