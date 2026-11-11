import BHCFilterToolbar from './BHCFilterToolbar'
import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Eye, FileText, Filter, House, Phone, Printer, UserRound, Send, X, XCircle } from 'lucide-react'
import { updateReferral } from '../../../services/referrals'
import '../opd/OPDReferralSheet.css'

const steps = ['Referred', 'Seen', 'Assigned', 'Accepted', 'Arrived', 'Admitted', 'Completed']

const getCompletedStepIndex = (status) => {
  const normalizedStatus = status?.toLowerCase()

  if (normalizedStatus === 'completed') return 6
  if (normalizedStatus === 'admitted') return 5
  if (normalizedStatus === 'arrived') return 4
  if (normalizedStatus === 'assigned') return 3
  if (normalizedStatus === 'accepted') return 2
  if (normalizedStatus === 'seen') return 1

  return 0
}

const getReferralView = (referral) => {
  const localPatient = referral.patient && typeof referral.patient === 'object' ? referral.patient : null

  return {
    id: referral.code || referral.id,
    backendId: referral.backendId || referral.id,
    patientName: localPatient?.name || referral.patient || 'Patient',
    gender: localPatient?.gender || referral.sex || 'Not set',
    contact: localPatient?.contactNumber || referral.contactNumber || 'No contact number',
    age: localPatient?.age ?? referral.age ?? 'Age not set',
    barangay: localPatient?.barangay || referral.barangay || 'No barangay',
    municipality: localPatient?.municipality || 'Lucena City',
    destination: referral.destination || referral.referredTo || 'Lucena City Health Office',
    status: referral.status || 'pending',
    specialty: referral.specialty || 'General',
    referredBy: referral.referredBy || 'BHC Staff',
    chiefComplaint: referral.chiefComplaint || 'For assessment',
    date: referral.date || new Date().toISOString(),
    weight: referral.weight || 'Not set',
    temperature: referral.temperature || 'Not set',
    bp: referral.bp || 'Not set',
    o2sat: referral.o2sat || 'Not set',
    height: referral.height || 'Not set',
    respirationRate: referral.respirationRate || 'Not set',
    cardiacRate: referral.cardiacRate || 'Not set',
    ekonsultEncounter: referral.ekonsultEncounter || 'No',
    visitNumber: referral.visitNumber || 'Not indicated',
    profiledAtBhs: referral.profiledAtBhs || 'No',
  }
}

