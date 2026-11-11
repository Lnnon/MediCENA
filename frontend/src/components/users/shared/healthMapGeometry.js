export const LUCENA_CENTER = [13.941, 121.623]

export const getBoundsFromGeoJson = (geoJson) => {
  if (!geoJson?.features?.length) return null
  const bounds = []

  geoJson.features.forEach((feature) => {
    const coordinates = feature.geometry?.coordinates || []
    const polygons = feature.geometry?.type === 'MultiPolygon' ? coordinates.flat(1) : coordinates
    polygons.flat(1).forEach((coordinate) => {
      if (Array.isArray(coordinate) && coordinate.length >= 2) {
        bounds.push([coordinate[1], coordinate[0]])
      }
    })
  })

  return bounds.length ? bounds : null
}

export const getPolygonCenter = (feature) => {
  const coordinates = feature.geometry?.coordinates || []
  const polygons = feature.geometry?.type === 'MultiPolygon' ? coordinates.flat(1) : coordinates
  const points = []

  polygons.flat(1).forEach((coordinate) => {
    if (Array.isArray(coordinate) && coordinate.length >= 2) {
      points.push({ lng: Number(coordinate[0]), lat: Number(coordinate[1]) })
    }
  })

  if (!points.length) return null
  const total = points.reduce((sum, point) => ({ lat: sum.lat + point.lat, lng: sum.lng + point.lng }), { lat: 0, lng: 0 })
  return [total.lat / points.length, total.lng / points.length]
}

export const getFeatureCenter = (feature) => {
  const center = feature.properties?.center
  if (center?.lat != null && center?.lng != null && Number.isFinite(Number(center.lat)) && Number.isFinite(Number(center.lng))) {
    return [Number(center.lat), Number(center.lng)]
  }
  return getPolygonCenter(feature)
}
