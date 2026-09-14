import type { WellSummary } from '../api'
import { FLAG_TYPE_LABELS, type QualityFlag } from '../api'
import { useAllWellDetails } from '../hooks/useAllWellDetails'
import { StatusBadge } from './StatusBadge'
import { ExploreMap } from './ExploreMap'
import './OverviewPage.css'

interface OverviewPageProps {
  wells: WellSummary[]
  wellsLoading: boolean
  wellsError: string | null
  wellsSlow: boolean
  onOpenWell: (wellId: number) => void
  onOpenMap: () => void
  onOpenWells: () => void
}

const FLAG_ORDER: QualityFlag['flag_type'][] = ['curve_gap', 'flatline', 'out_of_range', 'duplicate_depth']

// Dataset-scale figures the ingestion + real Volve/FORCE-2020 source files
// produced (~1.75M depth/value pairs). The current API doesn't expose an
// aggregate byte/pair count, so this one figure is labeled as static
// dataset context rather than presented as live telemetry - see the
// project's own design-decisions doc for the source computation.
const DEPTH_VALUE_PAIRS_LABEL = '~1.75M'

export function OverviewPage({ wells, wellsLoading, wellsError, wellsSlow, onOpenWell, onOpenMap, onOpenWells }: OverviewPageProps) {
  const { details, loading: detailsLoading } = useAllWellDetails(wells)

  const cleanCount = wells.filter((w) => w.quality_status === 'clean').length
  const flaggedCount = wells.filter((w) => w.quality_status === 'flagged').length
  const totalCurves = wells.reduce((sum, w) => sum + w.curve_count, 0)
  const totalFlags = wells.reduce((sum, w) => sum + w.flag_count, 0)

  const flagTypeCounts = new Map<QualityFlag['flag_type'], number>()
  for (const detail of details) {
    for (const flag of detail.quality_flags) {
      flagTypeCounts.set(flag.flag_type, (flagTypeCounts.get(flag.flag_type) ?? 0) + 1)
    }
  }
  const maxFlagCount = Math.max(1, ...Array.from(flagTypeCounts.values()))

  return (
    <div className="gl-page gl-overview">
      <header className="gl-overview-hero">
        <h1>Subsurface data, checked before it's trusted.</h1>
        <p className="gl-page-intro">
          GroundLog ingests real LAS well-log files, flags data-quality problems automatically, and answers
          questions about a well only from retrieved, cited records — refusing outright when the data doesn't
          support a claim.
        </p>
      </header>

      <section className="gl-overview-metrics">
        <Metric label="Wells" value={wellsLoading ? '…' : wells.length || '—'} />
        <Metric label="Curve series" value={wellsLoading ? '…' : totalCurves || '—'} />
        <Metric label="Quality flags" value={wellsLoading ? '…' : totalFlags || '—'} />
        <Metric label="Depth/value pairs" value={DEPTH_VALUE_PAIRS_LABEL} isStatic />
      </section>
      {wellsError && <div className="gl-card gl-error-card">{wellsError}</div>}

      <div className="gl-overview-grid">
        <section className="gl-card">
          <h2>Data quality overview</h2>
          <p className="gl-overview-section-note">
            {wellsLoading
              ? wellsSlow
                ? 'Waking backend service… free-tier hosting can take up to a minute after inactivity.'
                : 'Loading…'
              : `${cleanCount} clean, ${flaggedCount} flagged, out of ${wells.length} wells. Flags identify data-quality conditions for review; they do not automatically invalidate a well.`}
          </p>

          {detailsLoading ? (
            <p className="gl-overview-section-note">Computing flag breakdown…</p>
          ) : (
            <div className="gl-flag-bars">
              {FLAG_ORDER.filter((t) => flagTypeCounts.has(t)).map((type) => (
                <div className="gl-flag-bar-row" key={type}>
                  <span className="gl-flag-bar-label">{FLAG_TYPE_LABELS[type]}</span>
                  <div className="gl-flag-bar-track">
                    <div
                      className="gl-flag-bar-fill"
                      style={{ width: `${((flagTypeCounts.get(type) ?? 0) / maxFlagCount) * 100}%` }}
                    />
                  </div>
                  <span className="gl-flag-bar-count gl-mono">{flagTypeCounts.get(type)}</span>
                </div>
              ))}
              {flagTypeCounts.size === 0 && !wellsLoading && (
                <p className="gl-overview-section-note">No quality flags detected across the current dataset.</p>
              )}
            </div>
          )}
        </section>

        <section className="gl-card">
          <h2>Grounded query, precisely</h2>
          <p className="gl-query-flow gl-mono">
            Question&nbsp;→&nbsp;exact record match&nbsp;→&nbsp;PostgreSQL retrieval&nbsp;→&nbsp;Gemini constrained
            to retrieved evidence&nbsp;→&nbsp;answer + citation OR refusal
          </p>
          <p className="gl-overview-section-note">
            This is structured record retrieval, not vector search or RAG — the question is matched to an exact
            curve or quality-flag record, and only that record is sent to the model.
          </p>
          <p className="gl-overview-section-note gl-overview-benchmark-note">
            Evaluation harness: versioned golden + unanswerable test cases. Current benchmark: pending clean
            re-run.
          </p>
        </section>
      </div>

      <section className="gl-card gl-overview-map-card">
        <div className="gl-overview-map-card-header">
          <h2>Where the data comes from</h2>
          <button className="gl-btn" onClick={onOpenMap}>
            Open full map
          </button>
        </div>
        <ExploreMap wells={wells} onOpenWell={onOpenWell} height="320px" showLegend={false} />
      </section>

      <section className="gl-card">
        <div className="gl-overview-map-card-header">
          <h2>Wells</h2>
          <button className="gl-btn" onClick={onOpenWells}>
            View all wells
          </button>
        </div>
        <table className="gl-table">
          <thead>
            <tr>
              <th>Well</th>
              <th>Status</th>
              <th>Location</th>
              <th>Curves</th>
              <th>Issues</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {wells.map((well) => (
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
                <td>
                  <button className="gl-btn" onClick={() => onOpenWell(well.id)}>
                    Open workspace
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Metric({ label, value, isStatic }: { label: string; value: string | number; isStatic?: boolean }) {
  return (
    <div className="gl-metric">
      <div className="gl-metric-value gl-mono">{value}</div>
      <div className="gl-metric-label">
        {label}
        {isStatic && <span className="gl-metric-static-tag">dataset context</span>}
      </div>
    </div>
  )
}
