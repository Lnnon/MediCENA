import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  Filter,
  Pill,
  Save,
  Search,
  Stethoscope,
} from 'lucide-react'
import './DocConsultationLayout.css'
import SearchableReferralSelect from '../shared/SearchableReferralSelect'

const consultationCategories = [
  { value: '', label: 'All Consultations', Icon: FileText },
  { value: 'pending', label: 'Pending', Icon: Clock },
  { value: 'completed', label: 'Completed', Icon: ClipboardCheck },
]

const emptyConsultationForm = {
  subjective: '',
  objective: '',
  diagnosis: '',
  plan: '',
  medicine: '',
  dosage: '',
  duration: '',
  disposition: 'Managed at CHO',
}

const getConsultationStatus = (consultation) => (consultation.status === 'completed' ? 'completed' : 'pending')

const getConsultationStatusLabel = (consultation) =>
  getConsultationStatus(consultation) === 'completed' ? 'Completed' : 'Pending'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'Not set')

function DocConsultationPage({ consultations = [], initialReferral = null, clearInitialReferral, onCompleteConsultation }) {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    barangay: '',
    date: '',
  })
  const [filterResetKey, setFilterResetKey] = useState(0)
  const barangayOptions = useMemo(() => [
    { value: '', label: 'All Barangays' },
    ...[...new Set(consultations.map((consultation) => consultation.barangay?.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((barangay) => ({ value: barangay, label: barangay })),
  ], [consultations])
  const [viewedReferral, setViewedReferral] = useState(null)
  const [consultingPatient, setConsultingPatient] = useState(initialReferral)
  useEffect(() => {
    if (initialReferral) clearInitialReferral(null)
  }, [initialReferral, clearInitialReferral])
  const [formData, setFormData] = useState(emptyConsultationForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const filteredConsultations = useMemo(() => {
    return consultations.filter((consultation) => {
      const searchText = filters.search.toLowerCase()
      const consultationDate = consultation.consultationRecord?.consultedAt || consultation.date || ''
      return (
        (!searchText || consultation.patient.toLowerCase().includes(searchText)) &&
        (!filters.status || getConsultationStatus(consultation) === filters.status) &&
        (!filters.barangay || consultation.barangay?.trim() === filters.barangay) &&
        (!filters.date || consultationDate.slice(0, 10) === filters.date)
      )
    })
  }, [consultations, filters])

  const updateField = (field, value) => {
    setFormData((currentData) => ({ ...currentData, [field]: value }))
  }

  const updateFilter = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  const openConsultationForm = (consultation) => {
    setConsultingPatient(consultation)
    setFormData(consultation.consultationRecord ? { ...emptyConsultationForm, diagnosis: consultation.consultationRecord.diagnosis, plan: consultation.consultationRecord.treatmentPlan, disposition: '' } : emptyConsultationForm)
    setSaveError('')
  }

  const handleComplete = async () => {
    if (!consultingPatient) return
    setSaving(true)
    try { await onCompleteConsultation(consultingPatient, formData); setConsultingPatient(null) }
    catch { setSaveError('Unable to save consultation. Your entered details are retained; please retry.') }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="doc-page-heading">
        <div>
          <span>Consultation</span>
          <h1>Consultation List</h1>
          <p>Accepted referrals appear here for review and consultation.</p>
        </div>
      </div>

      <div className="doc-consultation-status-cards" role="group" aria-label="Filter consultations by status">
        {consultationCategories.map(({ value, label, Icon }) => (
          <button key={value} type="button" data-status={value || 'all'} aria-pressed={filters.status === value} onClick={() => updateFilter('status', value)}>
            <span className="doc-consultation-stat-icon"><Icon size={20} /></span>
            <span className="doc-consultation-stat-label">{label}</span>
            <strong>{value ? consultations.filter((consultation) => getConsultationStatus(consultation) === value).length : consultations.length}</strong>
          </button>
        ))}
      </div>

      {consultations.length === 0 ? (
        <article className="doc-referral-empty">
          <AlertTriangle size={18} />
          <div>
            <h2>No accepted referrals</h2>
            <p>Accept an assigned referral first to start a consultation.</p>
          </div>
        </article>
      ) : (
        <section className="doc-consultation-page doc-consultation-organized">
          <section className="doc-consultation-filters doc-page-filter-row" aria-label="Filter consultations">
              <label>
                <span>Search by name</span>
                <div>
                  <Search size={15} />
                  <input
                    type="search"
                    placeholder="Patient name"
                    value={filters.search}
                    onChange={(event) => updateFilter('search', event.target.value)}
                  />
                </div>
              </label>
              <label>
                <span>Barangay</span>
                <SearchableReferralSelect key={filterResetKey} name="barangayFilter" label="Barangay" placeholder="Type to search barangays..." items={barangayOptions} menuClassName="doc-barangay-options" onValueChange={(value) => updateFilter('barangay', value)} />
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
                onClick={() => { setFilters({ search: '', status: '', barangay: '', date: '' }); setFilterResetKey((key) => key + 1) }}
              >
                <Filter size={15} />
                Reset Filters
              </button>
            </section>

          <div className="doc-consultation-workspace">
            <article className="doc-consultation-panel doc-consultation-wide">
              <div className="doc-panel-heading">
                <div>
                  <span>Accepted Referrals</span>
                  <h2>Consultation Queue</h2>
                  <p className="doc-consultation-filter-summary" role="status">{filteredConsultations.length} consultation{filteredConsultations.length === 1 ? '' : 's'} · {filters.barangay || 'All Barangays'} · {filters.status ? filters.status === 'completed' ? 'Completed' : 'Pending' : 'All statuses'}</p>
                </div>
                <ClipboardCheck size={18} />
              </div>

              <div className="doc-consultation-table">
                {filteredConsultations.length > 0 ? filteredConsultations.map((consultation) => (
                  <div className="doc-consultation-row" key={consultation.id}>
                    <div>
                      <strong>{consultation.patient}</strong>
                      <span>{consultation.specialty} | {consultation.barangay}</span>
                      <time>{formatDate(consultation.date)}</time>
                    </div>
                    <span className={`doc-consultation-status ${getConsultationStatus(consultation)}`}>
                      {getConsultationStatusLabel(consultation)}
                    </span>
                    <div className="doc-consultation-row-actions">
                      <button type="button" className="primary-action-button" onClick={() => setViewedReferral(consultation)}>
                        <Eye size={14} />
                        View
                      </button>
                      <button
                        type="button"
                        className="success-action-button"
                        onClick={() => openConsultationForm(consultation)}
                      >
                        <Stethoscope size={14} />
                        {consultation.status === 'completed' ? 'Edit consultation' : 'Consult'}
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="doc-consultation-empty-list">
                    No consultation records match the filters.
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>
      )}

      {viewedReferral && (
        <div className="patient-modal-backdrop" role="presentation">
          <article className="patient-modal doc-referral-modal" role="dialog" aria-modal="true" aria-label="Referral details">
            <header>
              <h2>Referral Details</h2>
              <button type="button" aria-label="Close referral details" onClick={() => setViewedReferral(null)}>x</button>
            </header>
            <dl className="doc-referral-form-view">
              <div>
                <dt>Patient</dt>
                <dd>{viewedReferral.patient}</dd>
              </div>
              <div>
                <dt>Referral Code</dt>
                <dd>{viewedReferral.code}</dd>
              </div>
              <div>
                <dt>Age / Sex</dt>
                <dd>{viewedReferral.age} years old / {viewedReferral.sex}</dd>
              </div>
              <div>
                <dt>Barangay</dt>
                <dd>{viewedReferral.barangay}</dd>
              </div>
              <div>
                <dt>Referred From</dt>
                <dd>{viewedReferral.referredFrom}</dd>
              </div>
              <div>
                <dt>Specialty</dt>
                <dd>{viewedReferral.specialty}</dd>
              </div>
              <div className="wide">
                <dt>Chief Complaint</dt>
                <dd>{viewedReferral.chiefComplaint || 'For assessment'}</dd>
              </div>
              <div>
                <dt>Blood Pressure</dt>
                <dd>{viewedReferral.bp}</dd>
              </div>
              <div>
                <dt>Temperature</dt>
                <dd>{viewedReferral.temperature}</dd>
              </div>
              <div>
                <dt>O2 Saturation</dt>
                <dd>{viewedReferral.o2sat}</dd>
              </div>
              <div>
                <dt>Heart Rate</dt>
                <dd>{viewedReferral.cardiacRate}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{getConsultationStatusLabel(viewedReferral)}</dd>
              </div>
            </dl>
          </article>
        </div>
      )}

      {consultingPatient && (
        <div className="patient-modal-backdrop" role="presentation">
          <article className="patient-modal doc-consultation-modal" role="dialog" aria-modal="true" aria-label="Consultation form">
            <header>
              <h2>Consultation Form</h2>
              <button type="button" aria-label="Close consultation form" onClick={() => setConsultingPatient(null)}>x</button>
            </header>

            <div className="doc-consultation-summary">
              <div>
                <span>Consulting Patient</span>
                <h2>{consultingPatient.patient}</h2>
                <p>{consultingPatient.age} years old from {consultingPatient.barangay}</p>
              </div>
              <strong>{consultingPatient.code}</strong>
            </div>

            <section className="doc-consultation-grid doc-consultation-modal-grid">
              <article className="doc-consultation-panel">
                <div className="doc-panel-heading">
                  <div>
                    <span>Referral</span>
                    <h2>Referral Details</h2>
                  </div>
                  <FileText size={18} />
                </div>
                <dl className="doc-consultation-details">
                  <div>
                    <dt>Referred From</dt>
                    <dd>{consultingPatient.referredFrom}</dd>
                  </div>
                  <div>
                    <dt>Specialty</dt>
                    <dd>{consultingPatient.specialty}</dd>
                  </div>
                  <div>
                    <dt>Chief Complaint</dt>
                    <dd>{consultingPatient.chiefComplaint || 'For assessment'}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{getConsultationStatusLabel(consultingPatient)}</dd>
                  </div>
                </dl>
              </article>

              <article className="doc-consultation-panel">
                <div className="doc-panel-heading">
                  <div>
                    <span>Vitals</span>
                    <h2>Referral Vitals</h2>
                  </div>
                  <Stethoscope size={18} />
                </div>
                <div className="doc-vitals-grid">
                  <label><span>BP</span><input type="text" value={consultingPatient.bp || ''} readOnly /></label>
                  <label><span>Temp</span><input type="text" value={consultingPatient.temperature || ''} readOnly /></label>
                  <label><span>O2Sat</span><input type="text" value={consultingPatient.o2sat || ''} readOnly /></label>
                  <label><span>Heart Rate</span><input type="text" value={consultingPatient.cardiacRate || ''} readOnly /></label>
                </div>
              </article>

              <article className="doc-consultation-panel doc-consultation-wide">
                <div className="doc-panel-heading">
                  <div>
                    <span>Clinical Notes</span>
                    <h2>Consultation Record</h2>
                  </div>
                  <ClipboardCheck size={18} />
                </div>
                <div className="doc-consultation-form">
                  <label>
                    <span>Subjective / History</span>
                    <textarea rows="4" placeholder="Patient history, symptoms, duration, relevant background" value={formData.subjective} onChange={(event) => updateField('subjective', event.target.value)} />
                  </label>
                  <label>
                    <span>Objective Findings</span>
                    <textarea rows="4" placeholder="Physical exam findings and observations" value={formData.objective} onChange={(event) => updateField('objective', event.target.value)} />
                  </label>
                  <label>
                    <span>Assessment / Diagnosis</span>
                    <textarea rows="4" placeholder="Working diagnosis or clinical impression" value={formData.diagnosis} onChange={(event) => updateField('diagnosis', event.target.value)} />
                  </label>
                  <label>
                    <span>Plan / Orders</span>
                    <textarea rows="4" placeholder="Labs, imaging, referral instructions, follow-up plan" value={formData.plan} onChange={(event) => updateField('plan', event.target.value)} />
                  </label>
                </div>
              </article>

              <article className="doc-consultation-panel">
                <div className="doc-panel-heading">
                  <div>
                    <span>Medication</span>
                    <h2>Prescription</h2>
                  </div>
                  <Pill size={18} />
                </div>
                <div className="doc-prescription-fields">
                  <label><span>Medicine</span><input type="text" placeholder="Medicine name" value={formData.medicine} onChange={(event) => updateField('medicine', event.target.value)} /></label>
                  <label><span>Dosage</span><input type="text" placeholder="Dose and frequency" value={formData.dosage} onChange={(event) => updateField('dosage', event.target.value)} /></label>
                  <label><span>Duration</span><input type="text" placeholder="No. of days" value={formData.duration} onChange={(event) => updateField('duration', event.target.value)} /></label>
                </div>
              </article>

              <article className="doc-consultation-panel">
                <div className="doc-panel-heading">
                  <div>
                    <span>Disposition</span>
                    <h2>Outcome</h2>
                  </div>
                  <Save size={18} />
                </div>
                <div className="doc-disposition-options">
                  {['Managed at CHO', 'For follow-up', 'Refer to higher facility'].map((option) => (
                    <label key={option}>
                      <input
                        name="disposition"
                        type="radio"
                        checked={formData.disposition === option}
                        onChange={() => updateField('disposition', option)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </article>
            </section>
            <footer className="doc-consultation-actions">
                  {saveError && <p role="alert">{saveError}</p>}
                  <button className="secondary-action-button" type="button" onClick={() => setConsultingPatient(null)}>Cancel</button>
                  <button className="primary-action-button" type="button" disabled={saving} onClick={handleComplete}>{saving ? 'Saving…' : consultingPatient.consultationRecord ? 'Save consultation changes' : 'Complete Consultation'}</button>
                </footer>
          </article>
        </div>
      )}
    </>
  )
}

export default DocConsultationPage