function BHCReferredPatients({ referrals, onReferralUpdated }) {
  const [filters, setFilters] = useState({ search: '', date: '', facility: '', status: '' })
  const [selectedReferral, setSelectedReferral] = useState(null)
  const [actionError, setActionError] = useState('')

  const referralViews = useMemo(() => referrals.map(getReferralView), [referrals])
  const facilities = [...new Set(referralViews.map((referral) => referral.destination))]
  const statuses = [...new Set(referralViews.map((referral) => referral.status))]

  const filteredReferrals = useMemo(() => {
    const searchText = filters.search.trim().toLowerCase()

    return referralViews.filter((referral) => {
      const matchesSearch =
        !searchText ||
        [referral.id, referral.patientName, referral.barangay, referral.destination, referral.specialty]
          .some((value) => String(value).toLowerCase().includes(searchText))
      const matchesDate = !filters.date || referral.date?.slice(0, 10) === filters.date

      return (
        matchesSearch &&
        matchesDate &&
        (!filters.facility || referral.destination === filters.facility) &&
        (!filters.status || referral.status === filters.status)
      )
    })
  }, [filters, referralViews])

  const updateFilter = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  const handleCancelReferral = async (referral) => {
    try {
      const updatedReferral = await updateReferral(referral.backendId, { status: 'cancelled' })
      onReferralUpdated?.(updatedReferral)
      setActionError('')
    } catch {
      setActionError('Unable to cancel referral in the backend.')
    }
  }

  const handlePrintReferral = (referral) => {
    setSelectedReferral(referral)
    window.setTimeout(() => window.print(), 50)
  }

  return (
    <>
      <div className="bhc-page-heading track-chart-heading">
        <div>
          <span>Referral</span>
          <h1>Referred Patients</h1>
          <p>Track outgoing referrals and their transfer progress.</p>
        </div>
      </div>

      <section className="bhc-referral-page bhc-outgoing-page">
        <BHCFilterToolbar placeholder="Code, Patient, Location" value={filters.search} onSearch={(value) => updateFilter('search', value)}
          active={filters.date || filters.facility || filters.status}>
          <label>
            <span>Date</span>
            <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
          </label>
          <label>
            <span>Facility</span>
            <select value={filters.facility} onChange={(event) => updateFilter('facility', event.target.value)}>
              <option value="">All Facility</option>
              {facilities.map((facility) => (
                <option key={facility}>{facility}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">All Transaction</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <button className="filter-button" type="button" onClick={() => setFilters({ search: '', date: '', facility: '', status: '' })}>
            <Filter size={15} />
            Reset Filter
          </button>
        </BHCFilterToolbar>

        <div className="bhc-referred-list">
          {actionError && (
            <article className="bhc-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>Referral action failed</h2>
                <p>{actionError}</p>
              </div>
            </article>
          )}
          {filteredReferrals.length > 0 ? (
            filteredReferrals.map((referralView) => {
              const completedStepIndex = getCompletedStepIndex(referralView.status)

              return (
              <article className="bhc-outgoing-row" key={referralView.id}>
                <details className="bhc-referral-disclosure">
                <summary aria-label={`Show referral information for ${referralView.patientName}`}>
                  <div className="track-chart-summary">
                    <div className="track-chart-avatar" aria-hidden="true"><UserRound size={30} /></div>
                    <div className="track-chart-identity">
                      <h2>{referralView.patientName}</h2>
                      <div className="track-chart-demographics">
                        <span><CalendarDays />{typeof referralView.age === 'number' ? referralView.age + ' years old' : referralView.age}</span>
                        <span><UserRound />{referralView.gender}</span>
                        <span><House />{referralView.barangay}, {referralView.municipality}</span>
                        <span><Phone />{referralView.contact}</span>
                      </div>
                    </div>
                    <div className="track-chart-reference"><FileText size={22} /><div><small>Referral Code</small><strong>{referralView.id}</strong></div></div>
                    <div className="track-chart-controls"><span>{referralView.status}</span><strong>Referral details</strong></div>
                  </div>
                </summary>

                <div className="referral-destination">
                  <Send size={15} />
                  {referralView.patientName} was referred to {referralView.destination}
                </div>

                <div className="referral-steps" aria-label="Referral progress">
                  {steps.map((step, stepIndex) => (
                    <div className={stepIndex <= completedStepIndex ? 'complete' : ''} key={step}>
                      <span>{stepIndex + 1}</span>
                      <small>{step}</small>
                    </div>
                  ))}
                </div>

                <div className="referral-log">
                  <time>{new Date(referralView.date).toLocaleString()}</time>
                  <p>
                    <strong>{referralView.specialty}</strong> referral submitted by {referralView.referredBy}.
                  </p>
                  <p>Complaint: {referralView.chiefComplaint}</p>
                  <p>
                    Vitals: Weight {referralView.weight}, Temp {referralView.temperature}, BP {referralView.bp},
                    O2 {referralView.o2sat}, Height {referralView.height}, RR {referralView.respirationRate},
                    CR {referralView.cardiacRate}
                  </p>
                  <p>
                    eKonsult first encounter: {referralView.ekonsultEncounter}; Visit No: {referralView.visitNumber};
                    Profiled at BHS: {referralView.profiledAtBhs}
                  </p>
                </div>

                <div className="referral-card-actions">
                  <button className="view-patient-button" type="button" onClick={() => setSelectedReferral(referralView)}>
                    <Eye size={14} />
                    View Patient
                  </button>
                  <button
                    className="secondary-action-button"
                    type="button"
                    disabled={referralView.status === 'cancelled'}
                    onClick={() => handleCancelReferral(referralView)}
                  >
                    <XCircle size={14} />
                    Cancel
                  </button>
                  <button className="warning-action-button" type="button" onClick={() => handlePrintReferral(referralView)}>
                    <Printer size={14} />
                    Print
                  </button>
                </div>
                            </details>
              </article>
              )
            })
          ) : (
            <article className="bhc-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>No referred patients yet</h2>
                <p>Submit a referral from the patient list to show it here.</p>
              </div>
            </article>
          )}
        </div>
      </section>

      {selectedReferral && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal referral-modal bhc-referral-view-sheet" aria-label="Referral details">
            <header>
              <div><span className="bhc-request-sheet-eyebrow">Barangay Health Center · Lucena City</span><h2>Medical Referral Record</h2></div>
              <button type="button" aria-label="Close referral details" onClick={() => setSelectedReferral(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="opd-medical-sheet">
              <div className="opd-sheet-identification"><div><span>Referral Reference</span><strong>{selectedReferral.id}</strong></div><div><span>Recorded Date</span><strong>{selectedReferral.date ? new Date(selectedReferral.date).toLocaleString('en-PH') : 'Not recorded'}</strong></div><div><span>Status</span><strong>{selectedReferral.status}</strong></div></div>
              <section className="opd-sheet-section"><h3>01 · Patient Particulars</h3><dl className="opd-sheet-fields">{[['Patient Name', selectedReferral.patientName], ['Age / Sex', `${selectedReferral.age} / ${selectedReferral.gender}`], ['Barangay', selectedReferral.barangay], ['Municipality', selectedReferral.municipality]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl></section>
              <section className="opd-sheet-section"><h3>02 · Referral Information</h3><dl className="opd-sheet-fields"><div><dt>Receiving Facility</dt><dd>{selectedReferral.destination}</dd></div><div><dt>Specialty</dt><dd>{selectedReferral.specialty}</dd></div><div className="opd-sheet-wide"><dt>Chief Complaint / Reason</dt><dd>{selectedReferral.chiefComplaint}</dd></div></dl></section>
              <section className="opd-sheet-section"><h3>03 · Recorded Vital Signs</h3><dl className="opd-sheet-vitals">{[['Weight', selectedReferral.weight], ['Temperature', selectedReferral.temperature], ['Blood Pressure', selectedReferral.bp], ['Oxygen Saturation', selectedReferral.o2sat], ['Height', selectedReferral.height], ['Respiratory Rate', selectedReferral.respirationRate], ['Cardiac Rate', selectedReferral.cardiacRate]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl></section>
              <section className="opd-sheet-section"><h3>04 · eKonsult / BHS Profile</h3><dl className="opd-sheet-vitals"><div><dt>First eKonsult Encounter</dt><dd>{selectedReferral.ekonsultEncounter}</dd></div><div><dt>Visit Number</dt><dd>{selectedReferral.visitNumber}</dd></div><div><dt>Profiled at BHS</dt><dd>{selectedReferral.profiledAtBhs}</dd></div></dl></section>
              <section className="opd-sheet-section"><h3>05 · Referring Personnel</h3><dl className="opd-sheet-fields"><div className="opd-sheet-wide"><dt>Referred By</dt><dd>{selectedReferral.referredBy}</dd></div></dl></section>
            </div>
            <div className="patient-form-actions"><button type="button" onClick={() => setSelectedReferral(null)}><X size={15} />Close</button></div>
          </section>
        </div>
      )}
    </>
  )
}

export default BHCReferredPatients
