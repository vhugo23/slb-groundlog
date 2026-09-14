import './MapLegend.css'

interface MapLegendProps {
  showWells: boolean
  showCenters: boolean
  onToggleWells: (v: boolean) => void
  onToggleCenters: (v: boolean) => void
}

export function MapLegend({ showWells, showCenters, onToggleWells, onToggleCenters }: MapLegendProps) {
  return (
    <div className="gl-map-legend">
      <div className="gl-map-legend-title">Map context</div>

      <label className="gl-toggle gl-map-legend-row">
        <input type="checkbox" checked={showWells} onChange={(e) => onToggleWells(e.target.checked)} />
        <span className="gl-legend-marker gl-legend-marker-circle" style={{ background: 'var(--status-clean)' }} />
        Wells
      </label>

      <label className="gl-toggle gl-map-legend-row">
        <input type="checkbox" checked={showCenters} onChange={(e) => onToggleCenters(e.target.checked)} />
        <span className="gl-legend-marker gl-legend-marker-diamond" />
        SLB technology centers
      </label>

      <div className="gl-map-legend-divider" />

      <div className="gl-map-legend-sub">
        <span className="gl-legend-marker gl-legend-marker-circle" style={{ background: 'var(--status-clean)' }} /> Clean well
      </div>
      <div className="gl-map-legend-sub">
        <span className="gl-legend-marker gl-legend-marker-circle" style={{ background: 'var(--status-flagged)' }} /> Flagged well
      </div>
      <div className="gl-map-legend-sub">
        <span className="gl-legend-marker gl-legend-marker-diamond" /> Research center
      </div>
      <div className="gl-map-legend-sub">
        <span className="gl-legend-marker gl-legend-marker-triangle" /> Learning center
      </div>
    </div>
  )
}
