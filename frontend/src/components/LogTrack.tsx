import { useMemo, useState } from 'react'
import type { CurveSeries, QualityFlag } from '../api'
import { buildLogTrackPaths, getFlagBandsForCurve } from './logTrackMath'

interface LogTrackProps {
  curve: CurveSeries
  flags: QualityFlag[]
  minDepth: number
  maxDepth: number
  height: number
  width: number
  color: string
}

export function LogTrack({ curve, flags, minDepth, maxDepth, height, width, color }: LogTrackProps) {
  const [hover, setHover] = useState<{ y: number; depth: number; value: number | null } | null>(null)

  const paths = useMemo(
    () => buildLogTrackPaths(curve, width, height, minDepth, maxDepth),
    [curve, width, height, minDepth, maxDepth]
  )
  const bands = useMemo(
    () => getFlagBandsForCurve(curve, flags, height, minDepth, maxDepth),
    [curve, flags, height, minDepth, maxDepth]
  )

  const numericValues = curve.values.filter((v): v is number => v !== null)
  const minValue = numericValues.length ? Math.min(...numericValues) : 0
  const maxValue = numericValues.length ? Math.max(...numericValues) : 0

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const fraction = Math.min(Math.max(y / height, 0), 1)
    const depth = minDepth + fraction * (maxDepth - minDepth)
    // Nearest sample lookup - fine at this data scale (tens of thousands of
    // points per curve, a linear scan per hover event is imperceptible).
    let nearestIdx = 0
    let nearestDist = Infinity
    for (let i = 0; i < curve.depths.length; i++) {
      const d = Math.abs(curve.depths[i] - depth)
      if (d < nearestDist) {
        nearestDist = d
        nearestIdx = i
      }
    }
    setHover({ y, depth, value: curve.values[nearestIdx] })
  }

  return (
    <div className="gl-log-track">
      <div className="gl-log-track-header">
        <span className="gl-log-track-mnemonic">{curve.mnemonic}</span>
        <span className="gl-log-track-unit gl-mono">{curve.unit}</span>
      </div>
      <div className="gl-log-track-range gl-mono">
        {minValue.toFixed(1)} – {maxValue.toFixed(1)}
      </div>
      <svg width={width} height={height} className="gl-log-track-svg" role="img" aria-label={`${curve.mnemonic} log track`}>
        {bands.map((band, i) => (
          <rect
            key={i}
            x={0}
            y={band.y}
            width={width}
            height={band.height}
            fill={band.flagType === 'flatline' ? 'var(--status-flagged)' : 'var(--status-severe)'}
            fillOpacity={0.14}
          />
        ))}
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={1.25} />
        ))}
        {hover && <line x1={0} x2={width} y1={hover.y} y2={hover.y} stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="2 2" />}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      <div className="gl-log-track-tooltip gl-mono" aria-live="polite">
        {hover ? `${hover.depth.toFixed(1)}m · ${hover.value !== null ? hover.value.toFixed(2) : 'no data'}` : '\u00A0'}
      </div>
    </div>
  )
}
