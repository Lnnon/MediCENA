import { useEffect, useMemo, useRef, useState } from 'react'
import HealthHotspotLayer from '../shared/HealthHotspotLayer'
import { getBoundsFromGeoJson, getFeatureCenter, LUCENA_CENTER } from '../shared/healthMapGeometry'
import { CircleMarker, LayersControl, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, Info, SlidersHorizontal, Loader2, MapPin } from 'lucide-react'
import { fetchDiseases, fetchPurokDiseaseMap } from '../../../services/gis'

const HOTSPOT_RADIUS = 28

function getConcentrationLevel(cases, maximum) {
  if (!cases) return 'No cases'
  const ratio = cases / maximum
  if (ratio <= 0.2) return 'Low'
  if (ratio <= 0.4) return 'Moderate'
  if (ratio <= 0.6) return 'Elevated'
  if (ratio <= 0.8) return 'High'
  return 'Highest'
}

function FitGeoJsonBounds({ geoJson, focusCases }) {
  const map = useMap()
  const hasFitted = useRef(false)

  useEffect(() => {
    if (hasFitted.current) return
    const caseCenters = (geoJson?.features || []).filter((feature) => Number(feature.properties?.cases) > 0).map(getFeatureCenter).filter(Boolean)
    const bounds = focusCases && caseCenters.length ? caseCenters : getBoundsFromGeoJson(geoJson)
    if (bounds) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 })
      hasFitted.current = true
    }
  }, [geoJson, map, focusCases])

  return null
}

function LockLucenaBounds({ bounds }) {
  const map = useMap()

  useEffect(() => {
    if (!bounds) return
    map.setMaxBounds(bounds)
  }, [bounds, map])

  return null
}

function FocusSelectedBarangay({ barangay, boundaries, resetVersion }) {
  const map = useMap()
  const lastFocused = useRef('')
  const lastReset = useRef(resetVersion)

  useEffect(() => {
    if (lastReset.current === resetVersion) return
    const bounds = getBoundsFromGeoJson(boundaries)
    if (!bounds) return
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 })
    lastReset.current = resetVersion
    lastFocused.current = barangay
  }, [resetVersion, boundaries, barangay, map])

  useEffect(() => {
    if (!barangay) {
      lastFocused.current = ''
      return
    }
    if (lastFocused.current === barangay) return
    const features = (boundaries?.features || []).filter((feature) => feature.properties?.barangay === barangay)
    const bounds = getBoundsFromGeoJson({ features })
    if (!bounds) return
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 })
    lastFocused.current = barangay
  }, [barangay, boundaries, map])

  return null
}

function MapFilterPanel({ children }) {
  return <aside className="cho-filter-panel cho-health-map-panel"><h2><SlidersHorizontal size={16} />Disease Monitoring Filters</h2>{children}</aside>
}

