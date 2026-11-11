import { useEffect, useMemo, useState } from 'react'
import { Ambulance, FileCheck2, Search, Stethoscope, Users } from 'lucide-react'
import { fetchStaffUsers } from '../../../services/users'
import './CHOReferralLayout.css'

const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-PH') : '—'

function CHOReferralMonitoring({ referrals, initialView = 'referrals', onViewPatient, onViewDoctor, initialDoctorId = '', syncError = '' }) {
  const view = initialView
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [doctorId, setDoctorId] = useState(initialDoctorId)
  const [doctors, setDoctors] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const load = async () => {
      try { const staff = await fetchStaffUsers(); if (active) { setDoctors(staff.filter((item) => item.role === 'doctor')); setError('') } }
      catch { if (active) setError('Unable to refresh the doctor directory. Referral records remain available.') }
    }
    load()
    const timer = window.setInterval(load, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  const doctorRows = useMemo(() => {
    const directory = new Map(doctors.map((doctor) => [doctor.userId, doctor]))
    referrals.forEach((item) => { if (item.assignedDoctorId && !directory.has(item.assignedDoctorId)) directory.set(item.assignedDoctorId, { userId: item.assignedDoctorId, name: item.assignedDoctor, specialty: item.specialty, status: 'Not in current directory' }) })
    return [...directory.values()].map((doctor) => {
      const assigned = referrals.filter((item) => item.assignedDoctorId === doctor.userId)
      return { ...doctor, assigned, patients: new Set(assigned.map((item) => item.patientId)).size, waiting: assigned.filter((item) => ['pending', 'seen'].includes(item.status)).length, accepted: assigned.filter((item) => item.status === 'accepted').length, completed: assigned.filter((item) => item.status === 'completed').length }
    })
  }, [doctors, referrals])
  const rows = referrals.filter((item) => (!status || item.status === status) && (!doctorId || String(item.assignedDoctorId) === doctorId) && [item.code, item.patient, item.assignedDoctor, item.barangay, item.specialty, item.referredFrom].some((value) => String(value).toLowerCase().includes(search.toLowerCase())))
  const filteredDoctors = doctorRows.filter((item) => [item.name, item.specialty].some((value) => String(value).toLowerCase().includes(search.toLowerCase())))
  const stats = [['Total Referrals', referrals.length, Ambulance], ['Awaiting OPD Assignment', referrals.filter((item) => !item.assignedDoctorId && !['completed', 'cancelled'].includes(item.status)).length, Users], ['Under Consultation', referrals.filter((item) => item.status === 'accepted').length, Stethoscope], ['Completed', referrals.filter((item) => item.status === 'completed').length, FileCheck2]]
  return <div className="cho-referral-styled">
    <div className="cho-page-heading"><div><span>CHO Oversight · OPD & Doctors</span><h1>{view === 'doctors' ? 'Doctor Assignments' : 'Referral Monitoring'}</h1><p>{view === 'doctors' ? 'Monitor doctor workload, assigned patients, and consultation progress.' : 'Monitor OPD assignments, referral status, and patient progress.'}</p></div></div>
    {error && <p className="patient-alert" role="alert">{error}</p>}
    {syncError && <p className="patient-alert" role="alert">{syncError}</p>}
    <section className="cho-stats-grid cho-monitor-stats">{stats.map(([label, count, Icon]) => <article className="cho-stat-card" key={label}><div className="cho-stat-icon"><Icon size={24} /></div><span>{label}</span><strong>{count}</strong></article>)}</section>
    <article className="cho-panel">
      <div className="cho-monitor-toolbar"><label><Search size={16} /><input type="search" aria-label="Search referral monitoring" placeholder={view === 'doctors' ? 'Search doctor or specialty' : 'Search patient, referral, doctor, or BHC'} value={search} onChange={(event) => setSearch(event.target.value)} /></label>{view === 'referrals' && <><select aria-label="Filter referral status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{['pending', 'seen', 'accepted', 'completed', 'rejected', 'cancelled'].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter assigned doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}><option value="">All doctors</option>{doctorRows.map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}</select></>}</div>
      {view === 'doctors' ? <div className="cho-monitor-doctors">{filteredDoctors.map((doctor) => <article className="cho-monitor-doctor" key={doctor.userId}><div className="cho-panel-heading"><div><span>{doctor.specialty || 'General practice'}</span><h2>{doctor.name}</h2><p>{doctor.status}</p></div><Stethoscope size={24} /></div><div className="cho-monitor-workload"><div><strong>{doctor.patients}</strong><span>Assigned patients</span></div><div><strong>{doctor.waiting}</strong><span>Awaiting acceptance</span></div><div><strong>{doctor.accepted}</strong><span>In consultation</span></div><div><strong>{doctor.completed}</strong><span>Completed referrals</span></div></div><button type="button" className="request-view-button" onClick={() => onViewDoctor(doctor.userId)}>View assigned patients</button></article>)}{!filteredDoctors.length && <p>No doctors match your search.</p>}</div> : <>
        <h2>Referral Register ({rows.length})</h2><div className="cho-medicine-request-table-wrap"><table className="cho-medicine-request-table"><thead><tr><th>Referral / Patient</th><th>Originating BHC</th><th>Assigned Doctor</th><th>Specialty</th><th>Status</th><th>Consultation</th><th>Submitted</th><th>Record</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td><strong>{item.code}</strong><span>{item.patient}</span></td><td>{item.referredFrom}</td><td>{item.assignedDoctor}</td><td>{item.specialty}</td><td><span className={`cho-request-status ${item.status === 'completed' ? 'delivered' : item.status === 'accepted' ? 'approved' : 'pending'}`}>{item.status}</span></td><td>{item.consultationDetails.length ? item.consultationDetails[0].diagnosis : 'Awaiting findings'}</td><td>{formatDate(item.date)}</td><td><button className="request-view-button" type="button" onClick={() => onViewPatient({ id: item.patientId })}>View patient progress</button></td></tr>)}</tbody></table></div>{!rows.length && <p>No referral records match your filters.</p>}
      </>}
    </article>
  </div>
}
export default CHOReferralMonitoring
