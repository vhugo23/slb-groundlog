import { useEffect, useState } from 'react'
import { fetchWellDetail, type WellDetail, type WellSummary } from '../api'

// Only fires once wells are known, and only re-fires if the well-id set
// actually changes - not on every render. At current scale (5 wells) this
// is 5 lightweight requests, not the "expensive fetch" the redesign brief
// warns against faking around; it's what lets the Overview page compute a
// real per-flag-type breakdown instead of a static or invented one.
export function useAllWellDetails(wells: WellSummary[]) {
  const [details, setDetails] = useState<WellDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const idsKey = wells
    .map((w) => w.id)
    .sort((a, b) => a - b)
    .join(',')

  useEffect(() => {
    if (wells.length === 0) {
      setDetails([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all(wells.map((w) => fetchWellDetail(w.id)))
      .then((data) => {
        if (!cancelled) setDetails(data)
      })
      .catch((err) => {
        console.error('Failed to fetch aggregate well details:', err)
        if (!cancelled) setError('Could not load quality-flag detail for one or more wells.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  return { details, loading, error }
}
