import type { CurveSeries, QualityFlag } from '../api'

export interface FlagBand {
  y: number
  height: number
  flagType: QualityFlag['flag_type']
}

function scaleDepthToY(depth: number, minDepth: number, maxDepth: number, height: number): number {
  if (maxDepth === minDepth) return 0
  return ((depth - minDepth) / (maxDepth - minDepth)) * height
}

function scaleValueToX(value: number, minValue: number, maxValue: number, width: number): number {
  if (maxValue === minValue) return width / 2
  return ((value - minValue) / (maxValue - minValue)) * width
}

// minDepth/maxDepth are passed in (the well's own start/stop depth) rather
// than derived from this one curve's sample range, so every track in the
// viewer shares exactly the same vertical scale and a horizontal position
// means the same depth on every track.
export function buildLogTrackPaths(
  curve: CurveSeries,
  width: number,
  height: number,
  minDepth: number,
  maxDepth: number
): string[] {
  const numericValues = curve.values.filter((v): v is number => v !== null)
  if (numericValues.length === 0) return []
  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)

  const segments: string[] = []
  let currentSegment: string[] = []

  // Null gaps break the path into separate segments rather than
  // interpolating across them - a curve_gap flag is real missing data, not
  // a straight line the plot should paper over.
  curve.depths.forEach((depth, i) => {
    const value = curve.values[i]
    if (value === null) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment.join(' '))
        currentSegment = []
      }
      return
    }
    const x = scaleValueToX(value, minValue, maxValue, width)
    const y = scaleDepthToY(depth, minDepth, maxDepth, height)
    currentSegment.push(`${currentSegment.length === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
  })
  if (currentSegment.length > 0) {
    segments.push(currentSegment.join(' '))
  }

  return segments
}

export function getFlagBandsForCurve(
  curve: CurveSeries,
  flags: QualityFlag[],
  height: number,
  minDepth: number,
  maxDepth: number
): FlagBand[] {
  return flags
    .filter(
      (f): f is QualityFlag & { depth_start: number; depth_end: number } =>
        f.curve === curve.mnemonic &&
        (f.flag_type === 'flatline' || f.flag_type === 'out_of_range') &&
        f.depth_start !== null &&
        f.depth_end !== null
    )
    .map((f) => {
      const y1 = scaleDepthToY(f.depth_start, minDepth, maxDepth, height)
      const y2 = scaleDepthToY(f.depth_end, minDepth, maxDepth, height)
      return { y: y1, height: Math.max(y2 - y1, 2), flagType: f.flag_type }
    })
}

// Evenly spaced tick depths plus their fractional position (0 = top/shallow,
// 1 = bottom/deep) along the shared axis, for rendering axis labels and
// matching gridlines across every track.
export function depthAxisTicks(minDepth: number, maxDepth: number, count = 6): { depth: number; fraction: number }[] {
  const ticks: { depth: number; fraction: number }[] = []
  for (let i = 0; i < count; i++) {
    const fraction = i / (count - 1)
    ticks.push({ depth: minDepth + fraction * (maxDepth - minDepth), fraction })
  }
  return ticks
}
