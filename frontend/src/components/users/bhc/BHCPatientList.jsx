import BHCFilterToolbar from './BHCFilterToolbar'
import PatientIdScanner from './PatientIdScanner'
import SearchableReferralSelect from '../shared/SearchableReferralSelect'
import PatientMembershipFields, { PatientMembershipProvider, DependentInformationFields } from '../shared/PatientMembershipFields'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Edit, FileText, Pill, Send, UserPlus, X } from 'lucide-react'
import { fetchDiseases, fetchPuroks } from '../../../services/gis'
import { createPatientMedicineRequest } from '../../../services/medicines'
import { createPatient, fetchPatients, updatePatient } from '../../../services/patients'
import { createReferral, fetchReferrals } from '../../../services/referrals'
import './BHCPatientListLayout.css'
import './BHCReferralForm.css'

const referralSpecialties = ['Pedia', 'GP', 'Gastro', 'Surgery', 'ENT', 'Psych', 'OB/Gyne', 'Other']
const chiefComplaintsBySpecialty = {
  Pedia: [
    'Fever',
    'Cough and colds',
    'Diarrhea or vomiting',
    'Poor feeding',
    'Difficulty breathing',
    'Rashes',
    'Seizure episode',
  ],
  GP: [
    'Chest pain',
    'Hypertension',
    'Diabetes concern',
    'Dizziness or weakness',
    'Body malaise',
    'Wound care',
    'Follow-up consultation',
  ],
  Gastro: [
    'Abdominal pain',
    'Persistent vomiting',
    'Persistent diarrhea',
    'Blood in stool',
    'Jaundice',
    'Constipation',
    'Acid reflux',
  ],
  Surgery: [
    'Open wound',
    'Suspected fracture',
    'Abscess',
    'Laceration',
    'Acute abdominal pain',
    'Burn injury',
    'Mass for evaluation',
  ],
  ENT: [
    'Ear pain',
    'Hearing concern',
    'Sore throat',
    'Nasal bleeding',
    'Difficulty swallowing',
    'Dizziness or vertigo',
    'Facial or neck swelling',
  ],
  Psych: [
    'Anxiety symptoms',
    'Depressive symptoms',
    'Behavioral changes',
    'Sleep disturbance',
    'Self-harm risk',
    'Substance use concern',
    'Psychiatric follow-up',
  ],
  'OB/Gyne': [
    'Prenatal check-up',
    'Vaginal bleeding',
    'Abdominal pain in pregnancy',
    'Hypertension in pregnancy',
    'Postpartum concern',
    'Menstrual problem',
    'Family planning concern',
  ],
  Other: ['Other complaint not listed'],
}

const birthMonthOptions = [
  ['01', 'January'],
  ['02', 'February'],
  ['03', 'March'],
  ['04', 'April'],
  ['05', 'May'],
  ['06', 'June'],
  ['07', 'July'],
  ['08', 'August'],
  ['09', 'September'],
  ['10', 'October'],
  ['11', 'November'],
  ['12', 'December'],
]

const getBirthDatePart = (dateValue, partIndex) => dateValue?.split('-')?.[partIndex] || ''

