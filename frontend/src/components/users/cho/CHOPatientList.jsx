import PatientMembershipFields, { PatientMembershipProvider, DependentInformationFields } from '../shared/PatientMembershipFields'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowDown, ArrowUp, ChevronsUpDown, Check, Eye, Filter, Search, UserPlus, X, Phone, CalendarDays, Stethoscope, HeartPulse, Weight, Thermometer, Activity, Ruler, Droplets, ExternalLink, MoreVertical } from 'lucide-react'
import { fetchPatients, createPatient } from '../../../services/patients'
import { fetchLucenaAddress } from '../../../services/users'

function CHOPatientList({ patients: providedPatients = null, referrals = [], onViewEhr }) {
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' })
  const [listTab, setListTab] = useState('all')
  const [detailTab, setDetailTab] = useState('vitals')
  const [pageIndex, setPageIndex] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [locationFilter, setLocationFilter] = useState({ region: '', province: '', municipality: '' })
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [fetchedPatients, setPatients] = useState([])
  const patients = providedPatients || fetchedPatients
  const [isSaving, setIsSaving] = useState(false)
  const [createdPatient, setCreatedPatient] = useState(null)
  const [addressData, setAddressData] = useState(null)
  const [addressFields, setAddressFields] = useState({
    region: 'Region IV-A',
    province: '',
    municipality: '',
    barangay: '',
  })
  const [searchKeyword, setSearchKeyword] = useState('')
  const [isLoadingPatients, setIsLoadingPatients] = useState(true)
  const [patientError, setPatientError] = useState('')

  useEffect(() => {
    if (providedPatients) return undefined

    let isMounted = true

    const loadPatients = async () => {
      try {
        const backendPatients = await fetchPatients()
        if (isMounted) {
          setPatients(backendPatients)
          setPatientError('')
        }
      } catch {
        if (isMounted) {
          setPatientError('Unable to load patients from the backend.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingPatients(false)
        }
      }
    }

    loadPatients()

    return () => {
      isMounted = false
    }
  }, [providedPatients])

  useEffect(() => {
    let isMounted = true

    const loadAddressData = async () => {
      try {
        const lucenaAddress = await fetchLucenaAddress()
        if (!isMounted) return

        setAddressData(lucenaAddress)
        setAddressFields({
          region: lucenaAddress.region?.display_name || '',
          province: '',
          municipality: '',
          barangay: '',
        })
      } catch {
        if (isMounted) {
          setAddressData(null)
        }
      }
    }

    loadAddressData()

    return () => {
      isMounted = false
    }
  }, [])

  const regionOptions = addressData?.region?.display_name ? [addressData.region.display_name] : ['Region IV-A']
  const provinceOptions = addressFields.region && addressData?.province?.name ? [addressData.province.name] : []
  const municipalityOptions = addressFields.province && addressData?.city?.name ? [addressData.city.name] : []
  const barangayOptions = addressFields.municipality ? addressData?.barangays || [] : []

  const updateAddressField = (field, value) => {
    setAddressFields((currentFields) => {
      const nextFields = { ...currentFields, [field]: value }

      if (field === 'region') {
        nextFields.province = ''
        nextFields.municipality = ''
        nextFields.barangay = ''
      }

      if (field === 'province') {
        nextFields.municipality = ''
        nextFields.barangay = ''
      }

      if (field === 'municipality') {
        nextFields.barangay = ''
      }

      return nextFields
    })
  }

  const { latestReferrals, activePatients } = useMemo(() => {
    const result = new Map()
    const activePatients = new Set()
    for (const referral of [...referrals].sort((a, b) => new Date(b.date) - new Date(a.date))) {
      if (!result.has(referral.patientId)) result.set(referral.patientId, referral)
      if (!['completed', 'cancelled', 'rejected'].includes(referral.status)) activePatients.add(referral.patientId)
    }
    return { latestReferrals: result, activePatients }
  }, [referrals])
  const matchesTab = (patient, tab) => {
    const referral = latestReferrals.get(patient.id)
    const hasActiveReferral = activePatients.has(patient.id)
    if (tab === 'current') return hasActiveReferral
    if (tab === 'new') return !referral
    if (tab === 'discharged') return !hasActiveReferral && referral?.status === 'completed'
    return true
  }
  const filteredPatients = patients.filter((patient) => matchesTab(patient, listTab)
    && [patient.name, patient.contactNumber, patient.barangay, patient.municipality].some((value) => String(value || '').toLowerCase().includes(searchKeyword.trim().toLowerCase()))
    && Object.entries(locationFilter).every(([key, value]) => !value || patient[key] === value)).sort((a, b) => {
      const getValue = (patient) => sort.key === 'name' ? patient.name : sort.key === 'contact' ? patient.contactNumber : sort.key === 'reason' ? latestReferrals.get(patient.id)?.chiefComplaint || '' : latestReferrals.get(patient.id)?.date || ''
      return String(getValue(a)).localeCompare(String(getValue(b)), undefined, { numeric: true }) * (sort.direction === 'asc' ? 1 : -1)
    })
  const pageCount = Math.max(1, Math.ceil(filteredPatients.length / 10))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const visiblePatients = filteredPatients.slice(currentPage * 10, currentPage * 10 + 10)
  const selectedPatient = filteredPatients.find((patient) => patient.id === selectedPatientId) || null
  const selectedReferral = selectedPatient ? latestReferrals.get(selectedPatient.id) : null
  const toggleSort = (key) => { setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' })); setPageIndex(0) }
  const sortIcon = (key) => sort.key === key ? (sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} />
  const selectPatient = (id) => { setSelectedPatientId(id); setDetailTab('vitals') }

  const savePatient = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const saved = await createPatient(new FormData(event.currentTarget))
      setPatients((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      setCreatedPatient(saved); setShowAddPatient(false); setPatientError('')
    } catch { setPatientError('Unable to save patient. Check the details and try again.') }
    finally { setIsSaving(false) }
  }

  return (
    <>
      {createdPatient && <div className="patient-alert">{createdPatient.wasExistingRecord ? 'Existing patient record found.' : `Patient saved. Username: ${createdPatient.username}. Temporary password: ${createdPatient.generatedPassword}. Give these credentials directly to the patient.`}<button type="button" onClick={() => setCreatedPatient(null)}>Dismiss</button></div>}
      <section className={`cho-patient-page cho-patient-workspace cho-patient-split ${selectedPatient ? 'has-selected-patient' : ''}`}>
        <article className="cho-patient-list-panel">
          <div className="cho-patient-list-heading"><h1>Patient List</h1><button className="request-view-button" type="button" onClick={() => setShowAddPatient(true)}><UserPlus size={14} />Add Patient</button></div>
          <div className="cho-patient-tabs" aria-label="Patient categories">{[['all', 'All Patients'], ['current', 'Current Patients'], ['new', 'New Patients'], ['discharged', 'Discharged Patients']].map(([key, label]) => <button key={key} type="button" aria-pressed={listTab === key} onClick={() => { setListTab(key); setPageIndex(0) }}>{label}<span>{patients.filter((patient) => matchesTab(patient, key)).length}</span></button>)}</div>
          <p className="cho-patient-category-note">{({ all: 'All registered patients.', current: 'Patients with an active referral.', new: 'Registered patients with no referral history.', discharged: 'Patients whose latest referral is completed and who have no active referrals. This is not a hospital discharge record.' })[listTab]}</p>
          <div className="cho-patient-searchbar"><label><Search size={15} /><input type="search" aria-label="Search patients" placeholder="Search patients..." value={searchKeyword} onChange={(event) => { setSearchKeyword(event.target.value); setPageIndex(0) }} /></label><button type="button" className="request-view-button" aria-expanded={showFilters} onClick={() => setShowFilters((value) => !value)}><Filter size={14} />Filters</button></div>
          {showFilters && <div className="cho-patient-location-filters">{[['region', 'Region'], ['province', 'Province'], ['municipality', 'Municipality']].map(([key, label]) => <label key={key}>{label}<select value={locationFilter[key]} onChange={(event) => { setLocationFilter((current) => ({ ...current, [key]: event.target.value })); setPageIndex(0) }}><option value="">All {label}</option>{[...new Set(patients.map((patient) => patient[key]).filter(Boolean))].sort().map((value) => <option key={value}>{value}</option>)}</select></label>)}</div>}
          {isLoadingPatients && !providedPatients ? <div className="patient-alert">Loading patients...</div> : patientError ? <div className="patient-alert" role="alert"><AlertTriangle size={16} />{patientError}</div> : <>
            <div className="bhc-patient-table-wrap"><table className="bhc-patient-table"><thead><tr>{[['name', 'Patient Name'], ['contact', 'Contact Info'], ['reason', 'Reason'], ['date', 'Recorded Time & Date']].map(([key, label]) => <th key={key} aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button className="cho-table-sort" type="button" onClick={() => toggleSort(key)}>{label}{sortIcon(key)}</button></th>)}<th>Action</th></tr></thead><tbody>{visiblePatients.map((patient) => {
              const referral = latestReferrals.get(patient.id)
              return <tr key={patient.id} className={selectedPatientId === patient.id ? 'is-selected' : ''} onClick={() => selectPatient(patient.id)}>
                <td><button className="cho-patient-name" type="button" onClick={() => selectPatient(patient.id)} aria-pressed={selectedPatientId === patient.id}><span className="cho-patient-initials" aria-hidden="true">{patient.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><strong>{patient.name}</strong><small>{patient.age} · {patient.gender}</small></div></button></td>
                <td><span className="cho-patient-contact-number">{patient.contactNumber}</span><small className="cho-table-time">{patient.barangay}</small></td>
                <td>{referral?.chiefComplaint || 'No referral recorded'}</td><td>{referral?.date ? <><span className="cho-table-date">{new Date(referral.date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span><small className="cho-table-time">{new Date(referral.date).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</small></> : '—'}</td>
                <td onClick={(event) => event.stopPropagation()}><div className="cho-patient-row-actions">
                  <button type="button" className="cho-patient-action-icon" title="View patient details" aria-label={`View details for ${patient.name}`} onClick={() => selectPatient(patient.id)}><Eye size={16} /></button>
                  <details className="cho-patient-more-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }}><summary className="cho-patient-action-icon" title="More options" aria-label={`More options for ${patient.name}`}><MoreVertical size={16} /></summary><div className="cho-patient-action-menu"><button type="button" onClick={(event) => { selectPatient(patient.id); event.currentTarget.closest('details').open = false }}>View patient details</button><button type="button" onClick={(event) => { event.currentTarget.closest('details').open = false; onViewEhr?.(patient) }}>Open health record</button></div></details>
                </div></td>
              </tr>
            })}</tbody></table></div>
            {!filteredPatients.length && <p className="patient-alert">No matching patients found.</p>}
            <footer className="cho-patient-pagination"><button type="button" disabled={!currentPage} onClick={() => setPageIndex(currentPage - 1)}>← Previous</button><nav className="cho-patient-page-numbers" aria-label="Patient list pagination">{Array.from({ length: pageCount }, (_, index) => index).filter((index) => index === 0 || index === pageCount - 1 || Math.abs(index - currentPage) <= 1).map((index, position, pages) => <span key={index}>{position > 0 && index - pages[position - 1] > 1 && <span className="cho-pagination-ellipsis" aria-hidden="true">…</span>}<button type="button" aria-label={`Page ${index + 1}`} aria-current={index === currentPage ? 'page' : undefined} onClick={() => setPageIndex(index)}>{index + 1}</button></span>)}</nav><button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPageIndex(currentPage + 1)}>Next →</button></footer>
          </>}
        </article>
        {selectedPatient && <aside className="cho-patient-preview" aria-label="Patient details">
          <header><h2>Patient Details</h2>{selectedPatient && <div><button type="button" aria-label="Open patient health record" onClick={() => onViewEhr?.(selectedPatient)}><ExternalLink size={15} /></button><button type="button" aria-label="Close patient details" onClick={() => setSelectedPatientId(null)}><X size={16} /></button></div>}</header>
          {selectedPatient ? <>
            <div className="cho-patient-preview-identity"><span className="cho-patient-initials" aria-hidden="true">{selectedPatient.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><h3>{selectedPatient.name}</h3><p>{selectedPatient.age} · {selectedPatient.gender}</p></div><div className="cho-patient-contact"><p><Phone size={12} />{selectedPatient.contactNumber}</p><p>{selectedPatient.barangay}</p></div></div>
            <h3>Visit Info</h3><dl className="cho-visit-info">{[['Recorded Time & Date', selectedReferral?.date ? new Date(selectedReferral.date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : null], ['Assigned Doctor', selectedReferral?.assignedDoctor], ['Reason', selectedReferral?.chiefComplaint], ['Status', selectedReferral?.status]].map(([label, value]) => <div key={label}><dt>{label === 'Recorded Time & Date' ? <CalendarDays size={11} /> : label === 'Assigned Doctor' ? <Stethoscope size={11} /> : null}{label}</dt><dd>{label === 'Status' && value ? <span className="cho-detail-status">{value}</span> : value || 'No referral recorded'}</dd></div>)}</dl>
            <section className="cho-emergency-contact"><h3>Emergency Contact</h3><div><span className="cho-contact-icon"><Phone size={16} /></span><p>No emergency contact recorded.</p></div></section>
            <div className="cho-patient-tabs cho-detail-tabs" aria-label="Patient detail sections">{[['vitals', 'Vitals'], ['records', 'Medical Records'], ['medicines', 'Medications'], ['information', 'Patient Information']].map(([key, label]) => <button key={key} type="button" aria-pressed={detailTab === key} onClick={() => setDetailTab(key)}>{label}</button>)}</div>
            {detailTab === 'information' && <dl>{[['Birth Date', selectedPatient.birthDate], ['Civil Status', selectedPatient.civilStatus], ['Barangay', selectedPatient.barangay], ['Municipality', selectedPatient.municipality], ['Province', selectedPatient.province], ['Region', selectedPatient.region], ['PhilHealth Status', selectedPatient.philHealthStatus], ['PhilHealth ID', selectedPatient.philHealthId]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl>}
            {detailTab === 'vitals' && <><p>From the latest recorded referral.</p><dl className="cho-patient-vitals">{[['Blood Pressure', selectedReferral?.bp, Activity], ['Weight', selectedReferral?.weight, Weight], ['Temperature', selectedReferral?.temperature, Thermometer], ['Heart Rate', selectedReferral?.cardiacRate, HeartPulse], ['Oxygen Saturation', selectedReferral?.o2sat, Droplets], ['Height', selectedReferral?.height, Ruler]].map(([label, value, Icon]) => <div key={label}><span className="cho-vital-icon"><Icon size={16} /></span><div><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div></div>)}</dl></>}
            {detailTab === 'records' && <div className="cho-patient-medical-records">{selectedReferral?.consultationDetails?.length ? selectedReferral.consultationDetails.map((record) => <article key={record.id}><h3>Consultation</h3><p>{record.consulted_at ? new Date(record.consulted_at).toLocaleDateString('en-PH') : 'Date not recorded'}</p><dl><div><dt>Diagnosis</dt><dd>{record.diagnosis || 'Not recorded'}</dd></div><div><dt>Treatment Plan</dt><dd>{record.treatment_plan || 'Not recorded'}</dd></div></dl></article>) : <p>No consultation recorded for the latest referral.</p>}<button className="request-view-button" type="button" onClick={() => onViewEhr?.(selectedPatient)}><ExternalLink size={13} />Open full health record</button></div>}
            {detailTab === 'medicines' && <div className="cho-patient-medicine-history">{selectedPatient.medicineDistributions?.length ? selectedPatient.medicineDistributions.map((item) => <article key={item.id}><h3>{item.medicineName}</h3><p>{item.quantity} issued · {item.distributedAt}</p><p>{item.instructions}</p></article>) : <p>No medicine distribution recorded.</p>}</div>}
          </> : <div className="cho-patient-preview-empty"><Eye size={28} /><h3>Select a patient</h3><p>Choose a patient from the list to view their details and latest referral information.</p></div>}
        </aside>}
      </section>

      {showAddPatient && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal cho-add-patient-modal" aria-label="Add new patient form">
            <header>
              <div><span className="cho-form-eyebrow">Patient Registration</span><h2>Add New Patient</h2><p>Enter the patient’s details. Fields marked * are required.</p></div>
              <button type="button" aria-label="Close add patient form" onClick={() => setShowAddPatient(false)}>
                <X size={18} />
              </button>
            </header>

            <PatientMembershipProvider>
            <form className="patient-form" onSubmit={savePatient}>
              {patientError && <p className="cho-form-error" role="alert">{patientError}</p>}
              <h3 className="cho-form-section-title">Personal Information</h3>
              <label><span>First Name *</span><input name="firstName" type="text" autoComplete="given-name" required /></label>
              <label><span>Middle Name</span><input name="middleName" type="text" /></label>
              <label><span>Last Name *</span><input name="lastName" type="text" autoComplete="family-name" required /></label>
              <label><span>Contact Number</span><input name="contactNumber" maxLength={11} inputMode="numeric" pattern="[0-9]{1,11}" title="Enter up to 11 digits only" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 11) }} type="tel" /></label>
              <label><span>Birth Date</span><input name="birthDate" type="date" /></label>
              <fieldset>
                <legend>Sex</legend>
                <label><input name="sex" value="Male" type="radio" /> Male</label>
                <label><input name="sex" value="Female" type="radio" /> Female</label>
              </fieldset>
              <label><span>Civil Status</span><select name="civilStatus" defaultValue="Single"><option>Single</option><option>Married</option><option>Widowed</option></select></label>
              <h3 className="cho-form-section-title">PhilHealth Information</h3>
              <PatientMembershipFields />
              <h3 className="cho-form-section-title">Address Information</h3>
              <label>
                <span>Region</span>
                <select
                  name="region"
                  value={addressFields.region}
                  onChange={(event) => updateAddressField('region', event.target.value)}
                >
                  {regionOptions.map((region) => (
                    <option key={region}>{region}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Province</span>
                <select
                  name="province"
                  value={addressFields.province}
                  onChange={(event) => updateAddressField('province', event.target.value)}
                >
                  <option value="">Select Province</option>
                  {provinceOptions.map((province) => (
                    <option key={province}>{province}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Municipality/City</span>
                <select
                  name="municipality"
                  value={addressFields.municipality}
                  onChange={(event) => updateAddressField('municipality', event.target.value)}
                  disabled={!addressFields.province}
                >
                  <option value="">Select Municipality</option>
                  {municipalityOptions.map((municipality) => (
                    <option key={municipality}>{municipality}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Barangay *</span>
                <select
                  name="barangay"
                  required
                  value={addressFields.barangay}
                  onChange={(event) => updateAddressField('barangay', event.target.value)}
                  disabled={!addressFields.municipality}
                >
                  <option value="">Select Barangay</option>
                  {barangayOptions.map((barangay) => (
                    <option key={barangay}>{barangay}</option>
                  ))}
                </select>
              </label>
              <DependentInformationFields />
              <div className="patient-form-actions">
                <button type="button" onClick={() => setShowAddPatient(false)}>
                  <ArrowLeft size={15} />
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}>
                  <Check size={15} />
                  {isSaving ? 'Saving…' : 'Save Patient'}
                </button>
              </div>
            </form>
            </PatientMembershipProvider>
          </section>
        </div>
      )}
    </>
  )
}

export default CHOPatientList
