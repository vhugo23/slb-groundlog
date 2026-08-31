import { useEffect, useState } from 'react'
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

function getMarkerIcon(qualityStatus: string) {
  const color = qualityStatus === 'clean' ? '#22c55e' : '#f97316'
  return L.divIcon({
    className: '',
    html: `<div style="background-color:${color}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 3px rgba(0,0,0,0.6);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function App() {
  const [wells, setWells] = useState<Well[]>([])
  const [selectedWell, setSelectedWell] = useState<Well | null>(null)
  const [question, setQuestion] = useState('')
  const [queryResult, setQueryResult] = useState<{ grounded: boolean; answer: string; citation: string | null } | null>(null)
  const [isQuerying, setIsQuerying] = useState(false)

  useEffect(() => {
    fetch('http://127.0.0.1:8000/wells')
      .then((res) => res.json())
      .then((data) => setWells(data))
      .catch((err) => console.error('Failed to fetch wells:', err))
  }, [])

  async function handleSubmitQuestion() {
    if (!selectedWell || !question.trim()) return
    setIsQuerying(true)
    setQueryResult(null)
    try {
      const res = await fetch(`http://127.0.0.1:8000/wells/${selectedWell.id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      setQueryResult(data)
    } catch (err) {
      console.error('Query failed:', err)
    } finally {
      setIsQuerying(false)
    }
  }

  return (
    <>
      <MapContainer center={[20, 0]} zoom={2} style={{ height: '100vh', width: '100%' }}>
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
              eventHandlers={{ click: () => { setSelectedWell(well); setQuestion(''); setQueryResult(null) } }}
            >
              <Popup>{well.name}</Popup>
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