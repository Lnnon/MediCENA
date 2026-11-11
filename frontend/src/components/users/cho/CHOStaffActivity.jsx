import { useEffect, useState } from 'react'
import { fetchStaffActivities } from '../../../services/users'

function CHOStaffActivity() {
  const [activities, setActivities] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try { const result = await fetchStaffActivities(); if (active) { setActivities(result); setError('') } }
      catch { if (active) setError('Unable to load the personnel activity log.') }
    }
    refresh()
    const timer = window.setInterval(refresh, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  const rows = activities.filter((item) => [item.actor_detail?.username, item.actor_detail?.role, item.action, item.resource].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase())))
  return <>
    <div className="cho-page-heading"><div><span>CHO Administration</span><h1>Personnel activity</h1><p>Review the latest 500 record changes across OPD, pharmacy, BHC, and clinical workflows.</p></div></div>
    {error && <p className="patient-alert" role="alert">{error}</p>}
    <article className="cho-panel"><div className="department-toolbar"><h2>Activity log</h2><input aria-label="Search personnel activity" placeholder="Username, role, or activity" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="department-table-wrap"><table className="department-table"><thead><tr><th>Time</th><th>Personnel</th><th>Role</th><th>Action</th><th>Record</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.actor_detail?.username || 'Deleted account'}</td><td>{item.actor_detail?.role || '—'}</td><td>{item.action}</td><td>{item.resource} #{item.object_id}</td></tr>)}</tbody></table></div>{!rows.length && <p>No recorded activity yet. New record changes will appear here.</p>}
    </article>
  </>
}
export default CHOStaffActivity
