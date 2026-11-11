import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Eye, Filter, Search, UserCheck, X } from 'lucide-react'
import { fetchOpdReferrals, updateReferral } from '../../../services/referrals'
import { fetchDoctors, fetchOnlineUsers } from '../../../services/users'
import '../opd/OPDIncomingUI.css'
import '../opd/OPDReferralSheet.css'

const specialtyAliases = {
  GP: 'GP (General Practitioner)',
  Pedia: 'Pediatrician',
  Psych: 'Psychiatrist',
  Gastro: 'Gastroenterologist',
  'OB/Gyne': 'OB-Gyne',
}

const referralViews = ['Incoming', 'Referred', 'Accepted', 'Online Doctors']

function referralView(item) {
  if (item.status === 'accepted') return 'Accepted'
  if (['pending', 'seen'].includes(item.status)) return item.assignedDoctorId ? 'Referred' : 'Incoming'
  return null
}

function useOnlineDoctors() {
  const [staff, setStaff] = useState(null)
  const [message, setMessage] = useState('Loading online doctors…')
  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const [presence, doctors] = await Promise.all([fetchOnlineUsers(), fetchDoctors()])
        if (!active) return
        const onlineIds = new Set(presence.staff.map((person) => person.id))
        const online = doctors.filter((doctor) => onlineIds.has(doctor.id))
        setStaff(online)
        setMessage(online.length ? '' : 'No doctors are currently online.')
      } catch {
        if (active) {
          setStaff(null)
          setMessage('Unable to load online doctors.')
        }
      }
    }
    refresh()
    const timer = window.setInterval(refresh, 30000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  return { staff, message }
}

function OnlineDoctors({ staff, message }) {
  return <section aria-label="Online Doctors">
    <h2 className="cho-incoming-title">Online Doctors</h2>
    {message ? <p role="status">{message}</p> : <ul>{staff.map((doctor) => (
      <li key={doctor.id}><strong>{doctor.name}</strong> · {doctor.specialty || doctor.facility}</li>
    ))}</ul>}
  </section>
}

const vitalFields = [
  ['bp', 'blood_pressure', 'Blood pressure (mmHg)'],
  ['respirationRate', 'respiration_rate', 'Respiratory rate (breaths/min)'],
  ['cardiacRate', 'cardiac_rate', 'Heart rate (bpm)'],
  ['o2sat', 'oxygen_saturation', 'Oxygen saturation (%)'],
  ['temperature', 'temperature', 'Temperature (°C)'],
  ['weight', 'weight', 'Weight (kg)'],
  ['height', 'height', 'Height (cm)'],
]

