function firstMessage(value) {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  return Object.values(value).map(firstMessage).find(Boolean) || ''
}

export function getApiErrorMessage(error, fallback, unavailable = fallback) {
  const response = error?.response
  if (!response || response.status >= 500) return unavailable
  const data = response.data
  if (typeof data === 'string' && /^\s*</.test(data)) return fallback
  return firstMessage(data?.detail) || firstMessage(data) || fallback
}
