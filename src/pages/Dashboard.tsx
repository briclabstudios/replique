import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useLoader } from '../hooks/useLoader'
import { fetchVisitStats, type VisitRow, type VisitStats } from '../lib/analytics'

// Page non liée dans l'app : accessible seulement via #/dashboard

const PERIODS = [7, 30, 90, 365]

const DEVICE_LABEL: Record<string, string> = { mobile: 'Téléphone', tablet: 'Tablette', desktop: 'Ordinateur' }

const SECTIONS: { key: keyof VisitStats['breakdown']; title: string; label?: (value: string) => string }[] = [
  { key: 'timezone', title: 'Localisation (fuseau horaire)', label: placeLabel },
  { key: 'device', title: 'Appareil', label: (v) => DEVICE_LABEL[v] ?? v },
  { key: 'mode', title: 'Ouverture' },
  { key: 'os', title: 'Système' },
  { key: 'browser', title: 'Navigateur' },
  { key: 'language', title: 'Langue' },
]

/** « Europe/Paris » → « Paris (Europe) » */
function placeLabel(timezone: string): string {
  const [region, ...rest] = timezone.split('/')
  if (!rest.length) return timezone
  return `${rest.join(' / ').replace(/_/g, ' ')} (${region})`
}

function isoDay(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
}

/** Une entrée par jour de la période, y compris les jours sans visite. */
function fillDays(daily: VisitStats['daily'], days: number) {
  const byDay = new Map(daily.map((d) => [d.day, d]))
  return Array.from({ length: days }, (_, i) => {
    const day = isoDay(new Date(Date.now() - (days - 1 - i) * 86_400_000))
    return byDay.get(day) ?? { day, sessions: 0, visitors: 0 }
  })
}

function DailyChart({ stats, days }: { stats: VisitStats; days: number }) {
  const series = fillDays(stats.daily, days)
  const max = Math.max(1, ...series.map((d) => d.sessions))
  const format = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  return (
    <section className="card">
      <h2>Fréquentation par jour</h2>
      <div className="chart" role="img" aria-label="Sessions et visiteurs uniques par jour">
        {series.map((d) => (
          <div key={d.day} className="chart-col" title={`${format(d.day)} : ${d.visitors} visiteur(s), ${d.sessions} session(s)`}>
            <div className="chart-bar sessions" style={{ height: `${(d.sessions / max) * 100}%` }} />
            <div className="chart-bar visitors" style={{ height: `${(d.visitors / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="row chart-axis muted small">
        <span>{format(series[0].day)}</span>
        <span className="spacer" />
        <span>{format(series[series.length - 1].day)}</span>
      </div>
      <div className="row wrap legend small">
        <span><i className="swatch visitors" /> Visiteurs uniques</span>
        <span><i className="swatch sessions" /> Sessions</span>
      </div>
    </section>
  )
}

function Breakdown({ title, rows, label }: { title: string; rows: VisitRow[]; label?: (value: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.visitors))
  return (
    <section className="card">
      <h2>{title}</h2>
      <ul className="breakdown">
        {rows.slice(0, 8).map((r) => (
          <li key={r.value}>
            <div className="row">
              <span>{label ? label(r.value) : r.value}</span>
              <span className="spacer" />
              <strong>{r.visitors}</strong>
              <span className="muted small">/ {r.sessions} sess.</span>
            </div>
            <div className="meter"><div style={{ width: `${(r.visitors / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function Dashboard() {
  const [days, setDays] = useState(30)
  const { data: stats, error, loading, reload } = useLoader(() => fetchVisitStats(days), [days])

  return (
    <main className="container">
      <div className="row">
        <h1 className="section-title">Statistiques</h1>
        <span className="spacer" />
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Période">
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {p === 365 ? '12 derniers mois' : `${p} derniers jours`}
            </option>
          ))}
        </select>
        <button className="icon-button" onClick={reload} aria-label="Actualiser" title="Actualiser" disabled={loading}>
          <RefreshCw size={18} />
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {!stats && loading && <p className="muted">Chargement…</p>}

      {stats && (
        <>
          <div className="kpis">
            <div className="card kpi">
              <span className="eyebrow">Visiteurs uniques</span>
              <strong>{stats.visitors}</strong>
            </div>
            <div className="card kpi">
              <span className="eyebrow">Nouveaux visiteurs</span>
              <strong>{stats.new_visitors}</strong>
            </div>
            <div className="card kpi">
              <span className="eyebrow">Sessions</span>
              <strong>{stats.sessions}</strong>
            </div>
          </div>

          {stats.sessions === 0 ? (
            <p className="muted">Aucune visite sur cette période.</p>
          ) : (
            <>
              <DailyChart stats={stats} days={days} />
              <div className="grid">
                {SECTIONS.map(({ key, title, label }) =>
                  stats.breakdown[key]?.length ? (
                    <Breakdown key={key} title={title} rows={stats.breakdown[key]} label={label} />
                  ) : null,
                )}
              </div>

              <section className="card">
                <h2>Dernières sessions</h2>
                <div className="table-scroll">
                  <table className="visits-table small">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Lieu</th>
                        <th>Appareil</th>
                        <th>Navigateur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent.map((v, i) => (
                        <tr key={i}>
                          <td>{new Date(v.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td>{v.timezone ? placeLabel(v.timezone) : '—'}</td>
                          <td>
                            {DEVICE_LABEL[v.device ?? ''] ?? '—'} · {v.os ?? '—'}
                            {v.standalone && <span className="muted"> · appli</span>}
                          </td>
                          <td>{v.browser ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          <p className="muted small">
            Une session = une ouverture de l’app (nouvelle session après 30 min d’inactivité). Visiteur unique = un
            appareil/navigateur. La localisation vient du fuseau horaire de l’appareil : aucune adresse IP n’est stockée.
          </p>
        </>
      )}
    </main>
  )
}
