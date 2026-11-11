import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { HeatLayer } from 'leaflet.heat'
import { useMap } from 'react-leaflet'

function getHotspotSummary(contributors, diseaseName) {
  const content = document.createElement('div')
  const title = document.createElement('strong')
  title.textContent = 'Hotspot Area'
  content.append(title)
  const totalCases = contributors.reduce((sum, point) => sum + point.cases, 0)
  const lines = [
    `Disease: ${diseaseName}`,
    `Contributing puroks: ${contributors.length}`,
    `Total cases nearby: ${totalCases}`,
    '',
    ...contributors.slice(0, 5).map((point) => `${point.barangay} - ${point.purokName}: ${point.cases}`),
  ]
  for (const line of lines) content.append(document.createElement('br'), document.createTextNode(line))
  return content
}

export default function HealthHotspotLayer({ points, diseaseName, radius: heatRadius, opacity }) {
  const map = useMap()
  const tooltipRef = useRef(null)

  useEffect(() => {
    const validPoints = points.filter((point) => Number.isFinite(point.cases) && point.cases > 0)
    const maxCases = Math.max(1, ...validPoints.map((point) => point.cases))
    const pane = map.getPane('diseaseHeat') || map.createPane('diseaseHeat')
    pane.style.zIndex = '450'
    pane.style.pointerEvents = 'none'
    pane.style.opacity = String(opacity)

    // Folium's HeatMap uses Leaflet.heat: blurred, weighted points with
    // zoom-aware aggregation rather than independently colored circles.
    const layer = new HeatLayer(
      validPoints.map((point) => [point.center[0], point.center[1], point.cases / maxCases]),
      {
        pane: 'diseaseHeat',
        radius: heatRadius,
        blur: 18,
        minOpacity: 0.15,
        max: 1,
        maxZoom: 15,
        gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1: 'red' },
      },
    ).addTo(map)
    // Override responsive canvas rules that otherwise shrink Leaflet's canvas.
    Object.assign(layer._canvas.style, { maxWidth: 'none', maxHeight: 'none' })
    return () => { map.removeLayer(layer) }
  }, [map, points, heatRadius, opacity])

  useEffect(() => {
    const findContributors = (latlng) => {
      const cursorPoint = map.latLngToContainerPoint(latlng)
      const radius = heatRadius

      return points
        .filter((point) => {
          const mapPoint = map.latLngToContainerPoint(point.center)
          return mapPoint.distanceTo(cursorPoint) <= radius && point.cases > 0
        })
        .sort((first, second) => second.cases - first.cases)
    }

    const showTooltip = (event) => {
      const contributors = findContributors(event.latlng)
      if (!contributors.length) {
        if (tooltipRef.current) {
          map.removeLayer(tooltipRef.current)
          tooltipRef.current = null
        }
        return
      }

      const totalCases = contributors.reduce((sum, point) => sum + point.cases, 0)
      const content = `<strong>${contributors.length} puroks nearby</strong><br />${totalCases} total cases`

      if (!tooltipRef.current) {
        tooltipRef.current = L.tooltip({
          direction: 'top',
          opacity: 0.95,
          sticky: true,
          className: 'cho-hotspot-tooltip',
        })
      }

      tooltipRef.current.setLatLng(event.latlng).setContent(content)
      if (!map.hasLayer(tooltipRef.current)) {
        tooltipRef.current.addTo(map)
      }
    }

    const showPopup = (event) => {
      const contributors = findContributors(event.latlng)
      if (!contributors.length) return

      L.popup({
        className: 'cho-hotspot-popup',
        maxWidth: 300,
      })
        .setLatLng(event.latlng)
        .setContent(getHotspotSummary(contributors, diseaseName))
        .openOn(map)
    }

    map.on('mousemove', showTooltip)
    map.on('click', showPopup)

    return () => {
      map.off('mousemove', showTooltip)
      map.off('click', showPopup)
      if (tooltipRef.current) {
        map.removeLayer(tooltipRef.current)
        tooltipRef.current = null
      }
    }
  }, [diseaseName, map, points, heatRadius])

  return null
}

