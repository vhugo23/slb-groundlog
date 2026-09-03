import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import './App.css'

// Leaflet's default marker icon URLs assume a plain <script> setup, not a
// bundler - without this, markers render as broken images under Vite.
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

interface Well {
  id: number
  name: string
  quality_status: string
  location: { lat: number; lon: number } | null
}

interface QualityFlag {
  flag_type: string
  curve: string
  depth_start: number
  depth_end: number
  detail: string
}

interface CurveData {
  mnemonic: string
  unit: string
  depths: number[]
  values: (number | null)[]
}

interface FlagBand {
  y: number
  height: number
}

interface SlbCenter {
  name: string
  lat: number
  lon: number
  type: 'research' | 'learning'
  description: string
  link: string
}

function getMarkerIcon(qualityStatus: string) {
  const color = qualityStatus === 'clean' ? '#22c55e' : '#f97316'
  return L.divIcon({
    className: '',
    html: `<div style="background-color:${color}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 3px rgba(0,0,0,0.6);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

const SLB_CENTERS: SlbCenter[] = [
  { name: 'Clamart Technology Center (France)', lat: 48.7942, lon: 2.2686, type: 'research', description: "SLB's largest technology hub in Europe—and its second largest worldwide.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Cambridge Research Center (UK)', lat: 52.2168, lon: 0.1568, type: 'research', description: 'Pioneers new energy solutions — hydrogen, geothermal energy, lithium extraction, energy storage, and carbon sequestration.', link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Schlumberger-Doll Research Center (Cambridge, MA)', lat: 42.3656, lon: -71.0836, type: 'research', description: "Established in 1948; one of SLB's most celebrated and innovative research centers.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Beijing Geoscience Center (China)', lat: 39.9042, lon: 116.4074, type: 'research', description: "Serves as the digital backbone of SLB's drilling solutions.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Dhahran Research Center (Saudi Arabia)', lat: 26.2361, lon: 50.0393, type: 'research', description: "Crucial to advancing SLB's understanding of carbonate reservoirs.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Kellyville Learning Center (near Tulsa, USA)', lat: 36.1540, lon: -95.9928, type: 'learning', description: "A cornerstone of SLB's training and development efforts, empowering teams for over 50 years.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
  { name: 'Middle East and Asia Learning Center (Abu Dhabi, UAE)', lat: 24.4539, lon: 54.3773, type: 'learning', description: "Nurtures SLB's global workforce, shaping the workforce of tomorrow.", link: 'https://www.slb.com/about/who-we-are/our-technology' },
]

const slbIcon = L.divIcon({
  className: '',
  html: `<div style="background-color:#6366f1; width:14px; height:14px; transform:rotate(45deg); border:2px solid white; box-shadow:0 0 3px rgba(0,0,0,0.6);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

// VITE_API_BASE_URL, when set, points at a deployed backend (Render). Vite
// only exposes env vars prefixed VITE_ to browser code - anything else stays
// server-only, by design. Falling back to localhost keeps local dev working
// exactly as before when the var isn't set.
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function scaleDepthToY(depth: number, minDepth: number, maxDepth: number, height: number): number {
  return ((depth - minDepth) / (maxDepth - minDepth)) * height
}

function scaleValueToX(value: number, minValue: number, maxValue: number, width: number): number {
  return ((value - minValue) / (maxValue - minValue)) * width
}

function buildLogTrackPaths(curve: CurveData, width: number, height: number): string[] {
  const numericValues = curve.values.filter((v): v is number => v !== null)
  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const minDepth = curve.depths[0]
  const maxDepth = curve.depths[curve.depths.length - 1]

  const segments: string[] = []
  let currentSegment: string[] = []

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

function getFlagBandsForCurve(curve: CurveData, flags: QualityFlag[], height: number): FlagBand[] {
  const minDepth = curve.depths[0]
  const maxDepth = curve.depths[curve.depths.length - 1]

  return flags
    .filter((f) => f.curve === curve.mnemonic && (f.flag_type === 'flatline' || f.flag_type === 'out_of_range'))
    .map((f) => {
      const y1 = scaleDepthToY(f.depth_start, minDepth, maxDepth, height)
      const y2 = scaleDepthToY(f.depth_end, minDepth, maxDepth, height)
      return { y: y1, height: Math.max(y2 - y1, 2) }
    })
}

function App() {
  const [wells, setWells] = useState<Well[]>([])
  const [wellsLoading, setWellsLoading] = useState(true)
  const [wellsError, setWellsError] = useState<string | null>(null)
  const [selectedWell, setSelectedWell] = useState<Well | null>(null)
  const [question, setQuestion] = useState('')
  const [queryResult, setQueryResult] = useState<{ grounded: boolean; answer: string; citation: string | null } | null>(null)
  const [isQuerying, setIsQuerying] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [showSlbCenters, setShowSlbCenters] = useState(true)
  const [wellFlags, setWellFlags] = useState<QualityFlag[]>([])
  const [curveTracks, setCurveTracks] = useState<CurveData[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    setWellsLoading(true)
    setWellsError(null)
    fetch(`${API_BASE}/wells`)
      .then((res) => res.json())
      .then((data) => setWells(data))
      .catch((err) => {
        console.error('Failed to fetch wells:', err)
        setWellsError('Could not load wells — check that the API server is running.')
      })
      .finally(() => setWellsLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedWell) {
      setWellFlags([])
      setCurveTracks([])
      setDetailError(null)
      return
    }
    setDetailLoading(true)
    setDetailError(null)
    setWellFlags([])
    setCurveTracks([])
    fetch(`${API_BASE}/wells/${selectedWell.id}`)
      .then((res) => res.json())
      .then((data) => {
        setWellFlags(data.quality_flags)

        const preferred = ['GR', 'NPHI']
        const available: string[] = data.curves
        const mnemonicsToPlot = preferred.filter((m) => available.includes(m))
        if (mnemonicsToPlot.length === 0) {
          mnemonicsToPlot.push(...available.slice(0, 2))
        }

        return Promise.all(
          mnemonicsToPlot.map((mnemonic) =>
            fetch(`${API_BASE}/wells/${selectedWell.id}/curves/${mnemonic}`).then((res) => res.json())
          )
        ).then((tracks) => setCurveTracks(tracks))
      })
      .catch((err) => {
        console.error('Failed to fetch well detail:', err)
        setDetailError("Could not load this well's data — check that the API server is running.")
      })
      .finally(() => setDetailLoading(false))
  }, [selectedWell])

  async function handleSubmitQuestion() {
    if (!selectedWell || !question.trim()) return
    setIsQuerying(true)
    setQueryResult(null)
    setQueryError(null)
    try {
      const res = await fetch(`${API_BASE}/wells/${selectedWell.id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }
      const data = await res.json()
      setQueryResult(data)
    } catch (err) {
      console.error('Query failed:', err)
      setQueryError('Could not get an answer — check that the API server is running.')
    } finally {
      setIsQuerying(false)
    }
  }

  return (
    <>
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'white',
        padding: '8px 16px',
        borderRadius: '6px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        zIndex: 1000,
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        fontSize: '14px',
      }}>
        {wellsError ? (
          <span style={{ color: '#dc2626' }}>{wellsError}</span>
        ) : wellsLoading ? (
          <span>Loading wells…</span>
        ) : (
          <>
            <span>Wells: {wells.length}</span>
            <span style={{ color: '#22c55e' }}>Clean: {wells.filter((w) => w.quality_status === 'clean').length}</span>
            <span style={{ color: '#f97316' }}>Flagged: {wells.filter((w) => w.quality_status === 'flagged').length}</span>
          </>
        )}
        <label>
          <input
            type="checkbox"
            checked={showSlbCenters}
            onChange={(e) => setShowSlbCenters(e.target.checked)}
          />{' '}
          SLB Centers
        </label>
      </div>

      <MapContainer center={[20, 0]} zoom={2} style={{ height: '100vh', width: '100%' }} ref={mapRef}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {wells
          .filter((well) => well.location !== null)
          .map((well) => (
            <Marker
              key={well.id}
              position={[well.location!.lat, well.location!.lon]}
              icon={getMarkerIcon(well.quality_status)}
              eventHandlers={{ click: () => {
                setSelectedWell(well)
                setQuestion('')
                setQueryResult(null)
                setQueryError(null)
                mapRef.current?.flyTo([well.location!.lat, well.location!.lon], 8, { duration: 1 })
              } }}
            >
              <Popup>{well.name}</Popup>
            </Marker>
          ))}
          {showSlbCenters && SLB_CENTERS.map((center) => (
            <Marker
              key={center.name}
              position={[center.lat, center.lon]}
              icon={slbIcon}
              eventHandlers={{ click: () => {
                mapRef.current?.flyTo([center.lat, center.lon], 8, { duration: 1 })
              } }}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    {center.type === 'research' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                        <path d="M9 2v6.5L4 20a1 1 0 0 0 1 1.5h14a1 1 0 0 0 1-1.5L15 8.5V2" />
                        <path d="M9 2h6" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
                        <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
                      </svg>
                    )}
                    <strong>{center.name}</strong>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: '13px' }}>{center.description}</p>
                  <a href={center.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px' }}>
                    View on slb.com →
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {selectedWell && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '320px',
          height: '100vh',
          background: 'white',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.2)',
          padding: '16px',
          zIndex: 1000,
        }}>
          <button onClick={() => setSelectedWell(null)}>Close</button>
          <h2>{selectedWell.name}</h2>
          <p>Status: {selectedWell.quality_status}</p>

          {detailError && (
            <p style={{ color: '#dc2626', fontSize: '13px' }}>{detailError}</p>
          )}
          {detailLoading && (
            <p style={{ fontSize: '13px', color: '#666' }}>Loading well data…</p>
          )}

          {curveTracks.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              {curveTracks.map((curve) => (
                <div key={curve.mnemonic}>
                  <div style={{ fontSize: '11px', textAlign: 'center' }}>{curve.mnemonic}</div>
                  <svg width={90} height={180} style={{ border: '1px solid #ddd' }}>
                    {getFlagBandsForCurve(curve, wellFlags, 180).map((band, i) => (
                      <rect key={i} x={0} y={band.y} width={90} height={band.height} fill="#f97316" fillOpacity={0.15} />
                    ))}
                    {buildLogTrackPaths(curve, 90, 180).map((d, i) => (
                      <path key={i} d={d} fill="none" stroke="#2563eb" strokeWidth={1} />
                    ))}
                  </svg>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '16px', maxHeight: '200px', overflowY: 'auto', fontSize: '12px' }}>
            {wellFlags.map((flag, i) => (
              <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}>
                {flag.flag_type} — {flag.curve} — {flag.depth_start}–{flag.depth_end}m — {flag.detail}
              </div>
            ))}
          </div>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this well's data..."
            rows={3}
            style={{ width: '100%', marginTop: '16px' }}
          />
          <button onClick={handleSubmitQuestion} disabled={isQuerying || !question.trim()} style={{ marginTop: '8px' }}>
            {isQuerying ? 'Asking...' : 'Ask'}
          </button>

          {queryError && (
            <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>{queryError}</p>
          )}

          {queryResult && (
            <div style={{ marginTop: '16px' }}>
              <p>{queryResult.answer}</p>
              {queryResult.citation && (
                <p style={{ fontSize: '12px', color: '#888' }}>Source: {queryResult.citation}</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default App