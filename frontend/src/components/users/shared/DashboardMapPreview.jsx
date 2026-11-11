import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { getBoundsFromGeoJson, getPolygonCenter, LUCENA_CENTER } from './healthMapGeometry'
import HealthHotspotLayer from './HealthHotspotLayer'
import 'leaflet/dist/leaflet.css'

function FitDashboardMap({ geoJson }) {
  const map = useMap()

  useEffect(() => {
    const bounds = getBoundsFromGeoJson(geoJson)
    if (bounds) {
      map.fitBounds(bounds, { padding: [10, 10] })
    }
  }, [geoJson, map])

  return null
}

export default function DashboardMapPreview({ features = [], onOpen }) {
  const geoJson = useMemo(() => ({ type: 'FeatureCollection', features }), [features])
  const points = useMemo(() => features
    .map((feature) => ({ feature, center: getPolygonCenter(feature), cases: Number(feature.properties?.cases || 0) }))
    .filter((item) => item.center && item.cases > 0)
    .map(({ feature, center, cases }) => ({
      center, cases, barangay: feature.properties?.barangay, purokName: feature.properties?.purok_name,
    })), [features])

  return (
    <div className="dashboard-leaflet-preview">
      <MapContainer
        center={LUCENA_CENTER}
        zoom={12}
        minZoom={11}
        maxZoom={15}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        className="dashboard-leaflet-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HealthHotspotLayer
          points={points}
          diseaseName="All diseases"
          radius={18}
          opacity={0.75}
        />
        <FitDashboardMap geoJson={geoJson} />
      </MapContainer>
      <button className="dashboard-map-open" type="button" onClick={onOpen} aria-label="Open full HealthMap" />
    </div>
  )
}

