export const SESSION_EXPIRED_EVENT = 'mediflow:logout'

export const getAccessToken = () => localStorage.getItem('access')
export const getRefreshToken = () => localStorage.getItem('refresh')
export const storeAccessToken = (token) => localStorage.setItem('access', token)

export const storeSession = ({ access, refresh, user }) => {
  storeAccessToken(access)
  localStorage.setItem('refresh', refresh)
  localStorage.setItem('user', JSON.stringify(user))
}

export const clearSession = () => {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
  localStorage.removeItem('user')
}

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

export const getUserDisplayName = (user = getStoredUser()) => {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
  return fullName || user?.username || 'BHC Staff'
}