function CHOHealthMap({ barangayScoped = false, initialBarangay = '', initialDiseaseId = '' }) {
  const [diseases, setDiseases] = useState([])
  const [selectedDiseaseId, setSelectedDiseaseId] = useState(initialDiseaseId)
  const [resetVersion, setResetVersion] = useState(0)
  const [selectedBarangay, setSelectedBarangay] = useState(initialBarangay)
  const [selectedPurokFid, setSelectedPurokFid] = useState('')
  const [baseGeoJson, setBaseGeoJson] = useState(null)
  const [diseaseGeoJson, setGeoJson] = useState(null)
  const [selectedLevel, setSelectedLevel] = useState('')

  const levelMaximum = useMemo(() => (diseaseGeoJson?.features || []).reduce(
    (maximum, feature) => Math.max(maximum, Number(feature.properties?.cases || 0)), 1,
  ), [diseaseGeoJson])

  const geoJson = useMemo(() => diseaseGeoJson && ({
    ...diseaseGeoJson,
    features: diseaseGeoJson.features.filter(({ properties }) =>
      (!selectedBarangay || properties?.barangay === selectedBarangay) &&
      (!selectedPurokFid || String(properties?.fid) === selectedPurokFid) &&
      (!selectedLevel || getConcentrationLevel(Number(properties?.cases || 0), levelMaximum) === selectedLevel)),
  }), [diseaseGeoJson, selectedBarangay, selectedPurokFid, selectedLevel, levelMaximum])

  const barangayCases = useMemo(() => {
    const totals = Object.create(null)
    for (const { properties } of diseaseGeoJson?.features || []) {
      const name = properties?.barangay
      totals[name] = (totals[name] || 0) + Number(properties?.cases || 0)
    }
    return totals
  }, [diseaseGeoJson])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')


  const selectedDiseaseName = useMemo(() => {
    if (!selectedDiseaseId) return 'All diseases'
    return diseases.find((disease) => String(disease.id) === String(selectedDiseaseId))?.disease_name || 'Selected disease'
  }, [diseases, selectedDiseaseId])

  const lucenaBounds = useMemo(() => getBoundsFromGeoJson(baseGeoJson), [baseGeoJson])

  const barangays = useMemo(() => {
    const names = new Set()
    baseGeoJson?.features?.forEach((feature) => {
      if (feature.properties?.barangay) names.add(feature.properties.barangay)
    })
    return [...names].sort((first, second) => first.localeCompare(second))
  }, [baseGeoJson])

  const scopedBarangay = useMemo(() => {
    return geoJson?.scope?.barangay || baseGeoJson?.scope?.barangay || ''
  }, [baseGeoJson, geoJson])

  const puroks = useMemo(() => {
    return (diseaseGeoJson?.features || [])
      .filter((feature) => !selectedBarangay || feature.properties?.barangay === selectedBarangay)
      .map((feature) => ({
        fid: feature.properties?.fid,
        barangay: feature.properties?.barangay,
        purokName: feature.properties?.purok_name,
        cases: Number(feature.properties?.cases || 0),
      }))
      .sort((first, second) => `${first.barangay} ${first.purokName}`.localeCompare(`${second.barangay} ${second.purokName}`))
  }, [diseaseGeoJson, selectedBarangay])

  const hotspotPoints = useMemo(() => {
    return (geoJson?.features || [])
      .map((feature) => {
        const center = getFeatureCenter(feature)
        const properties = feature.properties || {}

        if (!center) return null

        return {
          center,
          barangay: properties.barangay || 'Barangay not set',
          purokName: properties.purok_name || 'Purok not set',
          cases: Number(properties.cases || 0),
        }
      })
      .filter(Boolean)
  }, [geoJson])

  useEffect(() => {
    let isMounted = true

    const loadInitialData = async () => {
      try {
        const [backendDiseases, fullMap] = await Promise.all([
          fetchDiseases(),
          fetchPurokDiseaseMap(),
        ])
        if (isMounted) {
          setDiseases(backendDiseases)
          setBaseGeoJson(fullMap)
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Unable to load disease list or Lucena map boundaries from the backend.')
        }
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadMapData = async () => {
      try {
        setIsLoading(true)
        const backendGeoJson = await fetchPurokDiseaseMap({
          diseaseId: selectedDiseaseId,
        })
        if (isMounted) {
          setGeoJson(backendGeoJson)
          setErrorMessage('')
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Unable to load GIS disease map data from the backend.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadMapData()

    return () => {
      isMounted = false
    }
  }, [selectedDiseaseId])


  return (
    <>
      <div className="cho-page-heading">
        <div>
          <span>Monitoring</span>
          <h1>{scopedBarangay || barangayScoped ? 'Barangay Health Map' : 'Health Map'}</h1>
          <p>
            {scopedBarangay
              ? `GIS disease monitoring by purok in ${scopedBarangay}.`
              : 'GIS disease monitoring by purok across Lucena City.'}
          </p>
        </div>
      </div>

      <section className="cho-health-map-page">
        <MapFilterPanel>
          <label>
            <span>Disease</span>
            <select value={selectedDiseaseId} onChange={(event) => setSelectedDiseaseId(event.target.value)}>
              <option value="">All Diseases</option>
              {diseases.map((disease) => (
                <option value={disease.id} key={disease.id}>
                  {disease.disease_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Case Concentration Level</span>
            <select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)}>
              <option value="">All Levels</option>
              {['No cases', 'Low', 'Moderate', 'Elevated', 'High', 'Highest'].map((level) => <option key={level}>{level}</option>)}
            </select>


          </label>
          {!barangayScoped && (
            <label>
              <span>Barangay</span>
              <select value={selectedBarangay} onChange={(event) => { setSelectedBarangay(event.target.value); setSelectedPurokFid('') }}>
                <option value="">All Barangays</option>
                {barangays.map((barangay) => <option value={barangay} key={barangay}>{barangay} — {(barangayCases[barangay] || 0).toLocaleString()} cases</option>)}
              </select>
            </label>
          )}
          <label>
            <span>Purok</span>
            <select value={selectedPurokFid} onChange={(event) => setSelectedPurokFid(event.target.value)}>
              <option value="">All Puroks</option>
              {puroks.map((purok) => <option value={purok.fid} key={purok.fid}>{purok.purokName} — {purok.cases.toLocaleString()} cases</option>)}
            </select>
          </label>
          <div className="health-filter-reset-wrap">
          <button className="health-filter-reset" type="button" onClick={() => {
            setResetVersion((version) => version + 1)
            setSelectedDiseaseId('')
            setSelectedLevel('')
            setSelectedBarangay(scopedBarangay || '')
            setSelectedPurokFid('')
          }}>Reset Filters</button>
          </div>
          <section className="health-filter-level-guide" aria-label="Case concentration color explanation">
            <h3>Case Concentration Legend</h3>
            {[
              ['#0000ff', 'Low', 'Lower relative concentration'],
              ['#00bcd4', 'Moderate', 'Moderate relative concentration'],
              ['#32cd32', 'Elevated', 'Elevated relative concentration'],
              ['#e6ba00', 'High', 'High relative concentration'],
              ['#ef2222', 'Highest', 'Highest relative concentration'],
            ].map(([color, level, explanation]) => (
              <div className="health-filter-level-row" key={level}>
                <i style={{ backgroundColor: color }} aria-hidden="true" />
                <div><strong>{level}</strong><p>{explanation}</p></div>
              </div>
            ))}
            <details className="health-filter-about-details"><summary className="health-filter-about"><Info size={15} />About the heatmap</summary><p className="health-filter-level-note">Heatmap colors blend with nearby cases and change with zoom. The level filter compares purok totals with the largest total for the selected disease. These indicate relative concentration, not clinical risk.</p></details>
          </section>

        </MapFilterPanel>

        <article className="cho-health-map-card">
          <header>
            <div>
              <span>{selectedDiseaseName}</span>
              <h2>{scopedBarangay ? `${scopedBarangay} Purok Disease Monitoring` : 'Lucena City Purok Level Disease Monitoring'}</h2>
            </div>
            {isLoading ? <Loader2 className="cho-map-spin" size={18} /> : <MapPin size={18} />}
          </header>

          {errorMessage && (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              {errorMessage}
            </div>
          )}

          <p style={{ margin: '12px 16px', fontSize: 11, color: '#62778a' }}>Recorded cases by purok center. Blue to red indicates increasing relative concentration; black dots mark puroks with cases.</p>

          <div className="cho-leaflet-map">
            <MapContainer
              center={LUCENA_CENTER}
              zoom={12}
              minZoom={12}
              maxBounds={lucenaBounds || undefined}
              maxBoundsViscosity={1}
              scrollWheelZoom
              className="cho-leaflet-container"
            >
              <LayersControl position="topright" collapsed={false}>
                <LayersControl.BaseLayer checked name="Street map">
                  <TileLayer
                className="health-map-base-tile"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                noWrap
                  />
                </LayersControl.BaseLayer>
                {[
                  ['Light gray (Esri)', 'Canvas/World_Light_Gray_Base', 16],
                  ['Dark gray (Esri)', 'Canvas/World_Dark_Gray_Base', 16],
                  ['Street (Esri)', 'World_Street_Map', 19],
                  ['Topographic (Esri)', 'World_Topo_Map', 19],
                ].map(([name, service, nativeZoom]) => (
                  <LayersControl.BaseLayer key={service} name={name}>
                    <TileLayer
                      attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri and the GIS User Community'
                      url={`https://services.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`}
                      maxNativeZoom={nativeZoom}
                      maxZoom={19}
                      noWrap
                    />
                  </LayersControl.BaseLayer>
                ))}
                <LayersControl.BaseLayer name="Satellite (Esri)">
                  <TileLayer
                    attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                    url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxNativeZoom={19}
                    maxZoom={19}
                    noWrap
                  />
                </LayersControl.BaseLayer>
              </LayersControl>
              {lucenaBounds && <LockLucenaBounds bounds={lucenaBounds} />}
              <FocusSelectedBarangay barangay={selectedBarangay} boundaries={baseGeoJson} resetVersion={resetVersion} />
              {hotspotPoints.length > 0 && <HealthHotspotLayer points={hotspotPoints} diseaseName={selectedDiseaseName} radius={HOTSPOT_RADIUS} opacity={0.82} />}
              {hotspotPoints.filter((point) => Number.isFinite(point.cases) && point.cases > 0).map((point, index) => <CircleMarker key={`${point.barangay}-${point.purokName}-${index}`} center={point.center} radius={2.5} pane="markerPane" pathOptions={{ color: '#111', fillColor: '#111', fillOpacity: 1, opacity: 1, weight: 0 }}><Popup><strong>{point.barangay} — {point.purokName}</strong><br />{selectedDiseaseName}<br />Recorded cases: {point.cases}<br />Purok center; not an individual patient location.</Popup></CircleMarker>)}
              {geoJson && (
                <>
                  <FitGeoJsonBounds geoJson={geoJson} focusCases />

                </>
              )}
            </MapContainer>
          </div>
        </article>
      </section>
    </>
  )
}

export default CHOHealthMap
