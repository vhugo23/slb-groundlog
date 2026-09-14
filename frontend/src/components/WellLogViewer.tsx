import { useState } from 'react'
import { fetchCurve, type CurveSeries, type QualityFlag, type WellDetail } from '../api'
import { LogTrack } from './LogTrack'
import { depthAxisTicks } from './logTrackMath'
import './WellLogViewer.css'

interface WellLogViewerProps {
  wellId: number
  detail: WellDetail
  curveTracks: CurveSeries[]
  setCurveTracks: React.Dispatch<React.SetStateAction<CurveSeries[]>>
  flags: QualityFlag[]
}

const TRACK_HEIGHT = 420
const TRACK_WIDTH = 150
const TRACK_COLORS = ['var(--track-1)', 'var(--track-2)', 'var(--track-3)', 'var(--track-4)']
const MAX_TRACKS = 4

export function WellLogViewer({ wellId, detail, curveTracks, setCurveTracks, flags }: WellLogViewerProps) {
  const [pending, setPending] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const shownMnemonics = new Set(curveTracks.map((t) => t.mnemonic))
  const minDepth = detail.start_depth
  const maxDepth = detail.stop_depth
  const ticks = depthAxisTicks(minDepth, maxDepth)

  async function toggleCurve(mnemonic: string) {
    setLoadError(null)
    if (shownMnemonics.has(mnemonic)) {
      setCurveTracks((prev) => prev.filter((t) => t.mnemonic !== mnemonic))
      return
    }
    if (curveTracks.length >= MAX_TRACKS) {
      setLoadError(`Showing ${MAX_TRACKS} tracks already — hide one to add another.`)
      return
    }
    setPending(mnemonic)
    try {
      const curve = await fetchCurve(wellId, mnemonic)
      setCurveTracks((prev) => [...prev, curve])
    } catch (err) {
      console.error('Failed to load curve:', err)
      setLoadError(`Could not load ${mnemonic}.`)
    } finally {
      setPending(null)
    }
  }

  return (
    <div>
      <div className="gl-curve-picker">
        {detail.curves.map((mnemonic) => (
          <button
            key={mnemonic}
            className={`gl-curve-chip${shownMnemonics.has(mnemonic) ? ' is-active' : ''}`}
            onClick={() => toggleCurve(mnemonic)}
            disabled={pending === mnemonic}
            aria-pressed={shownMnemonics.has(mnemonic)}
          >
            {mnemonic}
          </button>
        ))}
        {loadError && <span className="gl-curve-picker-error">{loadError}</span>}
      </div>

      {curveTracks.length === 0 ? (
        <p className="gl-log-empty">No curve tracks loaded — select a curve above.</p>
      ) : (
        <div className="gl-log-viewer">
          <div className="gl-log-axis" style={{ height: TRACK_HEIGHT }}>
            <div className="gl-log-axis-header">Depth (m)</div>
            <div className="gl-log-axis-track" style={{ height: TRACK_HEIGHT }}>
              {ticks.map((tick, i) => (
                <span key={i} className="gl-log-axis-tick gl-mono" style={{ top: `${tick.fraction * 100}%` }}>
                  {tick.depth.toFixed(0)}
                </span>
              ))}
            </div>
          </div>
          {curveTracks.map((curve, i) => (
            <LogTrack
              key={curve.mnemonic}
              curve={curve}
              flags={flags}
              minDepth={minDepth}
              maxDepth={maxDepth}
              height={TRACK_HEIGHT}
              width={TRACK_WIDTH}
              color={TRACK_COLORS[i % TRACK_COLORS.length]}
            />
          ))}
        </div>
      )}
      <p className="gl-log-note">
        Flagged bands mark <span style={{ color: 'var(--status-flagged)' }}>flatline</span> and{' '}
        <span style={{ color: 'var(--status-severe)' }}>out-of-range</span> intervals directly on the affected
        curve. Null gaps in the data are preserved, not interpolated across.
      </p>
    </div>
  )
}