function ReferralVitals({ referral, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const editableValue = (key) => referral[key] === 'Not set' ? '' : referral[key] || ''
  async function save(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const changes = {}
    for (const [key, field] of vitalFields) {
      const value = form.get(key).trim()
      if (value !== editableValue(key)) changes[field] = value
    }
    if (!Object.keys(changes).length) {
      setEditing(false)
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const updated = await updateReferral(referral.backendId, changes)
      onSaved(referral.backendId, Object.fromEntries(vitalFields.map(([key]) => [key, updated[key]])))
      setEditing(false)
      setMessage('Vital signs saved.')
    } catch {
      setMessage('Unable to save vital signs. Please try again.')
    } finally {
      setSaving(false)
    }
  }
  return <section className="opd-sheet-section opd-recorded-vitals">
    <h3>03 · Recorded Vital Signs</h3>
    {editing ? <form onSubmit={save}>
      <div className="opd-sheet-vitals">{vitalFields.map(([key, , label]) => (
        <label key={key}>{label}<input name={key} defaultValue={editableValue(key)} maxLength={40} disabled={saving} /></label>
      ))}</div>
      <div className="patient-form-actions">
        <button type="button" disabled={saving} onClick={() => { setEditing(false); setMessage('') }}>Cancel</button>
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Vital Signs'}</button>
      </div>
    </form> : <>
      <dl className="opd-sheet-vitals">{vitalFields.map(([key, , label]) => (
        <div key={key}><dt>{label}</dt><dd>{referral[key] || 'Not recorded'}</dd></div>
      ))}</dl>
      <div className="patient-form-actions"><button type="button" onClick={() => { setEditing(true); setMessage('') }}>Update Vital Signs</button></div>
    </>}
    {message && <p role="status">{message}</p>}
  </section>
}

function CHOIncomingReferrals({ onReferralAccepted }) {
  const onlineDoctors = useOnlineDoctors()
  const [view, setView] = useState('Incoming')
  const [incomingItems, setIncomingItems] = useState([])
  const [doctorUsers, setDoctorUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [incomingError, setIncomingError] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    date: '',
    facility: '',
    department: '',
    barangay: '',
    status: '',
  })
  const [selectedForm, setSelectedForm] = useState(null)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [assignedDoctors, setAssignedDoctors] = useState({})
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadIncomingReferrals = async () => {
      try {
        const backendIncoming = await fetchOpdReferrals()
        if (isMounted) {
          setIncomingItems(backendIncoming)
          setIncomingError('')
        }
      } catch {
        if (isMounted) {
          setIncomingError('Unable to load incoming referrals from the backend.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadIncomingReferrals()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadDoctors = async () => {
      try {
        const doctors = await fetchDoctors()
        if (isMounted) {
          setDoctorUsers(doctors)
        }
      } catch {
        if (isMounted) {
          setDoctorUsers([])
        }
      }
    }

    loadDoctors()

    return () => {
      isMounted = false
    }
  }, [])

  const facilities = [...new Set(incomingItems.map((item) => item.barangay))]
  const statuses = [...new Set(incomingItems.map((item) => item.status))]

  const filteredIncomingItems = useMemo(() => {
    const searchText = filters.search.trim().toLowerCase()

    return incomingItems.filter((item) => {
      if (referralView(item) !== view) return false
      const matchesSearch =
        !searchText ||
        [item.id, item.patient, item.source, item.referredBy, item.barangay, item.department, item.status]
          .some((value) => String(value).toLowerCase().includes(searchText))
      const matchesDate = !filters.date || item.time?.slice(0, 10) === filters.date

      return (
        matchesSearch &&
        matchesDate &&
        (!filters.barangay || item.barangay === filters.barangay) &&
        (!filters.department || item.department === filters.department) &&
        (!filters.status || item.status === filters.status)
      )
    })
  }, [filters, incomingItems, view])

  const updateFilter = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  const openAssignment = (item) => {
    setSelectedAssignment(item)
    setSelectedDoctor(assignedDoctors[item.id] || '')
  }

  const handleViewForm = async (item) => {
    setSelectedForm(item)

    if (view !== 'Incoming' || item.status !== 'pending') return

    try {
      await updateReferral(item.backendId, { status: 'seen' })
      setIncomingItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.backendId === item.backendId ? { ...currentItem, status: 'seen' } : currentItem,
        ),
      )
      setSelectedForm((currentForm) =>
        currentForm?.backendId === item.backendId ? { ...currentForm, status: 'seen' } : currentForm,
      )
      setActionError('')
    } catch {
      setActionError('Unable to mark this referral as seen.')
    }
  }

  const getAvailableDoctors = (specialty) => {
    const doctorSpecialty = specialtyAliases[specialty] || specialty
    const specialtyDoctors = doctorUsers.filter(
      (doctor) => String(doctor.name || '').trim().toLowerCase() !== 'doctor' && (!doctor.specialty || doctor.specialty === specialty || doctor.specialty === doctorSpecialty),
    )

    if (specialtyDoctors.length > 0) return specialtyDoctors

    return []
  }

  const handleAssignDoctor = async (event) => {
    event.preventDefault()

    if (!selectedAssignment || !selectedDoctor) return

    const availableDoctors = getAvailableDoctors(selectedAssignment.specialty)
    const doctor = availableDoctors.find((item) => String(item.userId) === selectedDoctor)
    const payload = {
      status: 'pending',
      specialty: selectedAssignment.specialty,
    }

    if (selectedDoctor) {
      payload.assigned_doctor = Number(selectedDoctor)
    }

    try {
      const updatedReferral = await updateReferral(selectedAssignment.backendId, payload)
      setIncomingItems((currentItems) =>
        currentItems.map((item) => item.backendId === selectedAssignment.backendId
          ? { ...item, status: updatedReferral.status, assignedDoctorId: updatedReferral.assignedDoctorId }
          : item),
      )
      onReferralAccepted?.(updatedReferral)
      setActionError('')
    } catch {
      setActionError('Unable to connect this incoming referral to a doctor.')
      return
    }

    setAssignedDoctors((currentAssignments) => ({
      ...currentAssignments,
      [selectedAssignment.id]: doctor?.name || selectedDoctor,
    }))
    setSelectedAssignment(null)
  }

  return (
    <div className="opd-incoming-modern">
      <div className="cho-page-heading">
        <div>
          <span>Referral</span>
          <h1>Incoming Referrals</h1>
          <p>Review incoming patients referred to the City Health Office.</p>
        </div>
      </div>

      <section className="cho-incoming-page">
        <nav className="opd-list-tabs" aria-label="Referral navigation">
          {referralViews.map((name) => (
            <button key={name} type="button" aria-pressed={view === name} onClick={() => setView(name)}>
              {name}<span>{name === 'Online Doctors'
                ? onlineDoctors.staff?.length ?? '–'
                : isLoading || incomingError ? '–' : incomingItems.filter((item) => referralView(item) === name).length}</span>
            </button>
          ))}
        </nav>
        {view === 'Online Doctors' ? <OnlineDoctors {...onlineDoctors} /> : <>
        <section className="cho-filter-panel cho-incoming-sidebar" aria-label="Filter incoming referrals">
          <label>
            <span>Search</span>
            <div>
              <Search size={15} />
              <input
                type="search"
                placeholder="Code, Firstname, Lastname"
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </div>
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
          </label>
          <label>
            <span>Barangay</span>
            <select value={filters.barangay} onChange={(event) => updateFilter('barangay', event.target.value)}>
              <option value="">All Barangay</option>
              {facilities.map((barangay) => (
                <option key={barangay}>{barangay}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">All Status</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <button
            className="filter-button"
            type="button"
            onClick={() => setFilters({ search: '', date: '', facility: '', department: '', barangay: '', status: '' })}
          >
            <Filter size={14} />
            Reset
          </button>

        </section>

        <div className="cho-incoming-content">
          <h2 className="cho-incoming-title">{view} Patients</h2>

          <div className="cho-incoming-list">
            {actionError && (
              <article className="bhc-referral-empty">
                <AlertTriangle size={18} />
                <div>
                  <h2>Referral connection failed</h2>
                  <p>{actionError}</p>
                </div>
              </article>
            )}
            {isLoading ? (
              <article className="bhc-referral-empty">
                <AlertTriangle size={18} />
                <div>
                  <h2>Loading incoming referrals</h2>
                  <p>Fetching BHC referrals by barangay from the backend.</p>
                </div>
              </article>
            ) : incomingError ? (
              <article className="bhc-referral-empty">
                <AlertTriangle size={18} />
                <div>
                  <h2>Unable to load incoming referrals</h2>
                  <p>{incomingError}</p>
                </div>
              </article>
            ) : filteredIncomingItems.length > 0 ? (
              filteredIncomingItems.map((item) => (
              <article className={item.status === 'Discharged' ? 'cho-incoming-card discharged' : 'cho-incoming-card'} key={item.id}>
                <div className="incoming-card-icon">
                  <span aria-hidden="true">{String(item.patient).split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                </div>
                <div className="incoming-card-body">
                  <header>
                    <div>
                      <h3>{item.patient}</h3>
                      <p>{item.sex} · {item.age} · {item.department}</p>
                    </div>
                    <time>{new Date(item.time).toLocaleString()}</time>
                  </header>
                  <dl className="opd-incoming-metadata"><div><dt>Originating BHC</dt><dd>{item.source}</dd></div><div><dt>Referred By</dt><dd>{item.referredBy}</dd></div><div><dt>Referral Status</dt><dd><span className="opd-incoming-status">{item.status}</span></dd></div></dl>

                  <div className="incoming-card-actions">
                    <button className="view-all-button" type="button" onClick={() => handleViewForm(item)}>
                      <Eye size={14} />
                      View Form
                    </button>
                    {view === 'Incoming' && <button className="primary-action-button" type="button" onClick={() => openAssignment(item)}>
                      <UserCheck size={14} />
                      Assign Doctors
                    </button>}
                  </div>
                  {assignedDoctors[item.id] && (
                    <p className="assigned-doctor-note">Assigned Doctor: {assignedDoctors[item.id]}</p>
                  )}
                </div>
              </article>
              ))
            ) : (
              <article className="bhc-referral-empty">
                <AlertTriangle size={18} />
                <div>
                  <h2>No {view.toLowerCase()} referrals found</h2>
                  <p>Records matching this view and your filters will appear here.</p>
                </div>
              </article>
            )}
          </div>
        </div>
        </>}
      </section>

      {selectedForm && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal cho-referral-form-modal opd-medical-sheet-modal" aria-label="Incoming referral form details">
            <header>
              <div><h2>Medical Referral Form</h2><p>Barangay Health Center to City Health Office</p></div>
              <button type="button" aria-label="Close referral form" onClick={() => setSelectedForm(null)}>
                <X size={18} />
              </button>
            </header>

            <div className="opd-medical-sheet">
              <div className="opd-sheet-identification"><div><span>Referral Reference</span><strong>{selectedForm.id}</strong></div><div><span>Recorded Time & Date</span><strong>{selectedForm.time ? new Date(selectedForm.time).toLocaleString('en-PH') : 'Not recorded'}</strong></div><div><span>Status</span><strong>{selectedForm.status || 'Not recorded'}</strong></div></div>
              <section className="opd-sheet-section"><h3>01 · Patient Particulars</h3><dl className="opd-sheet-fields"><div className="opd-sheet-wide"><dt>Patient Name</dt><dd>{selectedForm.patient}</dd></div><div><dt>Age</dt><dd>{selectedForm.age}</dd></div><div><dt>Sex</dt><dd>{selectedForm.sex || 'Not recorded'}</dd></div><div className="opd-sheet-wide"><dt>Barangay</dt><dd>{selectedForm.barangay || 'Not recorded'}</dd></div></dl></section>
              <section className="opd-sheet-section"><h3>02 · Referral Information</h3><dl className="opd-sheet-fields"><div><dt>Referring Facility</dt><dd>{selectedForm.source}</dd></div><div><dt>Receiving Office</dt><dd>City Health Office</dd></div><div><dt>Specialty</dt><dd>{selectedForm.specialty}</dd></div><div><dt>Receiving Department</dt><dd>{selectedForm.department}</dd></div><div className="opd-sheet-wide"><dt>Chief Complaint / Reason for Referral</dt><dd>{selectedForm.chiefComplaint}</dd></div></dl></section>
              <ReferralVitals key={selectedForm.backendId} referral={selectedForm} onSaved={(id, vitals) => {
                setIncomingItems((items) => items.map((item) => item.backendId === id ? { ...item, ...vitals } : item))
                setSelectedForm((item) => item?.backendId === id ? { ...item, ...vitals } : item)
              }} />
              <section className="opd-sheet-section"><h3>04 · eKonsult / BHS Profile</h3><dl className="opd-sheet-vitals"><div><dt>First eKonsult Encounter</dt><dd>{selectedForm.ekonsultEncounter}</dd></div><div><dt>Visit Number</dt><dd>{selectedForm.visitNumber}</dd></div><div><dt>Profiled at BHS</dt><dd>{selectedForm.profiledAtBhs}</dd></div></dl></section>
              <section className="opd-sheet-section"><h3>05 · Referring Personnel</h3><dl className="opd-sheet-fields"><div><dt>Referred By</dt><dd>{selectedForm.referredBy}</dd></div><div><dt>Referring Facility</dt><dd>{selectedForm.source}</dd></div></dl></section>
              <p className="opd-sheet-note">Patient is referred for evaluation by the receiving department and assigned doctor. Values shown are from the recorded referral.</p>
            </div>
          </section>
        </div>
      )}

      {selectedAssignment && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal cho-assign-doctor-modal" aria-label="Assign doctor form">
            <header>
              <h2>Assign Doctors</h2>
              <button type="button" aria-label="Close assign doctor form" onClick={() => setSelectedAssignment(null)}>
                <X size={18} />
              </button>
            </header>

            <form className="cho-assign-doctor-form" onSubmit={handleAssignDoctor}>
              <div className="assign-patient-summary">
                <strong>{selectedAssignment.patient}</strong>
                <span>{selectedAssignment.specialty} | {selectedAssignment.source}</span>
              </div>

              <label><span>Specialty</span><select value={selectedAssignment.specialty} onChange={(event) => { setSelectedAssignment((current) => ({ ...current, specialty: event.target.value })); setSelectedDoctor('') }}>
                {[...new Set([selectedAssignment.specialty, ...Object.keys(specialtyAliases), ...Object.values(specialtyAliases), ...doctorUsers.map((doctor) => doctor.specialty)].filter(Boolean))].map((specialty) => <option key={specialty}>{specialty}</option>)}
              </select></label>

              <fieldset>
                <legend>Available Doctors</legend>
                {getAvailableDoctors(selectedAssignment.specialty).map((doctor) => {
                  const doctorValue = String(doctor.userId)

                  return (
                  <label key={`${doctor.name}-${doctor.userId || 'static'}`}>
                    <input
                      name="assignedDoctor"
                      type="radio"
                      value={doctorValue}
                      checked={selectedDoctor === doctorValue}
                      onChange={(event) => setSelectedDoctor(event.target.value)}
                    />
                    {doctor.name}
                  </label>
                  )
                })}
                {getAvailableDoctors(selectedAssignment.specialty).length === 0 && (
                  <p>No doctors are configured for this specialty yet.</p>
                )}
              </fieldset>

              <div className="patient-form-actions">
                <button type="button" onClick={() => setSelectedAssignment(null)}>
                  <X size={15} />
                  Cancel
                </button>
                <button type="submit">
                  <Check size={15} />
                  Assign Doctor
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default CHOIncomingReferrals
