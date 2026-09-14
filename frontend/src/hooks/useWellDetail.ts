import { useEffect, useState } from 'react'
import { fetchCurve, fetchWellDetail, type CurveSeries, type WellDetail } from '../api'

const PREFERRED_MNEMONICS = ['GR', 'NPHI', 'RHOB', 'CALI']
const MAX_TRACKS = 4

export function useWellDetail(wellId: number | null, availableCurveMnemonics?: string[]) {
  const [detail, setDetail] = useState<WellDetail | null>(null)
  const [curveTracks, setCurveTracks] = useState<CurveSeries[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (wellId === null) {
      setDetail(null)
      setCurveTracks([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)
    setCurveTracks([])

    fetchWellDetail(wellId)
      .then((data) => {
        if (cancelled) return
        setDetail(data)

        const requested = availableCurveMnemonics
        const available = requested && requested.length > 0 ? requested : data.curves
        const preferred = PREFERRED_MNEMONICS.filter((m) => available.includes(m))
        const mnemonicsToPlot =
          preferred.length > 0 ? preferred.slice(0, MAX_TRACKS) : available.slice(0, MAX_TRACKS)

        return Promise.all(mnemonicsToPlot.map((m) => fetchCurve(wellId, m))).then((tracks) => {
          if (!cancelled) setCurveTracks(tracks)
        })
      })
      .catch((err) => {
        console.error('Failed to fetch well detail:', err)
        if (!cancelled) setError("Could not load this well's data — the API may be unreachable.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wellId])

  return { detail, curveTracks, loading, error, setCurveTracks }
}
