import { FLAG_TYPE_DESCRIPTIONS, FLAG_TYPE_LABELS, type QualityFlag } from '../api'
import './QualitySummary.css'

interface QualitySummaryProps {
  flags: QualityFlag[]
}

const ORDER: QualityFlag['flag_type'][] = ['curve_gap', 'flatline', 'out_of_range', 'duplicate_depth']

export function QualitySummary({ flags }: QualitySummaryProps) {
  if (flags.length === 0) {
    return (
      <div className="gl-quality-empty">
        <span className="gl-badge gl-badge-clean">
          <span className="gl-badge-dot" aria-hidden="true" />
          No flags detected
        </span>
        <p>This well has no detected data-quality issues under the four implemented checks.</p>
      </div>
    )
  }

  const counts = new Map<QualityFlag['flag_type'], number>()
  for (const flag of flags) {
    counts.set(flag.flag_type, (counts.get(flag.flag_type) ?? 0) + 1)
  }

  return (
    <div>
      <p className="gl-quality-intro">
        {flags.length} data-quality flag{flags.length === 1 ? '' : 's'} on this well. Flags identify conditions
        worth reviewing — they are data-quality checks, not petrophysical diagnoses, and they don't automatically
        invalidate the well.
      </p>
      <div className="gl-quality-grid">
        {ORDER.filter((type) => counts.has(type)).map((type) => (
          <div className="gl-quality-card" key={type}>
            <div className="gl-quality-card-count gl-mono">{counts.get(type)}</div>
            <div className="gl-quality-card-label">{FLAG_TYPE_LABELS[type]}</div>
            <div className="gl-quality-card-desc">{FLAG_TYPE_DESCRIPTIONS[type]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