const getUniqueOptions = (options) => {
  const seen = new Set()
  return options.filter((option) => {
    const key = option.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function BHCPatientList({
  onReferralSubmit,
  onPatientSaved,
  onPatientUpdated,
  onMedicineRequestCreated,
  onOpenMedicineDistribution,
  currentUserName = 'BHC Staff',
}) {
  const [referrals, setReferrals] = useState([])
  const [referralError, setReferralError] = useState('')
  const [referralsLoaded, setReferralsLoaded] = useState(false)
  const [patientTab, setPatientTab] = useState('all')
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const patientDetailsDialog = useRef(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [registrationStep, setRegistrationStep] = useState(1)
  const registrationForm = useRef(null)
  const nextRegistrationStep = (form) => {
    const fields = [...form.querySelectorAll('[data-registration-step="1"] input, [data-registration-step="1"] select')]
    if (fields.every((field) => field.reportValidity())) setRegistrationStep(2)
  }
  const [patientForReferral, setPatientForReferral] = useState(null)
  const [referralStep, setReferralStep] = useState(1)
  const [patientForEdit, setPatientForEdit] = useState(null)
  const [patients, setPatients] = useState([])
  const [patientAccount, setPatientAccount] = useState(null)
  const [walkInPatientName, setWalkInPatientName] = useState('')
  const walkInDialog = useRef(null)
  useEffect(() => {
    if (walkInPatientName && !walkInDialog.current?.open) walkInDialog.current?.showModal()
  }, [walkInPatientName])
  const [filters, setFilters] = useState({ gender: '', barangay: '' })
  const [searchKeyword, setSearchKeyword] = useState('')
  const [isLoadingPatients, setIsLoadingPatients] = useState(true)
  const [patientError, setPatientError] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState('Pedia')
  const [diseases, setDiseases] = useState([])
  const [puroks, setPuroks] = useState([])
  const [isLoadingPuroks, setIsLoadingPuroks] = useState(false)

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    let isMounted = true
    const barangay = patientForReferral?.barangay

    if (!barangay || barangay === 'No barangay') {
      queueMicrotask(() => {
        if (isMounted) {
          setPuroks([])
          setIsLoadingPuroks(false)
        }
      })
      return undefined
    }

    const loadPuroks = async () => {
      setIsLoadingPuroks(true)
      try {
        const backendPuroks = await fetchPuroks(barangay)
        if (isMounted) {
          setPuroks(backendPuroks)
        }
      } catch {
        if (isMounted) {
          setPuroks([])
        }
      } finally {
        if (isMounted) {
          setIsLoadingPuroks(false)
        }
      }
    }

    loadPuroks()

    return () => {
      isMounted = false
    }
  }, [patientForReferral])

  useEffect(() => {
    let isMounted = true

    const loadDiseases = async () => {
      try {
        const backendDiseases = await fetchDiseases()
        if (isMounted) {
          setDiseases(backendDiseases)
        }
      } catch {
        if (isMounted) {
          setDiseases([])
        }
      }
    }

    loadDiseases()

    return () => {
      isMounted = false
    }
  }, [])

  const latestReferrals = useMemo(() => {
    const records = new Map()
    for (const referral of [...referrals].sort((a, b) => new Date(b.date) - new Date(a.date))) {
      if (!records.has(referral.patientId)) records.set(referral.patientId, referral)
    }
    return records
  }, [referrals])
  const filteredPatients = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()

    return patients.filter((patient) =>
      (patientTab === 'all' || !referralsLoaded || (patientTab === 'current' ? latestReferrals.has(patient.id) : !latestReferrals.has(patient.id))) &&
      (!filters.gender || patient.gender === filters.gender) && (!filters.barangay || patient.barangay === filters.barangay) &&
      [patient.name, patient.contactNumber, patient.barangay, patient.municipality]
        .some((value) => value.toLowerCase().includes(keyword)),
    )
  }, [patients, searchKeyword, filters, patientTab, latestReferrals, referralsLoaded])

  useEffect(() => {
    let active = true
    const load = async () => {
      try { const records = await fetchReferrals(); if (active) { setReferrals(records); setReferralsLoaded(true); setReferralError('') } }
      catch { if (active) setReferralError('Unable to load referral details. Patient records remain available.') }
    }
    load()
    const timer = window.setInterval(load, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  const pageCount = Math.max(1, Math.ceil(filteredPatients.length / 10))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const visiblePatients = filteredPatients.slice(currentPage * 10, currentPage * 10 + 10)
  const selectedPatient = filteredPatients.find((patient) => patient.id === selectedPatientId)
  useEffect(() => {
    const dialog = patientDetailsDialog.current
    if (!selectedPatient || !dialog) return
    const previouslyFocused = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      previouslyFocused?.focus()
    }
  }, [selectedPatient])

  const chiefComplaintOptions = useMemo(() => {
    const specialtyComplaints = chiefComplaintsBySpecialty[selectedSpecialty] || []
    const diseaseOptions = diseases.map((disease) => disease.disease_name)
    return getUniqueOptions([...specialtyComplaints, ...diseaseOptions])
  }, [diseases, selectedSpecialty])

  const handleAddPatient = async (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    try {
      const createdPatient = await createPatient(formData)
      setPatients((currentPatients) => {
        const withoutDuplicate = currentPatients.filter((patient) => patient.id !== createdPatient.id)
        return [createdPatient, ...withoutDuplicate]
      })
      setPatientAccount(createdPatient)
      onPatientSaved?.(createdPatient)
      setShowAddPatient(false)
      setPatientError('')
    } catch {
      setPatientError('Unable to save patient to the backend.')
    }
  }

  const handleSubmitReferral = async (event) => {
    event.preventDefault()
    if (referralStep === 1) {
      setReferralStep(2)
      return
    }

    const formData = new FormData(event.currentTarget)
    const chiefComplaint = formData.get('chiefComplaint') || 'For assessment'
    const purokFid = formData.get('purokFid') || ''
    const selectedPurok = puroks.find((purok) => String(purok.fid) === String(purokFid))
    const referral = {
      patient: patientForReferral,
      destination: formData.get('destination') || 'Lucena City Health Office',
      specialty: formData.get('specialty') || 'Pedia',
      chiefComplaint,
      referredBy: currentUserName,
      notes: formData.get('reasonForReferral') || chiefComplaint || 'No additional notes',
      bp: formData.get('bp') || 'Not set',
      temperature: formData.get('temperature') || 'Not set',
      o2sat: formData.get('o2sat') || 'Not set',
      weight: formData.get('weight') || 'Not set',
      height: formData.get('height') || 'Not set',
      respirationRate: formData.get('respirationRate') || 'Not set',
      cardiacRate: formData.get('cardiacRate') || 'Not set',
      ekonsultEncounter: formData.get('ekonsultEncounter') || 'No',
      visitNumber: formData.get('visitNumber') || 'Not indicated',
      profiledAtBhs: formData.get('profiledAtBhs') || 'No',
      otherDiagnosis: chiefComplaint,
      purokFid,
      purokName: selectedPurok?.purok_name || '',
      callTakenBy: formData.get('callTakenBy') || '',
      date: new Date().toISOString(),
      status: 'Referred',
    }

    try {
      const createdReferral = await createReferral(referral)
      onReferralSubmit({
        ...referral,
        ...createdReferral,
        localPatient: referral.patient,
        backendId: createdReferral.id,
        referredBy: createdReferral.referredBy || currentUserName,
      })
      setPatientForReferral(null)
      setPatientError('')
    } catch {
      setPatientError('Unable to submit referral to the backend.')
    }
  }

  const handleUpdatePatient = async (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    try {
      const updatedPatient = await updatePatient(patientForEdit.id, formData)
      setPatients((currentPatients) =>
        currentPatients.map((patient) => (patient.id === updatedPatient.id ? updatedPatient : patient)),
      )
      onPatientUpdated?.(updatedPatient)
      setPatientForEdit(null)
      setPatientError('')
    } catch {
      setPatientError('Unable to update patient record.')
    }
  }

  const handleWalkInDistribution = async (patient) => {
    try {
      const createdRequest = await createPatientMedicineRequest({
        patientId: patient.id,
        notes: `Walk-in medicine request encoded by ${currentUserName}.`,
      })
      onMedicineRequestCreated?.(createdRequest)
      setPatientError('')
      setWalkInPatientName(patient.name)
    } catch {
      setPatientError('Unable to create walk-in medicine request.')
    }
  }

  const selectedReferral = selectedPatient ? latestReferrals.get(selectedPatient.id) : null

  return (
    <div className="bhc-patient-list-styled">
      <dialog ref={walkInDialog} className="bhc-walk-in-dialog" aria-labelledby="bhc-walk-in-title" onClose={() => setWalkInPatientName('')}>
        <header><h2 id="bhc-walk-in-title"><Check size={20} />Walk-in Request Added</h2><button type="button" aria-label="Close notification" onClick={() => walkInDialog.current.close()}><X size={18} /></button></header>
        <p><strong>{walkInPatientName}</strong> was added to the medicine request list as Walk In.</p>
        <footer><button type="button" onClick={() => walkInDialog.current.close()}>Close</button><button type="button" className="bhc-walk-in-go" onClick={() => { walkInDialog.current.close(); onOpenMedicineDistribution?.() }}><Pill size={15} />Go to Distribution Page</button></footer>
      </dialog>
      <section className="bhc-patient-page bhc-patient-split">
        <article className="bhc-patient-list-panel">
          <div className="bhc-list-topbar"><h1>Patient List</h1><button className="add-patient-button" type="button" onClick={() => { setRegistrationStep(1); setShowAddPatient(true) }}><UserPlus size={14} />Add Patient</button></div>
          <div className="bhc-list-tabs" aria-label="BHC patient categories">{[['all', 'All Patients'], ['current', 'Current'], ['new', 'New']].map(([key, label]) => <button type="button" key={key} aria-pressed={patientTab === key} disabled={key !== 'all' && !referralsLoaded} onClick={() => { setPatientTab(key); setPageIndex(0) }}>{label}<span>{key === 'all' ? patients.length : !referralsLoaded ? '—' : patients.filter((patient) => key === 'current' ? latestReferrals.has(patient.id) : !latestReferrals.has(patient.id)).length}</span></button>)}</div>
          {patientTab !== 'all' && <p className="bhc-list-tab-note">{patientTab === 'current' ? 'Patients with recorded referral history.' : 'Registered patients with no referral history.'}</p>}
          <BHCFilterToolbar placeholder="Search patients..." value={searchKeyword} active={Object.values(filters).some(Boolean)}
            onSearch={(value) => { setSearchKeyword(value); setPageIndex(0) }}>
            <label>Sex<select value={filters.gender} onChange={(event) => { setFilters((current) => ({ ...current, gender: event.target.value })); setPageIndex(0) }}><option value="">All</option><option>Male</option><option>Female</option></select></label><label>Barangay<select value={filters.barangay} onChange={(event) => { setFilters((current) => ({ ...current, barangay: event.target.value })); setPageIndex(0) }}><option value="">All barangays</option>{[...new Set(patients.map((patient) => patient.barangay).filter(Boolean))].sort().map((barangay) => <option key={barangay}>{barangay}</option>)}</select></label><button className="bhc-list-filter-button" type="button" onClick={() => { setFilters({ gender: '', barangay: '' }); setPageIndex(0) }}>Clear Filters</button>
          </BHCFilterToolbar>
          {referralError && <p className="patient-alert" role="alert">{referralError}</p>}
          {isLoadingPatients ? (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              Loading patients...
            </div>
          ) : patientError ? (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              {patientError}
            </div>
          ) : filteredPatients.length > 0 ? (
            <div className="bhc-patient-table-wrap">
              <table className="bhc-patient-table">
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Contact Info</th>
                    <th>Reason</th>
                    <th>Recorded Time &amp; Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePatients.map((patient) => (
                    <tr key={patient.id} className={selectedPatientId === patient.id ? 'is-selected' : ''} onClick={() => setSelectedPatientId(patient.id)}>
                      <td>
                        <button className="bhc-patient-identity" type="button" aria-label={`View details for ${patient.name}`} onClick={() => setSelectedPatientId(patient.id)}><span className="bhc-patient-initials" aria-hidden="true">{patient.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><strong>{patient.name}</strong></button>
                        <span>{patient.age} · {patient.gender}</span>
                      </td>
                      <td><strong>{patient.contactNumber}</strong><span>{patient.barangay}</span></td>
                      <td>{latestReferrals.get(patient.id)?.chiefComplaint || (referralError ? 'Unavailable' : 'No referral recorded')}</td>
                      <td>{latestReferrals.get(patient.id)?.date ? <><strong>{new Date(latestReferrals.get(patient.id).date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</strong><span>{new Date(latestReferrals.get(patient.id).date).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span></> : '—'}</td>
                      <td>
                        <div className="patient-row-actions" onClick={(event) => event.stopPropagation()}>

                          <button
                            className="refer-patient-button"
                            type="button"
                            onClick={() => {
                              setSelectedSpecialty('Pedia')
                              setReferralStep(1)
                              setPatientForReferral(patient)
                            }}
                          >
                            <Send size={13} />
                            Refer
                          </button>
                          <button
                            className="distribute-patient-button"
                            type="button"
                            onClick={() => handleWalkInDistribution(patient)}
                          >
                            <Pill size={13} />
                            Distribute
                          </button>
                          <button className="edit-patient-button" type="button" onClick={() => setPatientForEdit(patient)}>
                            <Edit size={13} />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              A patient not found!
            </div>
          )}
          <footer className="bhc-list-pagination"><button type="button" disabled={!currentPage} onClick={() => setPageIndex(currentPage - 1)}>← Previous</button><nav aria-label="BHC patient pages">{Array.from({ length: pageCount }, (_, index) => index).filter((index) => index === 0 || index === pageCount - 1 || Math.abs(index - currentPage) <= 1).map((index, position, pages) => <span key={index}>{position > 0 && index - pages[position - 1] > 1 && <span aria-hidden="true">…</span>}<button type="button" aria-label={`Page ${index + 1}`} aria-current={index === currentPage ? 'page' : undefined} onClick={() => setPageIndex(index)}>{index + 1}</button></span>)}</nav><button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPageIndex(currentPage + 1)}>Next →</button></footer>
        </article>
        {selectedPatient && <dialog ref={patientDetailsDialog} className="bhc-list-details bhc-patient-details-dialog" aria-labelledby="patient-details-title" onCancel={() => setSelectedPatientId(null)}><header><h2 id="patient-details-title">Patient Details</h2><button type="button" autoFocus aria-label="Close patient details" onClick={() => setSelectedPatientId(null)}><X size={18} /></button></header>
          <div className="bhc-list-detail-identity"><span className="bhc-patient-initials" aria-hidden="true">{selectedPatient.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><h3>{selectedPatient.name}</h3><p>{selectedPatient.age} · {selectedPatient.gender}</p></div></div>
          <h3>Latest Referral</h3><dl>{[['Reason', selectedReferral?.chiefComplaint], ['Assigned Doctor', selectedReferral?.assignedDoctor], ['Status', selectedReferral?.status], ['Recorded Date', selectedReferral?.date ? new Date(selectedReferral.date).toLocaleString('en-PH') : null]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || (referralError ? 'Unavailable' : 'No referral recorded')}</dd></div>)}</dl>
          <h3>Patient Information</h3><dl>{[['Contact Number', selectedPatient.contactNumber], ['Username', selectedPatient.username], ['Birth Date', selectedPatient.birthDate], ['Civil Status', selectedPatient.civilStatus], ['Barangay', selectedPatient.barangay], ['Municipality', selectedPatient.municipality], ['PhilHealth Status', selectedPatient.philHealthStatus], ['PhilHealth ID', selectedPatient.philHealthId]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl>
          <h3>Medicines Received</h3>{selectedPatient.medicineDistributions?.length ? selectedPatient.medicineDistributions.map((item) => <article key={item.id}><strong>{item.medicineName}</strong><p>{item.quantity} issued · {item.distributedAt}</p><p>{item.instructions}</p></article>) : <p>No medicine distribution recorded.</p>}
        </dialog>}
      </section>

      {showAddPatient && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal bhc-add-patient-modal" role="dialog" aria-modal="true" aria-label="Add new patient form">
            <header>
              <div><span className="bhc-form-eyebrow">Patient Registration</span><h2>Add New Patient</h2><p>Enter the patient’s details. Fields marked * are required.</p></div>
              <button type="button" aria-label="Close add patient form" onClick={() => setShowAddPatient(false)}>
                <X size={18} />
              </button>
            </header>

            <PatientMembershipProvider>
            <form ref={registrationForm} className="patient-form" noValidate onKeyDown={(event) => {
              if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') event.preventDefault()
            }} onSubmit={(event) => {
              event.preventDefault()
              if (registrationStep === 1) { nextRegistrationStep(event.currentTarget); return }
              if (event.nativeEvent.submitter?.name !== 'savePatient') return
              if (event.currentTarget.reportValidity()) handleAddPatient(event)
            }}>
              <ol className="bhc-registration-progress" aria-label="Registration steps"><li aria-current={registrationStep === 1 ? 'step' : undefined}><span>1</span>Personal Information</li><li aria-current={registrationStep === 2 ? 'step' : undefined}><span>2</span>PhilHealth Information</li></ol>
              <section className="bhc-registration-step" data-registration-step="1" hidden={registrationStep !== 1}>
              <div className="patient-registration-heading"><h3 className="bhc-form-section-title">Personal Information</h3><PatientIdScanner formRef={registrationForm} /></div>
              <label>
                <span>First Name *</span>
                <input name="firstName" type="text" required />
              </label>
              <label>
                <span>Middle Name</span>
                <input name="middleName" type="text" />
              </label>
              <label>
                <span>Last Name *</span>
                <input name="lastName" type="text" required />
              </label>
              <label>
                <span>Contact Number *</span>
                <input name="contactNumber" maxLength={11} inputMode="numeric" pattern="[0-9]{1,11}" title="Enter up to 11 digits only" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 11) }} type="tel" required />
              </label>
              <label>
                <span>Birth Date *</span>
                <div className="birth-date-fields">
                  <select name="birthMonth" defaultValue="" aria-label="Birth month" required>
                    <option value="" disabled>Month</option>
                    {birthMonthOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input name="birthDay" type="number" min="1" max="31" placeholder="Day" aria-label="Birth day" required />
                  <input name="birthYear" type="number" min="1900" max="2100" placeholder="Year" aria-label="Birth year" required />
                </div>
              </label>
              <fieldset>
                <legend>Sex *</legend>
                <label><input name="sex" type="radio" value="Male" required /> Male</label>
                <label><input name="sex" type="radio" value="Female" /> Female</label>
              </fieldset>
              <label>
                <span>Civil Status</span>
                <select name="civilStatus" defaultValue="Single">
                  <option>Single</option>
                  <option>Married</option>
                  <option>Widowed</option>
                </select>
              </label>
              </section>
              <section className="bhc-registration-step" data-registration-step="2" hidden={registrationStep !== 2}>
                <h3 className="bhc-form-section-title">PhilHealth Information</h3>
                <PatientMembershipFields />
                <DependentInformationFields />
              </section>
              <div className="patient-form-actions">
                {registrationStep === 2 && <button type="button" onClick={() => setRegistrationStep(1)}><ArrowLeft size={15} />Back</button>}
                {registrationStep === 1 ? <button key="registration-next" className="bhc-registration-next" type="button" onClick={(event) => { event.preventDefault(); nextRegistrationStep(event.currentTarget.form) }}>Next</button> : <button key="registration-save" name="savePatient" type="submit"><Check size={15} />Save Patient</button>}
              </div>
            </form>
            </PatientMembershipProvider>
          </section>
        </div>
      )}

      {patientAccount && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal" aria-label="Patient account details">
            <header>
              <h2>{patientAccount.wasExistingRecord ? 'Existing Patient Record' : 'Patient Account Created'}</h2>
              <button type="button" aria-label="Close patient account details" onClick={() => setPatientAccount(null)}>
                <X size={18} />
              </button>
            </header>

            <div className="patient-account-details">
              <div>
                <span>Patient</span>
                <strong>{patientAccount.name}</strong>
              </div>
              <div>
                <span>Username</span>
                <strong>{patientAccount.username}</strong>
              </div>
              <div>
                <span>Password</span>
                <strong>{patientAccount.generatedPassword || 'Existing account password was not changed'}</strong>
              </div>
              <div>
                <span>Barangay</span>
                <strong>{patientAccount.barangay}</strong>
              </div>
              <div className="full">
                <span>Record Status</span>
                <p>
                  {patientAccount.wasExistingRecord
                    ? 'A matching patient already exists, so the existing record was reused.'
                    : 'A unique patient login was generated. Keep this password secure; it is shown only after creation.'}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {patientForEdit && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal bhc-edit-patient-modal" role="dialog" aria-modal="true" aria-label="Edit patient form">
            <header>
              <h2>Edit Patient</h2>
              <button type="button" aria-label="Close edit patient form" onClick={() => setPatientForEdit(null)}>
                <X size={18} />
              </button>
            </header>

            <div className="patient-account-details">
              <div>
                <span>Patient</span>
                <strong>{patientForEdit.name}</strong>
              </div>
              <div>
                <span>Username</span>
                <strong>{patientForEdit.username}</strong>
              </div>
              <div>
                <span>Password</span>
                <strong>Original password cannot be viewed again</strong>
              </div>
              <div>
                <span>Barangay</span>
                <strong>{patientForEdit.barangay}</strong>
              </div>
            </div>

            <PatientMembershipProvider key={patientForEdit.id} patient={patientForEdit}>
            <form className="patient-form patient-edit-form" onSubmit={handleUpdatePatient}>
              <PatientMembershipFields />
              <label>
                <span>Contact Number</span>
                <input
                  name="contactNumber" maxLength={11} inputMode="numeric" pattern="[0-9]{1,11}" title="Enter up to 11 digits only" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 11) }}
                  type="tel"
                  defaultValue={patientForEdit.contactNumber === 'No contact number' ? '' : patientForEdit.contactNumber}
                  required
                />
              </label>
              <label>
                <span>Birth Date</span>
                <div className="birth-date-fields">
                  <select
                    name="birthMonth"
                    defaultValue={getBirthDatePart(patientForEdit.dateOfBirth, 1)}
                    aria-label="Birth month"
                    required
                  >
                    <option value="" disabled>Month</option>
                    {birthMonthOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input
                    name="birthDay"
                    type="number"
                    min="1"
                    max="31"
                    defaultValue={getBirthDatePart(patientForEdit.dateOfBirth, 2)}
                    placeholder="Day"
                    aria-label="Birth day"
                    required
                  />
                  <input
                    name="birthYear"
                    type="number"
                    min="1900"
                    max="2100"
                    defaultValue={getBirthDatePart(patientForEdit.dateOfBirth, 0)}
                    placeholder="Year"
                    aria-label="Birth year"
                    required
                  />
                </div>
              </label>
              <fieldset>
                <legend>Sex</legend>
                <label>
                  <input name="sex" type="radio" value="Male" defaultChecked={patientForEdit.gender === 'Male'} required />
                  Male
                </label>
                <label>
                  <input name="sex" type="radio" value="Female" defaultChecked={patientForEdit.gender === 'Female'} />
                  Female
                </label>
              </fieldset>
              <label>
                <span>Civil Status</span>
                <select name="civilStatus" defaultValue={patientForEdit.civilStatus === 'Not set' ? 'Single' : patientForEdit.civilStatus}>
                  <option>Single</option>
                  <option>Married</option>
                  <option>Widowed</option>
                </select>
              </label>
              <DependentInformationFields />
              <div className="patient-form-actions">
                <button type="button" onClick={() => setPatientForEdit(null)}>
                  <ArrowLeft size={15} />
                  Back
                </button>
                <button type="submit">
                  <Check size={15} />
                  Save Changes
                </button>
              </div>
            </form>
            </PatientMembershipProvider>
          </section>
        </div>
      )}

      {patientForReferral && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal referral-modal bhc-medical-referral" aria-label="Referral form">
            <header>
              <div>
                <span className="bhc-referral-eyebrow">Barangay Health Center · Lucena City</span>
                <h2>Medical Referral Form</h2>
                <p>Patient endorsement to the City Health Office</p>
              </div>
              <button type="button" aria-label="Close referral form" onClick={() => setPatientForReferral(null)}>
                <X size={18} />
              </button>
            </header>

            <form className="patient-form referral-form clinical-referral-form" onSubmit={handleSubmitReferral}>
              <ol className="referral-steps" aria-label="Referral progress">
                {['Patient & Referral Details', 'Vital Signs & Endorsement'].map((label, index) => (
                  <li key={label} aria-current={referralStep === index + 1 ? 'step' : undefined}>
                    <span>{index + 1}</span>{label}
                  </li>
                ))}
              </ol>
              <div className="referral-step-panel" hidden={referralStep !== 1}>
              <div className="referral-form-summary">
                <FileText size={18} />
                <div>
                  <strong>{patientForReferral.name}</strong>
                  <span>{patientForReferral.gender} | {patientForReferral.age} | {patientForReferral.barangay}</span>
                </div>
              </div>
              <section className="bhc-referral-patient-info" aria-label="Patient particulars"><h3>Patient Particulars</h3><dl>{[['Patient Name', patientForReferral.name], ['Age / Sex', `${patientForReferral.age} / ${patientForReferral.gender}`], ['Birth Date', patientForReferral.birthDate], ['Contact Number', patientForReferral.contactNumber], ['Address', [patientForReferral.barangay, patientForReferral.municipality].filter(Boolean).join(', ')], ['PhilHealth ID', patientForReferral.philHealthId || 'Not provided']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl></section>

              <section className="clinical-form-section referral-purpose-section">
                <h3>Referral for</h3>
                <fieldset className="specialty-choice-group">
                  <legend>Specialty</legend>
                  {referralSpecialties.map((specialty) => (
                    <label key={specialty}>
                      <input
                        name="specialty"
                        type="radio"
                        value={specialty}
                        checked={selectedSpecialty === specialty}
                        onChange={(event) => setSelectedSpecialty(event.target.value)}
                      />
                      {specialty === 'Other' ? 'Other (Pls. Indicate)' : specialty}
                    </label>
                  ))}
                </fieldset>
                {selectedSpecialty === 'Other' && (
                  <label className="clinical-inline-field">
                    <span>Other Specialty</span>
                    <input name="otherSpecialty" type="text" placeholder="Indicate specialty" />
                  </label>
                )}
              </section>

              <section className="clinical-form-section referral-location-section">
                <h3>Complaint & GIS Location</h3>
                <label className="chief-complaint-select">
                  <span>Chief Complaint/s</span>
                  <SearchableReferralSelect key={`complaints-${patientForReferral.id}-${selectedSpecialty}`} name="chiefComplaint" label="Chief Complaints" placeholder="Search chief complaints..." required defaultValue={chiefComplaintOptions[0] || ''} items={chiefComplaintOptions.map((complaint) => ({ value: complaint, label: complaint }))} />
                </label>
                <label className="clinical-inline-field">
                  <span>Purok for GIS</span>
                  <SearchableReferralSelect key={`purok-${patientForReferral.id}`} name="purokFid" label="Purok for GIS" placeholder={isLoadingPuroks ? 'Loading puroks...' : 'Search purok...'} disabled={isLoadingPuroks} items={puroks.map((purok) => ({ value: String(purok.fid), label: purok.purok_name }))} />
                </label>
              </section>

              </div>
              <div className="referral-step-panel" hidden={referralStep !== 2}>
              <section className="clinical-form-section referral-vitals-section">
                <h3>Vital Signs</h3>
                <div className="vital-signs-grid"><label><span>BP (mmHg)</span><input name="bp" type="text" placeholder="120/80" pattern="[0-9]{2,3}/[0-9]{2,3}" title="Use systolic/diastolic, for example 120/80" /></label><label><span>RR (breaths/min)</span><input name="respirationRate" type="number" placeholder="16" min="0" step="any" /></label><label><span>CR (bpm)</span><input name="cardiacRate" type="number" placeholder="72" min="0" step="any" /></label><label><span>Oxygen (%)</span><input name="o2sat" type="number" placeholder="98" min="0" step="any" max="100" /></label><label><span>Temp (&deg;C)</span><input name="temperature" type="number" placeholder="37" min="0" step="any" /></label><label><span>Weight (kg)</span><input name="weight" type="number" placeholder="60" min="0" step="any" /></label><label><span>Height (cm)</span><input name="height" type="number" placeholder="160" min="0" step="any" /></label></div>
              </section>

              <section className="clinical-form-section referral-profile-section">
                <h3>eKonsult / BHS Profile</h3>
                <div className="clinical-radio-row">
                  <fieldset>
                    <legend>First encounter to eKonsult?</legend>
                    <label><input name="ekonsultEncounter" type="radio" value="Yes" /> Yes</label>
                    <label><input name="ekonsultEncounter" type="radio" value="No" defaultChecked /> No</label>
                  </fieldset>
                  <label>
                    <span>Number of Visit</span>
                    <input name="visitNumber" type="number" min="1" placeholder="if no" />
                  </label>
                  <fieldset>
                    <legend>Profiled at BHS?</legend>
                    <label><input name="profiledAtBhs" type="radio" value="Yes" /> Yes</label>
                    <label><input name="profiledAtBhs" type="radio" value="No" defaultChecked /> No</label>
                  </fieldset>
                </div>
              </section>

              <section className="clinical-form-section referred-by-section">
                <label className="clinical-line-field">
                  <span>Referred by</span>
                  <input name="referredBy" type="text" value={currentUserName} readOnly required />
                </label>
              </section>

              <div className="patient-form-actions">
                <button type="button" onClick={() => setReferralStep(1)}>
                  <ArrowLeft size={15} />
                  Back
                </button>
                <button type="submit">
                  <Send size={15} />
                  Submit Referral
                </button>
              </div>
              </div>
              {referralStep === 1 && (
                <div className="patient-form-actions">
                  <button type="submit">Next</button>
                </div>
              )}
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default BHCPatientList
