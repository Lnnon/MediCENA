import { getApiErrorMessage } from '../../../services/apiErrors'
import MedicineCombobox from '../shared/MedicineCombobox'
import { CheckCircle2, FileText, Loader2, PackageCheck, Pill, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  createPatientMedicineRequest,
  fetchPatientMedicineRequests,
  fetchPatientMedicineDistributions,
} from '../../../services/medicines'

const REQUEST_STEPS = [
  { value: 'requested', label: 'Requested' },
  { value: 'seen', label: 'Seen' },
  { value: 'available', label: 'Available' },
  { value: 'ready_to_get', label: 'Ready to Get' },
  { value: 'received', label: 'Received' },
]

const formatDate = (value) => {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

const getRequestErrorMessage = (error) => getApiErrorMessage(error, 'Unable to submit medicine request.')

function PatientMedicineRequest() {
  const [requests, setRequests] = useState([])
  const [receivedMedicines, setReceivedMedicines] = useState([])
  const [form, setForm] = useState({ notes: '', prescription: null, medicineName: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const sortedRequests = useMemo(
    () => [...requests].sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)),
    [requests],
  )

  const loadRequests = async () => {
    try {
      const backendRequests = await fetchPatientMedicineRequests()
      setRequests(backendRequests)
      setError('')
    } catch {
      setError('Unable to load your medicine requests.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const [backendRequests, distributions] = await Promise.all([fetchPatientMedicineRequests(), fetchPatientMedicineDistributions()])
        if (isMounted) {
          setRequests(backendRequests)
          setReceivedMedicines(distributions)
          setError('')
        }
      } catch {
        if (isMounted) setError('Unable to load your medicine requests.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    const intervalId = window.setInterval(load, 7000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!form.medicineName) { setError('Select a medicine from the predefined list.'); return }
    if (!form.prescription) {
      setError('Upload the prescription from your doctor before requesting medicine.')
      return
    }

    const submittedForm = event.currentTarget
    setIsSubmitting(true)
    try {
      const createdRequest = await createPatientMedicineRequest(form)
      setRequests((currentRequests) => [createdRequest, ...currentRequests])
      setForm({ notes: '', prescription: null, medicineName: '' })
      submittedForm.reset()
      setMessage('Medicine request sent to your BHC.')
      await loadRequests()
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="patient-medicine-request-page">
      <div className="patient-page-heading">
        <div>
          <span>Medicine</span>
          <h1>Request Medicine</h1>
          <p>Upload the prescription from your doctor so your BHC can review the medicine request.</p>
        </div>
      </div>

      <div className="patient-medicine-request-grid">
        <article className="patient-panel">
          <div className="patient-panel-heading">
            <div>
              <span>Prescription Required</span>
              <h2>New Request</h2>
            </div>
            <UploadCloud size={18} />
          </div>

          {message && <div className="patient-request-message success">{message}</div>}
          {error && <div className="patient-request-message error">{error}</div>}

          <form className="patient-request-form" onSubmit={handleSubmit}>
            <label className="full"><span>Medicine *</span><MedicineCombobox value={form.medicineName} disabled={isSubmitting} onChange={(medicineName) => setForm((current) => ({ ...current, medicineName }))} /></label>
            <label className="full">
              <span>Doctor prescription *</span>
              <input
                required
                accept="image/*,.pdf"
                type="file"
                onChange={(event) => setForm((current) => ({ ...current, prescription: event.target.files?.[0] || null }))}
              />
            </label>
            <label className="full">
              <span>Notes</span>
              <textarea
                rows="4"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional remarks for BHC staff"
              />
            </label>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="cho-map-spin" size={16} /> : <Pill size={16} />}
              Send Request
            </button>
          </form>
        </article>

        <article className="patient-panel">
          <div className="patient-panel-heading">
            <div>
              <span>Tracking</span>
              <h2>Request Status</h2>
            </div>
            <PackageCheck size={18} />
          </div>

          <div className="patient-request-list">
            {isLoading ? (
              <div className="patient-empty-state">
                <Loader2 className="cho-map-spin" size={16} />
                Loading requests...
              </div>
            ) : sortedRequests.length > 0 ? sortedRequests.map((request) => {
              const statusForProgress = request.rawStatus === 'not_available' ? 'seen' : request.rawStatus
              const activeIndex = Math.max(0, REQUEST_STEPS.findIndex((step) => step.value === statusForProgress))
              return (
                <div className="patient-request-card" key={request.backendId}>
                  <header>
                    <div>
                      <strong>Prescription request</strong>
                      <span>{formatDate(request.createdAt)}</span>
                    </div>
                    <em>{request.status}</em>
                  </header>
                  <div className="patient-request-steps">
                    {REQUEST_STEPS.map((step, index) => (
                      <div className={index <= activeIndex ? 'complete' : ''} key={step.value}>
                        <span>{index < activeIndex ? <CheckCircle2 size={14} /> : index + 1}</span>
                        {step.label}
                      </div>
                    ))}
                  </div>
                  {request.prescriptionUrl && (
                    <a className="patient-prescription-link" href={request.prescriptionUrl} target="_blank" rel="noreferrer">
                      <FileText size={15} />
                      View prescription
                    </a>
                  )}
                </div>
              )
            }) : (
              <div className="patient-empty-state">Your medicine requests will appear here.</div>
            )}
          </div>
        </article>
      </div>
      <article className="patient-panel"><div className="patient-panel-heading"><div><span>BHC distribution history</span><h2>Medicines received</h2></div><PackageCheck size={18} /></div>{receivedMedicines.length ? receivedMedicines.map((item) => <div className="patient-request-card" key={item.backendId}><strong>{item.medicineName} {item.dosage} — {item.quantity} unit(s)</strong><p>{item.instructions || 'Follow your doctor’s instructions.'}</p><span>{item.facility} • {formatDate(item.distributedAt)}</span></div>) : <p>No medicine distributions recorded yet.</p>}</article>
    </section>
  )
}

export default PatientMedicineRequest
