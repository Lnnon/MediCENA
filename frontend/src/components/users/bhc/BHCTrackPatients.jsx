import BHCFilterToolbar from './BHCFilterToolbar'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Eye,
  X,
  ChevronRight,
  CalendarDays,
  Clock,
  House,
  Phone,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
  Syringe,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

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

function ChartDialog({ title, patient, onClose, children }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} className="track-chart-dialog" aria-label={title}
    onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header><div><span>{patient}</span><h2>{title}</h2></div>
      <button type="button" aria-label="Close popup" onClick={onClose}><X size={18} /></button>
    </header>
    {children}
  </dialog>
}

function BHCTrackPatients({ referrals }) {
  const [barangay, setBarangay] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [patientId, setPatientId] = useState(null)
  const [expandedRecordId, setExpandedRecordId] = useState(null)
  const patientRecords = useMemo(() => {
    const groupedRecords = referrals.reduce((recordsByPatient, referral) => {
      const patientName = typeof referral.patient === 'object' ? referral.patient.name : referral.patient
      const patientId = referral.patientId || patientName || referral.id
      const existingRecord = recordsByPatient.get(patientId)
      const record = {
        patientId,
        patientName,
        age: referral.age,
        sex: referral.sex || 'Not set',
        barangay: referral.barangay || 'No barangay',
        contactNumber: referral.contactNumber || 'No contact number',
        referrals: [...(existingRecord?.referrals || []), referral],
      }

      recordsByPatient.set(patientId, record)
      return recordsByPatient
    }, new Map())

    return [...groupedRecords.values()].map((record) => ({
      ...record,
      referrals: record.referrals.sort((first, second) => new Date(second.date) - new Date(first.date)),
    }))
  }, [referrals])

  const filteredPatientRecords = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()



    return patientRecords.filter((record) => (!barangay || record.barangay === barangay) &&
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
        ]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    )
  }, [patientRecords, searchKeyword, barangay])

  const getClinicalSections = (referral) => {
    const diagnosis = referral.otherDiagnosis || 'Awaiting diagnosis'
    return [
      { label: 'Medication', value: 'No medication recorded', icon: Pill },
      { label: 'Lab Results', value: 'No lab result recorded', icon: FlaskConical },
      { label: 'Diagnosis', value: diagnosis, icon: Stethoscope },
      { label: 'Immunization', value: 'No immunization recorded', icon: Syringe },
    ]
  }

  const record = patientRecords.find((item) => item.patientId === patientId)
  const referral = record?.referrals.find((item) => (item.code || item.id) === expandedRecordId)
  const completedStepIndex = referral ? getCompletedStepIndex(referral) : 0

  return (
    <>
      <div className="bhc-page-heading track-chart-heading">
        <div>
          <span>Patients</span>
          <h1>Track Referral</h1>
          <p>Monitor submitted referrals, clinical details, and patient transfer progress.</p>
        </div>
        <div className="track-header-stats">
          <div><UserRound size={18} /><div><strong>{filteredPatientRecords.length}</strong><small>Patient charts</small></div></div>
          <div><Activity size={18} /><div><strong>{filteredPatientRecords.reduce((total, chart) => total + chart.referrals.length, 0)}</strong><small>Total health records</small></div></div>
        </div>
      </div>

      <section className="bhc-track-page track-chart-page">
        <BHCFilterToolbar placeholder="Search patient, referral code, or status…" value={searchKeyword} onSearch={setSearchKeyword} active={barangay}>
          <label>Barangay<select value={barangay} onChange={(e) => setBarangay(e.target.value)}><option value="">All barangays</option>
            {[...new Set(patientRecords.map((chart) => chart.barangay))].sort().map((name) => <option key={name}>{name}</option>)}
          </select></label>
          <button type="button" onClick={() => { setBarangay(''); setSearchKeyword('') }}>Reset Filters</button>
        </BHCFilterToolbar>

        <div className="bhc-track-list">
          {filteredPatientRecords.length > 0 ? (
            filteredPatientRecords.map((chart) => (
              <article className="track-chart-summary" key={chart.patientId}>
                <div className="track-chart-avatar" aria-hidden="true"><UserRound size={30} /></div>
                <div className="track-chart-identity">
                  <small>Electronic Health Record</small>
                  <h2>{chart.patientName}</h2>
                  <div className="track-chart-demographics">
                    <span><CalendarDays />{typeof chart.age === 'number' ? chart.age + ' years old' : chart.age || 'Age not recorded'}</span>
                    <span><UserRound />{chart.sex}</span>
                    <span><House />{chart.barangay}</span>
                    <span><Phone />{chart.contactNumber}</span>
                  </div>
                </div>
                <div className="track-chart-reference">
                  <FileText size={22} />
                  <div><small>Referral Code</small><strong>{chart.referrals[0].code || chart.referrals[0].id}</strong></div>
                </div>
                <div className="track-chart-controls">
                  <span>{chart.referrals.length} {chart.referrals.length === 1 ? 'record' : 'records'}</span>
                  <button className="chart-action" type="button" onClick={() => setPatientId(chart.patientId)}><Eye size={16} />View History<ChevronRight size={14} aria-hidden="true" /></button>
                </div>
              </article>
            ))
          ) : (
            <article className="bhc-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>No tracked referrals yet</h2>
                <p>Submit a referral from the patient list to start tracking it here.</p>
              </div>
            </article>
          )}
        </div>
      </section>
      {record && <ChartDialog title="Visit and referral history" patient={record.patientName} onClose={() => { setExpandedRecordId(null); setPatientId(null) }}>
        <div className="track-clinical-grid">
          {getClinicalSections(record.referrals[0]).map((section) => {
            const Icon = section.icon
            return (
              <div className="track-clinical-item" key={section.label}>
                <Icon size={16} />
                <span>{section.label}</span>
                <strong>{section.value}</strong>
              </div>
            )
          })}
        </div>
        <div className="ehr-history">
          {record.referrals.map((item, index) => (
            <section className="ehr-record-row" key={item.id}>
              <div className="ehr-record-summary">
                <div><span>{index === 0 ? 'Latest Record' : 'Old Record'}</span>
                  <strong>{item.specialty} | {item.chiefComplaint}</strong>
                  <p>{new Date(item.date).toLocaleString()} | {item.referredTo || item.destination}</p>
                </div>
                <div className="track-card-actions"><strong>{item.status}</strong>
                  <button className="chart-action" type="button" onClick={() => setExpandedRecordId(item.code || item.id)}>Expand</button>
                </div>
              </div>
            </section>
          ))}
        </div>
      </ChartDialog>}
      {referral && <ChartDialog title={'Referral details · ' + (referral.code || referral.id)} patient={record.patientName} onClose={() => setExpandedRecordId(null)}>
        <div className="track-expanded-panel">
          <div className="referral-steps" aria-label="Patient referral progress">
            {referralSteps.map((step, stepIndex) => (
              <div className={stepIndex <= completedStepIndex ? 'complete' : ''} key={step}>
                <span>{stepIndex + 1}</span>
                <small>{step}</small>
              </div>
            ))}
          </div>

          <div className="track-detail-grid">
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
        <footer><button type="button" className="chart-action" onClick={() => setExpandedRecordId(null)}><ArrowLeft size={16} />Back to History</button></footer>
      </ChartDialog>}
    </>
  )
}

export default BHCTrackPatients
