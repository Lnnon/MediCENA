import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, History, X } from 'lucide-react'
import './DocPatientRecordDialog.css'

const formatDate = (date) => date && !Number.isNaN(Date.parse(date)) ? new Date(date).toLocaleDateString('en-PH') : 'Not recorded'
const Details = ({ fields }) => <dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>

export default function DocPatientRecordDialog({ patient, referrals, onClose }) {
  const dialogRef = useRef(null)
  const [showHistory, setShowHistory] = useState(false)
  const history = [...referrals].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); previousFocus?.focus() }
  }, [])

  return <dialog ref={dialogRef} className="doc-patient-record-dialog" aria-labelledby="doc-patient-record-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header><div><span>Patient Record</span><h2 id="doc-patient-record-title">{patient.name}</h2><p>{patient.age} · {patient.gender} · {patient.barangay}</p></div><button type="button" autoFocus aria-label="Close patient record" onClick={onClose}><X size={20} /></button></header>
    <div className="doc-patient-record-body">
      <section hidden={showHistory}><h3>Patient Information</h3><Details fields={[
        ['Contact Number', patient.contactNumber], ['Birth Date', formatDate(patient.birthDate)], ['Sex', patient.gender], ['Barangay', patient.barangay], ['Municipality', patient.municipality], ['Latest Referral Status', patient.status],
      ]} /></section>
      <div className="doc-record-history-toolbar"><div><h3>Referral & Consultation History</h3><p className="doc-record-note">{history.length} referral record{history.length === 1 ? '' : 's'} available</p></div><button type="button" aria-expanded={showHistory} aria-controls="doc-record-history" onClick={(event) => {
        event.currentTarget.closest('.doc-patient-record-body').scrollTop = 0
        setShowHistory((visible) => !visible)
      }}>{showHistory ? <ArrowLeft size={18} /> : <History size={18} />}{showHistory ? 'Back to Patient Details' : 'View History'}</button></div>
      <section id="doc-record-history" hidden={!showHistory}>
      <p className="doc-record-note">Records available in your assigned patient list, newest first.</p>
      {history.map((referral) => {
        const records = referral.consultationDetails?.length ? referral.consultationDetails : referral.consultationRecord ? [{ ...referral.consultationRecord, treatment_plan: referral.consultationRecord.treatmentPlan, consulted_at: referral.consultationRecord.consultedAt }] : []
        return <details key={referral.id}>
          <summary>{referral.code} · {formatDate(referral.date)} · {referral.status}</summary>
          <div className="doc-record-history-columns">
          <section><h4>Referral Details</h4>
          <Details fields={[
            ['Chief Complaint', referral.chiefComplaint], ['Specialty', referral.specialty], ['Referred From', referral.referredFrom], ['Referred By', referral.referredBy], ['Assigned Doctor', referral.assignedDoctor], ['Purok', referral.purokName],
          ]} />
          </section><section><h4>Recorded Vital Signs</h4>
          <Details fields={[
            ['Blood Pressure (mmHg)', referral.bp], ['Temperature (°C)', referral.temperature], ['Oxygen (%)', referral.o2sat], ['Weight (kg)', referral.weight], ['Height (cm)', referral.height], ['Respiratory Rate (breaths/min)', referral.respirationRate], ['Cardiac Rate (bpm)', referral.cardiacRate],
          ]} />
          </section></div>
          <h4>Consultation Notes</h4>
          {records.length ? records.map((record) => <article className="doc-record-consultation" key={record.id}>
            <p>{formatDate(record.consulted_at)}{record.doctor ? ` · ${record.doctor}` : ''}</p>
            <Details fields={[["Diagnosis", record.diagnosis], ["Treatment Plan", record.treatment_plan]]} />
          </article>) : <p className="doc-record-note">No consultation notes recorded for this referral.</p>}
        </details>
      })}
      </section>
    </div>
    <footer><button type="button" onClick={onClose}>Close Record</button></footer>
  </dialog>
}
