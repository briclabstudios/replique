import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { trackVisit } from './lib/analytics'
import './styles.css'

registerSW({ immediate: true })
// Les consultations du tableau de bord ne sont pas comptées comme des visites
if (!location.hash.startsWith('#/dashboard')) trackVisit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
