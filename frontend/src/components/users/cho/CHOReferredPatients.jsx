import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Eye, Filter, Search, Stethoscope, X } from 'lucide-react'
import { fetchReferrals } from '../../../services/referrals'

function CHOReferredPatients({ referrals: providedReferrals = null }) {
  const [fetchedPatients, setReferredPatients] = useState([])
  const referredPatients = providedReferrals || fetchedPatients
  const [isLoading, setIsLoading] = useState(true)
  const [referralError, setReferralError] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    barangay: '',
    doctor: '',
    specialty: '',
    date: '',
  })
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedNotes, setSelectedNotes] = useState(null)

  useEffect(() => {
    if (providedReferrals) return undefined

    let isMounted = true

    const loadReferrals = async () => {
      try {
        const backendReferrals = await fetchReferrals()
        if (isMounted) {
          setReferredPatients(
            backendReferrals.filter((referral) => referral.status !== 'pending' || referral.assignedDoctor !== 'Unassigned'),
          )
          setReferralError('')
        }
      } catch {
        if (isMounted) {
          setReferralError('Unable to load referred patients from the backend.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadReferrals()
    const intervalId = window.setInterval(loadReferrals, 5000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [providedReferrals])

  const barangays = [...new Set(referredPatients.map((patient) => patient.barangay))]
  const doctors = [...new Set(referredPatients.map((patient) => patient.assignedDoctor))]
  const specialties = [...new Set(referredPatients.map((patient) => patient.specialty))]

  const filteredPatients = useMemo(() => {
    return referredPatients.filter((patient) => {
      const searchText = filters.search.toLowerCase()
      const matchesSearch =
        patient.patient.toLowerCase().includes(searchText) ||
        patient.code.toLowerCase().includes(searchText) ||
        patient.referredFrom.toLowerCase().includes(searchText)

      return (
        matchesSearch &&
        (!filters.barangay || patient.barangay === filters.barangay) &&
        (!filters.doctor || patient.assignedDoctor === filters.doctor) &&
        (!filters.specialty || patient.specialty === filters.specialty) &&
        (!filters.date || patient.date?.slice(0, 10) === filters.date)
      )
    })
  }, [filters, referredPatients])

  const updateFilter = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  return (
    <>
      <div className="cho-page-heading">
        <div>
          <span>Referral</span>
          <h1>Referred Patients</h1>
          <p>Patients already referred and assigned for CHO coordination.</p>
        </div>
      </div>

      <section className="cho-incoming-page cho-referred-page">
        <aside className="cho-filter-panel cho-incoming-sidebar">
          <h2>Filter Referred</h2>
          <label>
            <span>Search</span>
            <div>
              <Search size={15} />
              <input
                type="search"
                placeholder="Search patient or code"
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </div>
          </label>
          <label>
            <span>Barangay</span>
            <select value={filters.barangay} onChange={(event) => updateFilter('barangay', event.target.value)}>
              <option value="">All Barangay</option>
              {barangays.map((barangay) => (
                <option key={barangay}>{barangay}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Assigned Doctor</span>
            <select value={filters.doctor} onChange={(event) => updateFilter('doctor', event.target.value)}>
              <option value="">All Doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor}>{doctor}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Specialty</span>
            <select value={filters.specialty} onChange={(event) => updateFilter('specialty', event.target.value)}>
              <option value="">All Specialties</option>
              {specialties.map((specialty) => (
                <option key={specialty}>{specialty}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <div>
              <CalendarDays size={15} />
              <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
            </div>
          </label>
          <button
            className="filter-button"
            type="button"
            onClick={() => setFilters({ search: '', barangay: '', doctor: '', specialty: '', date: '' })}
          >
            <Filter size={15} />
            Reset
          </button>
        </aside>

        <div className="cho-referred-list">
          {isLoading && !providedReferrals ? (
            <article className="bhc-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>Loading referred patients</h2>
                <p>Fetching referral records from the backend.</p>
              </div>
            </article>
          ) : referralError ? (
            <article className="bhc-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>Unable to load referred patients</h2>
                <p>{referralError}</p>
              </div>
            </article>
          ) : filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => (
              <article className="cho-referred-card" key={patient.id}>
                <header>
                  <div>
                    <h2>{patient.patient}</h2>
                    <p>{patient.age} years old from {patient.barangay}</p>
                    <span>{patient.code}</span>
                  </div>
                  <strong>{patient.status}</strong>
                </header>

                <div className="cho-referred-details">
                  <div>
                    <span>Referred From</span>
                    <strong>{patient.referredFrom}</strong>
                  </div>
                  <div>
                    <span>Assigned Doctor</span>
                    <strong>{patient.assignedDoctor}</strong>
                  </div>
                  <div>
                    <span>Specialty</span>
                    <strong>{patient.specialty}</strong>
                  </div>
                  <div>
                    <span>Date</span>
                    <strong>{new Date(patient.date).toLocaleDateString()}</strong>
                  </div>
                </div>

                <div className="incoming-card-actions">
                  <button className="primary-action-button" type="button" onClick={() => setSelectedPatient(patient)}>
                    <Eye size={14} />
                    View Patient
                  </button>
                  <button className="view-all-button" type="button" onClick={() => setSelectedNotes(patient)}>
                    <Stethoscope size={14} />
                    Doctor Notes
                  </button>
                </div>
              </article>
            ))
          ) : (
            <article className="bhc-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>No referred patients found</h2>
                <p>Adjust the filters to view referred patient records.</p>
              </div>
            </article>
          )}
        </div>
      </section>

      {selectedPatient && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal cho-referral-form-modal" aria-label="Referred patient details">
            <header>
              <h2>Patient Referral Details</h2>
              <button type="button" aria-label="Close patient details" onClick={() => setSelectedPatient(null)}>
                <X size={18} />
              </button>
            </header>

            <div className="cho-referral-form-view">
              <div>
                <span>Referral Code</span>
                <strong>{selectedPatient.code}</strong>
              </div>
              <div>
                <span>Patient</span>
                <strong>{selectedPatient.patient}</strong>
              </div>
              <div>
                <span>Age / Sex</span>
                <strong>{selectedPatient.age} years old / {selectedPatient.sex}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{selectedPatient.status}</strong>
              </div>
              <div>
                <span>Specialty</span>
                <strong>{selectedPatient.specialty}</strong>
              </div>
              <div>
                <span>Chief Complaint</span>
                <strong>{selectedPatient.chiefComplaint}</strong>
              </div>
              <div>
                <span>Referred From</span>
                <strong>{selectedPatient.referredFrom}</strong>
              </div>
              <div>
                <span>Assigned Doctor</span>
                <strong>{selectedPatient.assignedDoctor}</strong>
              </div>
              <div className="full">
                <span>Vitals</span>
                <p>
                  Weight {selectedPatient.weight}, Temp {selectedPatient.temperature}, BP {selectedPatient.bp},
                  O2 {selectedPatient.o2sat}, Height {selectedPatient.height}, RR {selectedPatient.respirationRate},
                  CR {selectedPatient.cardiacRate}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {selectedNotes && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal cho-referral-form-modal" aria-label="Doctor notes">
            <header>
              <h2>Doctor Notes</h2>
              <button type="button" aria-label="Close doctor notes" onClick={() => setSelectedNotes(null)}>
                <X size={18} />
              </button>
            </header>

            <div className="cho-referral-form-view">
              <div>
                <span>Assigned Doctor</span>
                <strong>{selectedNotes.assignedDoctor}</strong>
              </div>
              <div>
                <span>Diagnosis</span>
                <strong>{selectedNotes.otherDiagnosis || 'No diagnosis recorded yet'}</strong>
              </div>
              <div className="full">
                <span>Clinical Note</span>
                <p>
                  {selectedNotes.assignedDoctor === 'Unassigned'
                    ? 'No doctor has been assigned to this referral yet.'
                    : `${selectedNotes.assignedDoctor} is assigned for ${selectedNotes.specialty} review.`}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export default CHOReferredPatients
