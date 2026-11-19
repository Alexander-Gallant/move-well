import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // Reload a page that was already controlled so it uses the new asset graph.
  if (navigator.serviceWorker.controller) {
    let hasReloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloaded) return
      hasReloaded = true
      window.location.reload()
    })
  }

  const serviceWorkerUrl = new URL(`${import.meta.env.BASE_URL}sw.js`, document.baseURI).toString()

  void navigator.serviceWorker
    .register(serviceWorkerUrl)
    .then((registration) => registration.update().catch(() => undefined))
    .catch(() => undefined)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

window.addEventListener('load', registerServiceWorker)
