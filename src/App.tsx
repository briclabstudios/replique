import { useLayoutEffect, useRef } from 'react'
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { Drama, Info } from 'lucide-react'
import { SettingsProvider } from './context/SettingsContext'
import { isSupabaseConfigured } from './lib/supabase'
import Home from './pages/Home'
import Characters from './pages/Characters'
import Summary from './pages/Summary'
import ScenePage from './pages/Scene'
import Admin from './pages/Admin'
import Dashboard from './pages/Dashboard'
import InfoPage from './pages/Info'

function MissingConfig() {
  return (
    <main className="container">
      <div className="card">
        <h1>Configuration requise</h1>
        <p>
          Renseignez <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans un fichier{' '}
          <code>.env.local</code> (voir <code>.env.example</code> et le README).
        </p>
      </div>
    </main>
  )
}

/** Barre du haut ; sa hauteur (variable avec l'encoche des téléphones) est exposée en --topbar-height. */
function TopBar() {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => document.documentElement.style.setProperty('--topbar-height', `${el.offsetHeight}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <header ref={ref} className="topbar">
      <Link to="/" className="brand">
        <Drama size={24} aria-hidden />
        <span className="app-name">Réplique</span>
      </Link>
      <Link to="/infos" className="icon-button" aria-label="Informations" title="Informations">
        <Info size={20} />
      </Link>
    </header>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <MissingConfig />

  // HashRouter : les liens profonds fonctionnent sur GitHub Pages sans réécriture serveur
  return (
    <HashRouter>
      <SettingsProvider>
        <TopBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pieces/:playId" element={<Summary />} />
          <Route path="/pieces/:playId/personnages" element={<Characters />} />
          <Route path="/pieces/:playId/scenes/:sceneId" element={<ScenePage />} />
          <Route path="/infos" element={<InfoPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </SettingsProvider>
    </HashRouter>
  )
}
