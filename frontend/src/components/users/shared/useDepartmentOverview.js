import { useEffect, useRef, useState } from 'react'

export default function useDepartmentOverview(load, initialData) {
  const [data, setData] = useState(initialData)
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refreshVersion = useRef(0)

  const applyOverview = ({ data, notices }) => {
    setData(data)
    setNotifications(notices)
    setError('')
  }

  useEffect(() => {
    let active = true
    let pending = false
    const refresh = async () => {
      if (pending) return
      pending = true
      const version = refreshVersion.current
      try {
        const overview = await load()
        if (active && version === refreshVersion.current) applyOverview(overview)
      } catch {
        if (active && version === refreshVersion.current) setError('Unable to refresh department data. Please retry.')
      } finally {
        pending = false
        if (active) setLoading(false)
      }
    }
    refresh()
    const interval = window.setInterval(refresh, 15000)
    return () => { active = false; window.clearInterval(interval) }
  }, [load])

  const refreshAfterSave = async () => {
    const version = ++refreshVersion.current
    try {
      const overview = await load()
      if (version === refreshVersion.current) applyOverview(overview)
    } catch {
      if (version === refreshVersion.current) setError('Saved successfully, but the overview could not refresh.')
    }
  }

  return { data, notifications, setNotifications, error, loading, refreshAfterSave }
}
