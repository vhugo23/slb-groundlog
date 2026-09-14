import { useState } from 'react'
import type { WellSummary } from '../api'
import { StatusBadge } from './StatusBadge'
import './WellsPage.css'

interface WellsPageProps {
  wells: WellSummary[]
  loading: boolean
  error: string | null
  isSlow: boolean
  onOpenWell: (wellId: number) => void
}

export function WellsPage({ wells, loading, error, isSlow, onOpenWell }: WellsPageProps) {
  const [search, setSearch] = useState('')
  const filtered = wells.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="gl-page">
      <h1>Wells</h1>
      <p className="gl-page-intro">
        Every well ingested from real LAS well-log files, with the quality status and evidence available to query.
      </p>

      <input
        className="gl-input gl-wells-search"
        type="search"
        placeholder="Search wells by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search wells"
      />

      {error && (
        <div className="gl-card gl-error-card" style={{ marginTop: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      {loading && !error && (
        <p className="gl-page-intro">
          {isSlow ? 'Waking backend service… free-tier hosting can take up to a minute after inactivity.' : 'Loading wells…'}
        </p>
      )}

      {!loading && !error && (
        <div className="gl-card" style={{ marginTop: 'var(--space-4)', padding: 0 }}>
          <table className="gl-table gl-wells-table">
            <thead>
              <tr>
                <th>Well</th>
                <th>Status</th>
                <th>Location</th>
                <th>Curves</th>
                <th>Quality issues</th>
                <th>Depth range</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((well) => (
                <tr key={well.id}>
                  <td>{well.name}</td>
                  <td>
                    <StatusBadge status={well.quality_status} />
                  </td>
                  <td className="gl-mono">
                    {well.location ? `${well.location.lat.toFixed(2)}°, ${well.location.lon.toFixed(2)}°` : '—'}
                  </td>
                  <td className="gl-mono">{well.curve_count}</td>
                  <td className="gl-mono">{well.flag_count}</td>
                  <td className="gl-mono">
                    {well.depth_range.start.toFixed(0)}–{well.depth_range.stop.toFixed(0)}m
                  </td>
                  <td>
                    <button className="gl-btn" onClick={() => onOpenWell(well.id)}>
                      Open workspace
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="gl-wells-empty">
                    No wells match "{search}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
