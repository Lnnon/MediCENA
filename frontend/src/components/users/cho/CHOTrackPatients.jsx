import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FlaskConical,
  Pill,
  Search,
  Stethoscope,
  Syringe,
  UserRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import './CHOTrackLayout.css'

const referralSteps = ['Referred', 'Seen', 'Accepted', 'Assigned', 'Arrived', 'Admitted', 'Completed']

const getCompletedStepIndex = (referral) => {
  const normalizedStatus = referral.status?.toLowerCase()

  if (normalizedStatus === 'completed') return 6
  if (normalizedStatus === 'admitted') return 5
  if (normalizedStatus === 'arrived') return 4
  if (normalizedStatus === 'assigned') return 3
  if (normalizedStatus === 'accepted') return 2
  if (normalizedStatus === 'seen') return 1
  if (referral.assignedDoctor && referral.assignedDoctor !== 'Unassigned') return 3

  return 0
}

function CHOTrackPatients({ referrals, focusPatientId = null }) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [expandedRecordId, setExpandedRecordId] = useState(null)

  const patientRecords = useMemo(() => {
    const groupedRecords = referrals.reduce((recordsByPatient, referral) => {
      const patientName = typeof referral.patient === 'object' ? referral.patient.name : referral.patient
      const patientId = referral.patientId || patientName || referral.id
      const existingRecord = recordsByPatient.get(patientId)

      recordsByPatient.set(patientId, {
        patientId,
        patientName,
        age: referral.age,
        sex: referral.sex || 'Not set',
        barangay: referral.barangay || 'No barangay',
        contactNumber: referral.contactNumber || 'No contact number',
        referrals: [...(existingRecord?.referrals || []), referral],
      })

      return recordsByPatient
    }, new Map())

    return [...groupedRecords.values()].map((record) => ({
      ...record,
      referrals: record.referrals.sort((first, second) => new Date(second.date) - new Date(first.date)),
    }))
  }, [referrals])

  const filteredPatientRecords = useMemo(() => {
    if (focusPatientId && !searchKeyword) return patientRecords.filter((record) => String(record.patientId) === String(focusPatientId))
    const keyword = searchKeyword.trim().toLowerCase()

    if (!keyword) return patientRecords

    return patientRecords.filter((record) =>
      [
        record.patientName,
        record.barangay,
        record.contactNumber,
        ...record.referrals.flatMap((referral) => [
          referral.code,
          referral.id,
          referral.status,
          referral.specialty,
          referral.chiefComplaint,
          referral.referredFrom,
          referral.referredTo,
        ]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    )
  }, [patientRecords, searchKeyword, focusPatientId])

  const getClinicalSections = (referral) => {
    const consultation = referral.consultationDetails?.[0]
    const diagnosis = consultation?.diagnosis || referral.otherDiagnosis || 'Awaiting diagnosis'

    return [
      { label: 'Treatment plan', value: consultation?.treatment_plan || 'No treatment plan recorded', icon: Pill },
      { label: 'Lab Results', value: 'No lab result recorded', icon: FlaskConical },
      { label: 'Diagnosis', value: diagnosis, icon: Stethoscope },
      { label: 'Immunization', value: 'No immunization recorded', icon: Syringe },
    ]
  }

  return (
    <div className="cho-track-styled">
      <div className="cho-page-heading"><div><span>Patients</span><h1>Track Patients</h1><p>Review electronic health records, referral history, and old patient records.</p></div></div>
      <section className="cho-track-page">
        <aside className="cho-filter-panel">
          <h2>Patient EHR</h2>
          <label><span>Search</span><div><Search size={15} /><input type="search" placeholder="Patient, referral code, status" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} /></div></label>
          <div className="cho-track-summary-card"><UserRound size={18} /><div><strong>{filteredPatientRecords.length}</strong><span>Patient chart/s</span></div></div>
          <div className="cho-track-summary-card"><Activity size={18} /><div><strong>{filteredPatientRecords.reduce((count, record) => count + record.referrals.length, 0)}</strong><span>Total health record/s</span></div></div>
        </aside>
        <div className="cho-track-list">
          {filteredPatientRecords.length > 0 ? (
            filteredPatientRecords.map((record) => {
              const latestReferral = record.referrals[0]
              const clinicalSections = getClinicalSections(latestReferral)

              return (
                <article className="cho-track-card" key={record.patientId}>
                  <header>
                    <div>
                      <span>Electronic Health Record</span>
                      <h2>{record.patientName}</h2>
                      <p>
                        {record.age} years old | {record.sex} | {record.barangay} | {record.contactNumber}
                      </p>
                    </div>
                    <div className="cho-track-card-actions">
                      <strong>{record.referrals.length} record/s</strong>
                    </div>
                  </header>

                  <div className="cho-track-clinical-grid">
                    {clinicalSections.map((section) => {
                      const Icon = section.icon
                      return (
                        <div className="cho-track-clinical-item" key={section.label}>
                          <Icon size={16} />
                          <span>{section.label}</span>
                          <strong>{section.value}</strong>
                        </div>
                      )
                    })}
                  </div>

                  <div className="cho-ehr-history">
                    <div className="cho-ehr-history-heading">
                      <div>
                        <span>Old Records</span>
                        <strong>Visit and referral history</strong>
                      </div>
                      <time>Latest: {new Date(latestReferral.date).toLocaleDateString()}</time>
                    </div>

                    {record.referrals.map((referral, index) => {
                      const completedStepIndex = getCompletedStepIndex(referral)
                      const referralId = referral.code || referral.id
                      const isExpanded = expandedRecordId === referralId || (expandedRecordId === null && focusPatientId && String(record.patientId) === String(focusPatientId) && index === 0)

                      return (
                        <section className="cho-ehr-record-row" key={referralId}>
                          <div className="cho-ehr-record-summary">
                            <div>
                              <span>{index === 0 ? 'Latest Record' : 'Old Record'}</span>
                              <strong>{referral.specialty} | {referral.chiefComplaint}</strong>
                              <p>{new Date(referral.date).toLocaleString()} | {referral.referredFrom} to {referral.referredTo}</p>
                            </div>
                            <div className="cho-track-card-actions">
                              <strong>{referral.status}</strong>
                              <button
                                className="cho-track-expand-button"
                                type="button"
                                aria-expanded={isExpanded}
                                onClick={() => setExpandedRecordId(isExpanded ? null : referralId)}
                              >
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="cho-track-expanded-panel">
                              <div className="referral-steps" aria-label="Patient referral progress">
                                {referralSteps.map((step, stepIndex) => (
                                  <div className={stepIndex <= completedStepIndex ? 'complete' : ''} key={step}>
                                    <span>{stepIndex + 1}</span>
                                    <small>{step}</small>
                                  </div>
                                ))}
                              </div>

                              {referral.consultationDetails?.map((consultation) => <div className="cho-track-detail-grid" key={consultation.id}>
                                <div><Stethoscope size={16} /><span>Consultation diagnosis</span><strong>{consultation.diagnosis}</strong></div>
                                <div><Pill size={16} /><span>Treatment plan</span><strong>{consultation.treatment_plan}</strong></div>
                                <div><Clock size={16} /><span>Doctor / consultation date</span><strong>{consultation.doctor} — {new Date(consultation.consulted_at).toLocaleString()}</strong></div>
                              </div>)}
                              <div className="cho-track-detail-grid">
                                <div>
                                  <FileText size={16} />
                                  <span>Complaint</span>
                                  <strong>{referral.chiefComplaint}</strong>
                                </div>
                                <div>
                                  <Stethoscope size={16} />
                                  <span>Vitals</span>
                                  <strong>
                                    Weight {referral.weight}, Temp {referral.temperature}, BP {referral.bp}, O2 {referral.o2sat},
                                    Height {referral.height}, RR {referral.respirationRate}, CR {referral.cardiacRate}
                                  </strong>
                                </div>
                                <div>
                                  <Clock size={16} />
                                  <span>eKonsult / BHS</span>
                                  <strong>
                                    First encounter: {referral.ekonsultEncounter}; Visit No: {referral.visitNumber};
                                    Profiled at BHS: {referral.profiledAtBhs}
                                  </strong>
                                </div>
                                <div>
                                  <Activity size={16} />
                                  <span>Referred By</span>
                                  <strong>{referral.referredBy}</strong>
                                </div>
                              </div>
                            </div>
                          )}
                        </section>
                      )
                    })}
                  </div>
                </article>
              )
            })
          ) : (
            <article className="cho-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>No tracked patients yet</h2>
                <p>Incoming and referred patient records from the backend will appear here.</p>
              </div>
            </article>
          )}
        </div>
      </section>
    </div>
  )
}

export default CHOTrackPatients
