import { useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import type { WellSummary } from '../api'
import { SLB_CENTERS } from '../data/slbCenters'
import { MapLegend } from './MapLegend'
import './ExploreMap.css'

// Leaflet's default marker icon URLs assume a plain <script> setup, not a
// bundler - without this, markers render as broken images under Vite.
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

function getWellIcon(qualityStatus: string) {
  const color = qualityStatus === 'clean' ? '#2b8251' : '#a16624'
  return L.divIcon({
    className: '',
    html: `<div style="background-color:${color}; width:20px; height:20px; border-radius:50%; border:2px solid white; box-shadow:0 0 3px rgba(0,0,0,0.6);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function getSlbIcon(type: 'research' | 'learning') {
  if (type === 'research') {
    return L.divIcon({
      className: '',
      html: `<div style="background-color:#6e4c9e; width:18px; height:18px; transform:rotate(45deg); border:2px solid white; box-shadow:0 0 3px rgba(0,0,0,0.6);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })
  }
  // Learning centers: a solid triangle, built as two stacked clip-path
  // shapes (white outline behind, purple fill on top) rather than the
  // border-triangle CSS trick, which doesn't support a clean outline.
  return L.divIcon({
    className: '',
    html: `<div style="position:relative; width:20px; height:18px;">
      <div style="position:absolute; inset:0; background:white; clip-path:polygon(50% 0%, 0% 100%, 100% 100%); filter:drop-shadow(0 0 2px rgba(0,0,0,0.5));"></div>
      <div style="position:absolute; top:3px; left:3px; right:3px; bottom:3px; background:#6e4c9e; clip-path:polygon(50% 0%, 0% 100%, 100% 100%);"></div>
    </div>`,
    iconSize: [20, 18],
    iconAnchor: [10, 15],
  })
}

interface ExploreMapProps {
  wells: WellSummary[]
  onOpenWell: (wellId: number) => void
  height?: string
  showLegend?: boolean
  initialShowCenters?: boolean
}

export function ExploreMap({ wells, onOpenWell, height = '100%', showLegend = true, initialShowCenters = true }: ExploreMapProps) {
  const [showWells, setShowWells] = useState(true)
  const [showCenters, setShowCenters] = useState(initialShowCenters)
  const mapRef = useRef<L.Map | null>(null)

  return (
    <div className="gl-explore-map" style={{ height }}>
      {showLegend && (
        <MapLegend
          showWells={showWells}
          showCenters={showCenters}
          onToggleWells={setShowWells}
          onToggleCenters={setShowCenters}
        />
      )}

      <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }} ref={mapRef}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {showWells &&
          wells
            .filter((well) => well.location !== null)
            .map((well) => (
              <Marker
                key={well.id}
                position={[well.location!.lat, well.location!.lon]}
                icon={getWellIcon(well.quality_status)}
                eventHandlers={{
                  click: () => {
                    mapRef.current?.flyTo([well.location!.lat, well.location!.lon], 8, { duration: 1 })
                  },
                }}
              >
                <Popup>
                  <div className="gl-map-popup">
                    <strong>{well.name}</strong>
                    <p>
                      {well.quality_status === 'clean' ? 'Clean' : 'Flagged'} · {well.curve_count} curves ·{' '}
                      {well.flag_count} issues
                    </p>
                    <button className="gl-btn gl-btn-primary gl-map-popup-btn" onClick={() => onOpenWell(well.id)}>
                      Open workspace
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

        {showCenters &&
          SLB_CENTERS.map((center) => (
            <Marker
              key={center.name}
              position={[center.lat, center.lon]}
              icon={getSlbIcon(center.type)}
              eventHandlers={{
                click: () => {
                  mapRef.current?.flyTo([center.lat, center.lon], 8, { duration: 1 })
                },
              }}
            >
              <Popup>
                <div className="gl-map-popup">
                  <div className="gl-map-popup-title">
                    {center.type === 'research' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6e4c9e" strokeWidth="2">
                        <path d="M9 2v6.5L4 20a1 1 0 0 0 1 1.5h14a1 1 0 0 0 1-1.5L15 8.5V2" />
                        <path d="M9 2h6" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6e4c9e" strokeWidth="2">
                        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
                        <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
                      </svg>
                    )}
                    <strong>{center.name}</strong>
                  </div>
                  <p>{center.description}</p>
                  <a href={center.link} target="_blank" rel="noopener noreferrer">
                    View on slb.com
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  )
}
