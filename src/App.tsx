import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { Drama, Settings } from 'lucide-react'
import { SettingsProvider } from './context/SettingsContext'
import { isSupabaseConfigured } from './lib/supabase'
import Home from './pages/Home'
import Characters from './pages/Characters'
import Summary from './pages/Summary'
import ScenePage from './pages/Scene'
import Admin from './pages/Admin'

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

export default function App() {
  if (!isSupabaseConfigured) return <MissingConfig />

  // HashRouter : les liens profonds fonctionnent sur GitHub Pages sans réécriture serveur
  return (
    <HashRouter>
      <SettingsProvider>
        <header className="topbar">
          <Link to="/" className="brand">
            <Drama size={24} aria-hidden />
            <span>Réplique</span>
          </Link>
          <Link to="/admin" className="icon-button" aria-label="Administration" title="Administration">
            <Settings size={20} />
          </Link>
        </header>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pieces/:playId" element={<Summary />} />
          <Route path="/pieces/:playId/personnages" element={<Characters />} />
          <Route path="/pieces/:playId/scenes/:sceneId" element={<ScenePage />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </SettingsProvider>
    </HashRouter>
  )
}
