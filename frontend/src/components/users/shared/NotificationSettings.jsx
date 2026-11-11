import { useEffect, useState } from 'react'
import { fetchDeliveryLogs, fetchNotificationPreferences, saveNotificationPreferences, sendAnnouncement } from '../../../services/notifications'
import { getStoredUser } from '../../../services/authUser'
import './PanelEnhancements.css'

function NotificationSettings() {
  const [preference, setPreference] = useState(null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const cho = getStoredUser()?.role === 'cho'
  useEffect(() => {
    let active = true
    Promise.all([fetchNotificationPreferences(), fetchDeliveryLogs()]).then(([prefs, deliveries]) => { if (active) { setPreference(prefs); setLogs(deliveries) } }).catch(() => { if (active) setError('Unable to load notification preferences or delivery history.') })
    return () => { active = false }
  }, [])
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setNotice('')
    try { setPreference(await saveNotificationPreferences({ sms_enabled: preference.sms_enabled, phone_number: preference.phone_number, categories: preference.categories })); setError(''); setNotice('Notification preferences saved.') }
    catch (failure) { setError(failure.response?.data?.phone_number?.[0] || failure.response?.data?.detail || 'Unable to save preferences. Check your phone number.') }
    finally { setSaving(false) }
  }
  const announce = async (event) => {
    event.preventDefault(); setSaving(true); setNotice('')
    const form = new FormData(event.currentTarget)
    try { const result = await sendAnnouncement({ title: form.get('title'), message: form.get('message'), roles: form.getAll('roles') }); setNotice(`${result.recipient_count} recipient(s). ${result.detail}`); setError(''); setLogs(await fetchDeliveryLogs()) }
    catch { setError('Unable to save the announcement. Provide a title, message, and recipient role.') }
    finally { setSaving(false) }
  }
  return <section className="notification-settings" aria-label="Notification settings and SMS history">
    <h2>Notification Preferences</h2><p>In-app notifications remain available. SMS is optional and uses a generic account-update message without health details.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {preference ? <form className="panel-filter-form" onSubmit={save}>
      <label>Mobile number<input type="tel" autoComplete="tel" placeholder="+639XXXXXXXXX" value={preference.phone_number} onChange={(event) => setPreference((current) => ({ ...current, phone_number: event.target.value }))} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={preference.sms_enabled} onChange={(event) => setPreference((current) => ({ ...current, sms_enabled: event.target.checked }))} />I consent to SMS account-update alerts at this mobile number.</label>
      <div className="full"><strong>SMS categories</strong><div className="panel-filter-form">{['referral', 'medicine', 'patient', 'system'].map((category) => <label className="checkbox-label" key={category}><input type="checkbox" checked={preference.categories.includes(category)} onChange={(event) => setPreference((current) => ({ ...current, categories: event.target.checked ? [...current.categories, category] : current.categories.filter((item) => item !== category) }))} />{category}</label>)}</div></div>
      <p className="full">{preference.sms_configured ? 'SMS gateway configured. Delivery depends on provider and recipient availability.' : 'SMS gateway is not configured. Messages will not be claimed as sent; use in-app notifications.'}</p><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Preferences'}</button>
    </form> : <p>Loading preferences…</p>}
    {cho && <><h2>System Announcement</h2><form className="panel-filter-form" onSubmit={announce}><label className="full">Title<input name="title" maxLength="160" required /></label><label className="full">Announcement<textarea name="message" maxLength="2000" rows="3" required placeholder="Maintenance, system changes, or relevant announcements" /></label><div className="full panel-filter-form">{['cho', 'opd', 'pharmacist', 'bhc', 'doctor', 'patient'].map((role) => <label key={role} className="checkbox-label"><input type="checkbox" name="roles" value={role} defaultChecked />{role}</label>)}</div><button type="submit" disabled={saving}>Publish Announcement</button></form></>}
    <h2>{cho ? 'SMS Delivery Log' : 'Your SMS Delivery History'}</h2><p>Accepted, queued, and sent do not mean delivered. Delivered is shown only after provider confirmation.</p>
    <button type="button" onClick={async () => { try { setLogs(await fetchDeliveryLogs()); setError('') } catch { setError('Unable to refresh SMS delivery history.') } }}>Refresh Delivery History</button>
    <div className="cho-medicine-request-table-wrap"><table className="cho-medicine-request-table"><thead><tr>{cho && <th>Recipient</th>}<th>Status</th><th>Attempts</th><th>Error / Reason</th><th>Updated</th></tr></thead><tbody>{logs.map((item) => <tr key={item.id}>{cho && <td>{item.recipient}</td>}<td>{item.status.replaceAll('_', ' ')}</td><td>{item.attempts}</td><td>{item.error_code || '—'}</td><td>{new Date(item.updated_at).toLocaleString()}</td></tr>)}</tbody></table></div>{!logs.length && <p>No SMS delivery attempts recorded yet.</p>}
  </section>
}
export default NotificationSettings
