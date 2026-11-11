import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Edit, Eye, RotateCcw, Save, Search, X, Activity, Weight, Thermometer, HeartPulse, Droplets, Ruler, Wind, Stethoscope } from 'lucide-react'
import { fetchDoctors } from '../../../services/users'
import { updateReferral } from '../../../services/referrals'
import './OPDReferralListLayout.css'

function OPDReferralManagement({ referrals, onSaved }) {
  const [tab, setTab] = useState('all')
  const [pageIndex, setPageIndex] = useState(0)
  const [filters, setFilters] = useState({ search: '', barangay: '', doctor: '', status: '', date: '' })
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [detailTab, setDetailTab] = useState('vitals')
  const [doctors, setDoctors] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    fetchDoctors().then((items) => { if (active) setDoctors(items) }).catch(() => { if (active) setError('Unable to load doctors.') })
    return () => { active = false }
  }, [])
  const save = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    try {
      await updateReferral(editing.id, { status: form.get('status'), specialty: form.get('specialty'), reason: form.get('reason'), call_taken_by: form.get('callTakenBy'), assigned_doctor: form.get('doctor') ? Number(form.get('doctor')) : null })
      setEditing(null); setError(''); await onSaved()
    } catch (requestError) { setError(requestError.response?.data?.detail || 'Unable to save referral. Check the selected doctor and referral information.') }
    finally { setSaving(false) }
  }
  const barangays = [...new Set(referrals.map((item) => item.barangay))].sort()
  const assignedDoctors = [...new Set(referrals.map((item) => item.assignedDoctor))].sort()
  const updateFilter = (field, value) => { setPageIndex(0); setFilters((current) => ({ ...current, [field]: value })) }
  const matchesTab = (item, selected) => selected === 'all' || (selected === 'current' ? !['completed', 'rejected', 'cancelled'].includes(item.status) : selected === 'new' ? ['pending', 'seen'].includes(item.status) && !item.assignedDoctorId : ['completed', 'rejected', 'cancelled'].includes(item.status))
  const items = referrals.filter((item) => matchesTab(item, tab) &&
    [item.patient, item.code, item.barangay, item.status, item.assignedDoctor, item.specialty, item.referredFrom].some((value) => String(value || '').toLowerCase().includes(filters.search.trim().toLowerCase())) &&
    (!filters.barangay || item.barangay === filters.barangay) &&
    (!filters.doctor || item.assignedDoctor === filters.doctor) &&
    (!filters.status || item.status === filters.status) &&
    (!filters.date || item.date?.slice(0, 10) === filters.date),
  )
  const pageCount = Math.max(1, Math.ceil(items.length / 10))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const rows = items.slice(currentPage * 10, currentPage * 10 + 10)
  return <div className={`opd-manage-referrals opd-referral-list-layout filters-open ${viewing ? 'has-details' : ''}`}>
    <div className="cho-page-heading"><div><span>Referral</span><h1>Manage Referrals</h1><p>Review patient referrals, assign doctors, and coordinate referral progress.</p></div></div>
    {error && <p className="patient-alert" role="alert">{error}</p>}
    <div className="opd-list-tabs" aria-label="Referral categories">{[['all', 'All Referrals'], ['current', 'Current Referrals'], ['new', 'New Referrals'], ['past', 'Past Referrals']].map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => { setTab(key); setPageIndex(0) }}>{label}<span>{referrals.filter((item) => matchesTab(item, key)).length}</span></button>)}</div>
    <section className="cho-patient-page cho-medicine-request-page">
      <aside className="cho-filter-panel" aria-label="Filter referrals">
        <label><span>Search</span><div><Search size={15} /><input type="search" placeholder="Search patient or referral..." value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} /></div></label>
        <label><span>Barangay</span><select value={filters.barangay} onChange={(event) => updateFilter('barangay', event.target.value)}><option value="">All Barangays</option>{barangays.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Assigned Doctor</span><select value={filters.doctor} onChange={(event) => updateFilter('doctor', event.target.value)}><option value="">All Doctors</option>{assignedDoctors.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Status</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All Statuses</option>{['pending', 'seen', 'accepted', 'completed', 'rejected', 'cancelled'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Referral Date</span><div><CalendarDays size={15} /><input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} /></div></label>
        <button className="filter-button" type="button" onClick={() => setFilters({ search: '', barangay: '', doctor: '', status: '', date: '' })}><RotateCcw size={15} />Reset Filters</button>
      </aside>
      <article className="cho-patient-list-panel cho-medicine-request-panel">
        <h2>Referral List ({items.length})</h2>
        {items.length ? <div className="cho-medicine-request-table-wrap"><table className="cho-medicine-request-table"><thead><tr><th>Referral / Patient</th><th>BHC / Barangay</th><th>Specialty / Reason</th><th>Assigned Doctor</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className={viewing?.id === item.id ? 'is-selected' : ''} onClick={() => setViewing(item)}>
          <td><button className="opd-list-patient-name" type="button" onClick={() => setViewing(item)}><span className="opd-list-avatar" aria-hidden="true">{String(item.patient).split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{item.patient}</strong><small>{item.code}</small></span></button></td>
          <td><strong>{item.referredFrom}</strong><span>{item.barangay}</span></td>
          <td><strong>{item.specialty}</strong><span>{item.chiefComplaint}</span></td>
          <td>{item.assignedDoctor}</td><td>{item.date ? new Date(item.date).toLocaleDateString('en-PH') : 'Not recorded'}</td>
          <td><span className={`cho-request-status ${item.status === 'completed' ? 'delivered' : item.status === 'accepted' ? 'approved' : 'pending'}`}><CheckCircle2 size={12} />{item.status}</span></td>
          <td onClick={(event) => event.stopPropagation()}><div className="cho-request-actions">
            <button className="request-view-button" type="button" onClick={() => setViewing(item)}><Eye size={13} />View</button>
            <button className="request-view-button department-edit-button" type="button" onClick={() => { setEditing(item); setError('') }}><Edit size={13} />Edit</button>
          </div></td>
        </tr>)}</tbody></table></div> : <div className="patient-alert"><AlertTriangle size={16} />No referrals match your filters.</div>}
        <footer className="opd-list-pagination"><button type="button" disabled={!currentPage} onClick={() => setPageIndex(currentPage - 1)}>← Previous</button><nav aria-label="Referral list pages">{Array.from({ length: pageCount }, (_, index) => index).filter((index) => index === 0 || index === pageCount - 1 || Math.abs(index - currentPage) <= 1).map((index, position, pages) => <span key={index}>{position > 0 && index - pages[position - 1] > 1 && <span aria-hidden="true">…</span>}<button type="button" aria-label={`Page ${index + 1}`} aria-current={currentPage === index ? 'page' : undefined} onClick={() => setPageIndex(index)}>{index + 1}</button></span>)}</nav><button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPageIndex(currentPage + 1)}>Next →</button></footer>
      </article>
    {viewing && <aside className="opd-referral-details-panel" aria-labelledby="opd-view-title">
      <header><h2 id="opd-view-title">Referral Details</h2><button type="button" aria-label="Close referral details" onClick={() => setViewing(null)}><X size={16} /></button></header>
      <div className="opd-detail-identity"><span className="opd-list-avatar" aria-hidden="true">{String(viewing.patient || '').split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><h3>{viewing.patient}</h3><p>{viewing.code || 'Reference not recorded'}</p></div><span className="opd-detail-status">{viewing.status || 'Not recorded'}</span></div>
      <h3 className="opd-detail-heading">Visit Info</h3>
      <dl className="opd-detail-grid">{[['Recorded Time & Date', viewing.date ? new Date(viewing.date).toLocaleString('en-PH') : null, CalendarDays], ['Assigned Doctor', viewing.assignedDoctor, Stethoscope], ['Specialty', viewing.specialty], ['Referral Reason', viewing.chiefComplaint]].map(([label, value, Icon]) => <div key={label}><dt>{Icon && <Icon size={12} />}{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
      <div className="opd-detail-tabs" role="group" aria-label="Referral detail sections">{[['vitals', 'Vitals'], ['records', 'Medical Records'], ['referral', 'Referral Information']].map(([key, label]) => <button key={key} type="button" aria-pressed={detailTab === key} onClick={() => setDetailTab(key)}>{label}</button>)}</div>
      {detailTab === 'vitals' && <div className="opd-detail-content"><p className="opd-detail-note">Vital signs recorded for this referral.</p><dl className="opd-detail-vitals">{[['Blood Pressure', viewing.bp, Activity], ['Weight', viewing.weight, Weight], ['Temperature', viewing.temperature, Thermometer], ['Heart Rate', viewing.cardiacRate, HeartPulse], ['Oxygen Saturation', viewing.o2sat, Droplets], ['Height', viewing.height, Ruler], ['Respiratory Rate', viewing.respirationRate, Wind]].map(([label, value, Icon]) => <div key={label}><span className="opd-detail-vital-icon"><Icon size={16} /></span><div><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div></div>)}</dl></div>}
      {detailTab === 'records' && <div className="opd-detail-content">{viewing.consultationDetails?.length ? viewing.consultationDetails.map((record) => <article className="opd-detail-record" key={record.id}><h3>Consultation</h3><dl className="opd-detail-grid"><div><dt>Diagnosis</dt><dd>{record.diagnosis || 'Not recorded'}</dd></div><div><dt>Treatment Plan</dt><dd>{record.treatment_plan || 'Not recorded'}</dd></div></dl></article>) : <p className="opd-detail-note">No consultation recorded for this referral.</p>}</div>}
      {detailTab === 'referral' && <dl className="opd-detail-grid opd-detail-content">{[['Barangay', viewing.barangay], ['Originating BHC', viewing.referredFrom], ['Destination', viewing.referredTo], ['Referred By', viewing.referredBy], ['Call Taken By', viewing.callTakenBy]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>}
    </aside>}
    </section>
    {editing && <div className="patient-modal-backdrop" role="presentation"><section className="patient-modal cho-medicine-modal" role="dialog" aria-modal="true" aria-labelledby="opd-referral-title">
      <header><div><h2 id="opd-referral-title">Edit Referral</h2><p>{editing.code} · {editing.patient}</p></div><button type="button" disabled={saving} aria-label="Close referral form" onClick={() => setEditing(null)}><X size={18} /></button></header>
      <form className="patient-form" onSubmit={save} key={editing.id}>
        {error && <div className="patient-alert" role="alert"><AlertTriangle size={16} />{error}</div>}
        <h3 className="opd-medical-section">Patient & Referring Facility</h3>
        <label><span>Patient</span><input value={editing.patient} readOnly /></label>
        <label><span>Originating BHC</span><input value={editing.referredFrom} readOnly /></label>
        <h3 className="opd-medical-section">Clinical Referral & Doctor Assignment</h3>
        <label><span>Specialty</span><input name="specialty" defaultValue={editing.specialty} required /></label>
        <label><span>Assigned Doctor</span><select name="doctor" defaultValue={editing.assignedDoctorId || ''}><option value="">Unassigned</option>{editing.assignedDoctorId && !doctors.some((doctor) => doctor.userId === editing.assignedDoctorId) && <option value={editing.assignedDoctorId}>{editing.assignedDoctor} (current assignment)</option>}{doctors.map((doctor) => <option key={doctor.userId} value={doctor.userId}>{doctor.name} — {doctor.specialty || 'General'}</option>)}</select></label>
        <label><span>Status</span><select name="status" defaultValue={editing.status}>{['pending', 'seen', 'accepted', 'completed', 'rejected', 'cancelled'].map((status) => <option key={status}>{status}</option>)}</select></label>
        <label><span>Call Taken By</span><input name="callTakenBy" defaultValue={editing.callTakenBy} /></label>
        <label className="full"><span>Referral Reason</span><textarea name="reason" defaultValue={editing.chiefComplaint} required rows="3" /></label>
        <div className="patient-form-actions"><button disabled={saving} type="button" onClick={() => setEditing(null)}><X size={15} />Cancel</button><button disabled={saving} type="submit"><Save size={15} />{saving ? 'Saving…' : 'Save Referral'}</button></div>
      </form>
    </section></div>}
  </div>
}
export default OPDReferralManagement
