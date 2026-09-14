import { useEffect, useState } from 'react'
import { fetchWells, type WellSummary } from '../api'

// Render's free tier spins the backend down after inactivity; the first
// request after that can take up to ~50s. A generic spinner for that long
// looks broken, so after a short delay we switch the loading copy to say
// what's actually happening instead of pretending it's a normal fetch.
const SLOW_LOAD_THRESHOLD_MS = 4000

export function useWells() {
  const [wells, setWells] = useState<WellSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setIsSlow(false)

    const slowTimer = setTimeout(() => {
      if (!cancelled) setIsSlow(true)
    }, SLOW_LOAD_THRESHOLD_MS)

    fetchWells()
      .then((data) => {
        if (!cancelled) setWells(data)
      })
      .catch((err) => {
        console.error('Failed to fetch wells:', err)
        if (!cancelled) {
          setError(
            'Could not load wells — the backend may be waking up (free-tier services can take up to a minute after inactivity) or is unreachable.'
          )
        }
      })
      .finally(() => {
        clearTimeout(slowTimer)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      clearTimeout(slowTimer)
    }
  }, [])

  return { wells, loading, error, isSlow }
}
