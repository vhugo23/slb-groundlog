// VITE_API_BASE_URL, when set, points at a deployed backend (Render). Vite
// only exposes env vars prefixed VITE_ to browser code - anything else stays
// server-only, by design. Falling back to localhost keeps local dev working
// exactly as before when the var isn't set.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export interface Location {
  lat: number
  lon: number
}

export interface DepthRange {
  start: number
  stop: number
}

export interface WellSummary {
  id: number
  name: string
  quality_status: 'clean' | 'flagged'
  depth_range: DepthRange
  curve_count: number
  flag_count: number
  location: Location | null
}

export interface QualityFlag {
  flag_type: 'duplicate_depth' | 'curve_gap' | 'flatline' | 'out_of_range'
  curve: string | null
  depth_start: number | null
  depth_end: number | null
  detail: string
}

export interface WellDetail {
  id: number
  name: string
  start_depth: number
  stop_depth: number
  curves: string[]
  quality_flags: QualityFlag[]
}

export interface CurveSeries {
  mnemonic: string
  unit: string
  depths: number[]
  values: (number | null)[]
}

export interface QueryResult {
  grounded: boolean
  answer: string
  citation: string | null
}

export const FLAG_TYPE_LABELS: Record<QualityFlag['flag_type'], string> = {
  duplicate_depth: 'Duplicate depth',
  curve_gap: 'Curve gap',
  flatline: 'Flatline',
  out_of_range: 'Out of range',
}

export const FLAG_TYPE_DESCRIPTIONS: Record<QualityFlag['flag_type'], string> = {
  duplicate_depth: 'The same depth value appears more than once in the index.',
  curve_gap: 'Three or more consecutive null samples in a curve.',
  flatline: 'Twenty or more consecutive near-identical values — often a stuck sensor.',
  out_of_range: "A reading outside the curve's plausible physical range.",
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) {
    throw new Error(`Request to ${path} returned ${res.status}`)
  }
  return res.json()
}

export function fetchWells(): Promise<WellSummary[]> {
  return fetchJson<WellSummary[]>('/wells')
}

export function fetchWellDetail(wellId: number): Promise<WellDetail> {
  return fetchJson<WellDetail>(`/wells/${wellId}`)
}

export function fetchCurve(wellId: number, mnemonic: string): Promise<CurveSeries> {
  return fetchJson<CurveSeries>(`/wells/${wellId}/curves/${mnemonic}`)
}

export function postQuery(wellId: number, question: string): Promise<QueryResult> {
  return fetchJson<QueryResult>(`/wells/${wellId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
}
