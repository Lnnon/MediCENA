import { getShared } from '../api'

export const fetchDiseases = async () => {
  const response = await getShared('diseases/')
  return response.data
}

export const fetchPurokDiseaseMap = async ({ diseaseId = '', barangay = '', purokFid = '' } = {}) => {
  const params = {
    ...(diseaseId ? { disease_id: diseaseId } : {}),
    ...(barangay ? { barangay } : {}),
    ...(purokFid ? { purok_fid: purokFid } : {}),
  }
  const response = await getShared('gis/purok-disease-map/', { params })
  return response.data
}

export const fetchPuroks = async (barangay) => {
  const response = await getShared('gis/puroks/', { params: { barangay } })
  return response.data
}

export const fetchOutbreakAnalytics = async (params = {}) => {
  const response = await getShared('analytics/outbreaks/', { params })
  return response.data
}

export const fetchForecastAnalysis = (filters = {}) => fetchOutbreakAnalytics({ ...filters, mode: 'forecast' })
