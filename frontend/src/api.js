import axios from 'axios'
import { clearSession, getAccessToken, getRefreshToken, SESSION_EXPIRED_EVENT, storeAccessToken } from './services/authUser'

const baseURL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api/' : 'http://127.0.0.1:8000/api/')
const api = axios.create({ baseURL })
const refreshClient = axios.create({ baseURL })
let activeRefresh
const inFlightReads = new Map()

function expireSession() {
  clearSession()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

function refreshAccess(refreshToken) {
  if (activeRefresh?.token === refreshToken) return activeRefresh.promise

  const refresh = { token: refreshToken }
  refresh.promise = refreshClient.post('auth/refresh/', { refresh: refreshToken }).then(({ data }) => {
    if (getRefreshToken() === refreshToken) storeAccessToken(data.access)
    return data.access
  }).finally(() => {
    if (activeRefresh === refresh) activeRefresh = undefined
  })
  activeRefresh = refresh
  return refresh.promise
}

api.interceptors.request.use((config) => {
  config.sessionAccess = getAccessToken()
  config.sessionRefresh = getRefreshToken()
  if (config.sessionAccess) config.headers.Authorization = `Bearer ${config.sessionAccess}`
  return config
})

api.interceptors.response.use(
  (response) => {
    if (!['get', 'head', 'options'].includes(response.config.method)) inFlightReads.clear()
    return response
  },
  async (error) => {
    const request = error.config
    if (error.response?.status !== 401 || !request || request.url?.includes('auth/login/')) throw error

    const refreshToken = getRefreshToken()
    const accessToken = getAccessToken()
    if (request.sessionRefresh !== refreshToken || (!refreshToken && request.sessionAccess !== accessToken)) throw error

    if (!refreshToken || request._retry || request.url?.includes('auth/refresh/')) {
      expireSession()
      throw error
    }

    request._retry = true
    if (accessToken && accessToken !== request.sessionAccess) return api(request)

    try {
      await refreshAccess(refreshToken)
    } catch (refreshError) {
      if (getRefreshToken() === refreshToken) expireSession()
      throw refreshError
    }
    if (getRefreshToken() !== refreshToken) throw error
    return api(request)
  },
)

// Share simultaneous reads for the same account and URL. Completed results are not cached.
export function getShared(path, config) {
  const key = JSON.stringify([getRefreshToken() || getAccessToken(), api.getUri({ url: path, ...config })])
  if (inFlightReads.has(key)) return inFlightReads.get(key)
  const request = api.get(path, config).finally(() => {
    if (inFlightReads.get(key) === request) inFlightReads.delete(key)
  })
  inFlightReads.set(key, request)
  return request
}

export default api
