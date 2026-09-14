import { useWellDetail } from '../hooks/useWellDetail'
import { StatusBadge } from './StatusBadge'
import { QualitySummary } from './QualitySummary'
import { QualityFlagTable } from './QualityFlagTable'
import { WellLogViewer } from './WellLogViewer'
import { GroundedQueryPanel } from './GroundedQueryPanel'
import type { WellSummary } from '../api'
import './WellWorkspace.css'

interface WellWorkspaceProps {
  wellId: number
  wellSummary: WellSummary | null
  onBack: () => void
}

export function WellWorkspace({ wellId, wellSummary, onBack }: WellWorkspaceProps) {
  const { detail, curveTracks, setCurveTracks, loading, error } = useWellDetail(wellId)

  return (
    <div className="gl-page gl-workspace">
      <button className="gl-btn gl-btn-ghost gl-back-link" onClick={onBack}>
        ‹ Back to Wells
      </button>

      <header className="gl-workspace-header">
        <div>
          <h1>{wellSummary?.name ?? detail?.name ?? `Well ${wellId}`}</h1>
          <div className="gl-workspace-meta">
            {wellSummary && <StatusBadge status={wellSummary.quality_status} />}
            {wellSummary?.location && (
              <span className="gl-mono gl-workspace-meta-item">
                {wellSummary.location.lat.toFixed(2)}°, {wellSummary.location.lon.toFixed(2)}°
              </span>
            )}
            {wellSummary && (
              <span className="gl-workspace-meta-item">
                {wellSummary.curve_count} curve{wellSummary.curve_count === 1 ? '' : 's'}
              </span>
            )}
            {wellSummary && (
              <span className="gl-workspace-meta-item">
                {wellSummary.flag_count} quality issue{wellSummary.flag_count === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="gl-card gl-error-card">
          <strong>Could not load this well.</strong> {error}
        </div>
      )}

      {loading && !detail && (
        <div className="gl-workspace-skeleton">
          <div className="gl-skeleton-block" style={{ height: 90 }} />
          <div className="gl-skeleton-block" style={{ height: 420 }} />
          <div className="gl-skeleton-block" style={{ height: 160 }} />
        </div>
      )}

      {detail && (
        <>
          <section className="gl-card gl-workspace-section">
            <h2>Data quality</h2>
            <QualitySummary flags={detail.quality_flags} />
          </section>

          <section className="gl-card gl-workspace-section">
            <h2>Well log</h2>
            <WellLogViewer
              wellId={wellId}
              detail={detail}
              curveTracks={curveTracks}
              setCurveTracks={setCurveTracks}
              flags={detail.quality_flags}
            />
          </section>

          {detail.quality_flags.length > 0 && (
            <section className="gl-card gl-workspace-section">
              <h2>Quality flags</h2>
              <QualityFlagTable flags={detail.quality_flags} />
            </section>
          )}

          <section className="gl-card gl-workspace-section">
            <h2>Grounded query</h2>
            <GroundedQueryPanel wellId={wellId} />
          </section>
        </>
      )}
    </div>
  )
}
