import BHCFilterToolbar from './BHCFilterToolbar'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  PackageCheck,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import {
  fetchPatientMedicineDistributions,
  fetchMedicineInventory,
  createPatientMedicineDistribution,
  fetchPatientMedicineRequests,
  updatePatientMedicineRequest,
} from '../../../services/medicines'
import { fetchPatients } from '../../../services/patients'

const REQUEST_STATUS_OPTIONS = [
  { value: 'walk_in', label: 'Walk In' },
  { value: 'requested', label: 'Requested' },
  { value: 'seen', label: 'Seen' },
  { value: 'available', label: 'Available' },
  { value: 'not_available', label: 'Not Available' },
  { value: 'ready_to_get', label: 'Ready to Get' },
  { value: 'received', label: 'Received' },
]

const formatDate = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleDateString()
}

function BHCMedicineDistribution({ onDistributionSaved, onOpenInventory }) {
  const [patients, setPatients] = useState([])
  const [distributions, setDistributions] = useState([])
  const [patientRequests, setPatientRequests] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [detailRequest, setDetailRequest] = useState(null)
  const [updatingRequestId, setUpdatingRequestId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [inventory, setInventory] = useState([])
  const [dispensing, setDispensing] = useState(null)
  const dispenseDialog = useRef(null)
  const recordsDialog = useRef(null)
  const [recordsSearch, setRecordsSearch] = useState('')
  const filteredDistributions = useMemo(() => {
    const query = recordsSearch.trim().toLowerCase()
    return distributions.filter((item) => [item.patientName, item.medicineName, item.dosage, item.instructions, item.distributedAt].some((value) => String(value || '').toLowerCase().includes(query)))
  }, [distributions, recordsSearch])
  useEffect(() => {
    if (dispensing && !dispenseDialog.current?.open) dispenseDialog.current?.showModal()
  }, [dispensing])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isMounted = true
    const loadData = async () => {
    const [patientRows, distributionRows, requestRows, inventoryRows] = await Promise.all([
      fetchPatients(),
      fetchPatientMedicineDistributions(),
      fetchPatientMedicineRequests(),
      fetchMedicineInventory(),
    ])
    if (!isMounted) return
    setPatients(patientRows)
    setDistributions(distributionRows)
    setPatientRequests(requestRows)
    setInventory(inventoryRows)
    }

    loadData()
      .then(() => {
        if (isMounted) setErrorMessage('')
      })
      .catch(() => {
        if (isMounted) setErrorMessage('Unable to load patient medicine distribution data.')
      })

    return () => {
      isMounted = false
    }
  }, [])

  const totalDistributed = distributions.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const todayCount = distributions.filter((item) => item.distributedAt === new Date().toISOString().slice(0, 10)).length
  const activePatientRequests = useMemo(
    () => {
      const searchValue = filters.search.trim().toLowerCase()
      return patientRequests
        .filter((request) => {
          const matchesSearch = !searchValue || [request.id, request.patientName, request.barangay, request.status, request.notes]
            .join(' ')
            .toLowerCase()
            .includes(searchValue)
          return matchesSearch && (!filters.status || request.rawStatus === filters.status)
        })
    },
    [patientRequests, filters],
  )

  const handleRequestStatusChange = async (request, status) => {
    setUpdatingRequestId(request.backendId)
    setErrorMessage('')

    try {
      const updatedRequest = await updatePatientMedicineRequest(request.backendId, { status })
      setPatientRequests((currentRequests) =>
        currentRequests.map((item) => (item.backendId === updatedRequest.backendId ? updatedRequest : item)),
      )
      if (detailRequest?.backendId === updatedRequest.backendId) {
        setDetailRequest(updatedRequest)
      }
      onDistributionSaved?.()
    } catch {
      setErrorMessage('Unable to update patient medicine request status.')
    } finally {
      setUpdatingRequestId(null)
    }
  }

  const openRequestDetails = async (request) => {
    setDetailRequest(request)
    if (request.rawStatus === 'requested') {
      await handleRequestStatusChange(request, 'seen')
    }
  }

  const getStatusClass = (status) => {
    if (status === 'received') return 'delivered'
    if (status === 'walk_in') return 'delivered'
    if (status === 'requested' || status === 'seen') return 'pending'
    if (status === 'not_available') return 'delivered'
    return 'approved'
  }

  const dispense = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsSaving(true)
    try {
      const distribution = await createPatientMedicineDistribution({ patientId: Number(form.get('patient')), medicineId: Number(form.get('medicine')), quantity: Number(form.get('quantity')), instructions: form.get('instructions'), notes: form.get('notes'), requestId: dispensing?.backendId })
      setDistributions((current) => [distribution, ...current])
      const [stocks, requests] = await Promise.all([fetchMedicineInventory(), fetchPatientMedicineRequests()])
      setInventory(stocks); setPatientRequests(requests); setDispensing(null); setErrorMessage(''); onDistributionSaved?.()
    } catch (error) { setErrorMessage(error.response?.data?.quantity?.[0] || 'Unable to record distribution. Check patient and available stock.') }
    finally { setIsSaving(false) }
  }

  return (
    <div className="bhc-distribution-ui">
      <div className="bhc-page-heading">
        <div>
          <span>Medicine</span>
          <h1>Patient Medicine Distribution</h1>
          <p>Review patient prescription requests, prepare medicine, and save the distribution record.</p>
        </div>
      </div>

      <section className="bhc-medicine-stats" aria-label="Patient medicine distribution summary">
        <article>
          <div><UserRound size={20} /></div>
          <span>Patients</span>
          <strong>{patients.length}</strong>
        </article>
        <article>
          <div><PackageCheck size={20} /></div>
          <span>Distributed</span>
          <strong>{totalDistributed}</strong>
        </article>
        <article>
          <div><CalendarDays size={20} /></div>
          <span>Today</span>
          <strong>{todayCount}</strong>
        </article>
        <article>
          <div><FileText size={20} /></div>
          <span>Patient Requests</span>
          <strong>{patientRequests.length}</strong>
        </article>
      </section>

      {errorMessage && (
        <div className="patient-alert">
          <AlertTriangle size={16} />
          {errorMessage}
        </div>
      )}

      <div className="department-toolbar"><button type="button" onClick={() => setDispensing({})}>Record patient medicine distribution</button><button type="button" onClick={() => recordsDialog.current.showModal()}>Patient Distribution Records</button></div>
      {dispensing && <dialog ref={dispenseDialog} className="bhc-dispense-dialog" aria-labelledby="bhc-dispense-title" onCancel={(event) => { if (isSaving) event.preventDefault(); else setDispensing(null) }}>
        <header><h2 id="bhc-dispense-title">Release medicine to patient</h2><button type="button" disabled={isSaving} aria-label="Close release medicine form" onClick={() => setDispensing(null)}><X size={18} /></button></header>
        {errorMessage && <p className="patient-alert" role="alert">{errorMessage}</p>}
        <form className="department-form" onSubmit={dispense}>
        <label>Patient<select name="patient" defaultValue={dispensing.patientId || ''} required><option value="">Select patient</option>{patients.filter((patient) => !dispensing.patientId || patient.id === dispensing.patientId).map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label>
        <label>Medicine<select name="medicine" required><option value="">Select available medicine</option>{inventory.filter((item) => item.stocks > 0).map((item) => <option key={item.backendId} value={item.medicineId}>{item.name} {item.dosage} — {item.stocks} available</option>)}</select></label>
        <label>Quantity<input name="quantity" type="number" min="1" defaultValue="1" required /></label><label>Instructions<input name="instructions" placeholder="Follow the doctor's prescription" /></label>
        <label className="bhc-dispense-notes">Notes<input name="notes" defaultValue={dispensing.id || ''} /></label><div className="bhc-dispense-actions"><button type="button" disabled={isSaving} onClick={() => setDispensing(null)}>Cancel</button><button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save distribution'}</button></div>
      </form></dialog>}
      <section className="bhc-patient-page bhc-medicine-page">
        <BHCFilterToolbar placeholder="Search request..." value={filters.search} onSearch={(value) => setFilters((current) => ({ ...current, search: value }))}
          active={filters.status}>
          <label>
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All Status</option>
              {REQUEST_STATUS_OPTIONS.map((status) => (
                <option value={status.value} key={status.value}>{status.label}</option>
              ))}
            </select>
          </label>
          <button
            className="filter-button"
            type="button"
            onClick={() => setFilters({ search: '', status: '' })}
          >
            <Filter size={15} />
            Reset Filter
          </button>
        </BHCFilterToolbar>

        <article className="cho-patient-list-panel cho-medicine-request-panel bhc-medicine-list-panel">
          <h2>Request List ({activePatientRequests.length})</h2>

          {activePatientRequests.length > 0 ? (
            <div className="cho-medicine-request-table-wrap">
              <table className="cho-medicine-request-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Patient / Barangay</th>
                    <th>Request</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activePatientRequests.map((request) => (
                    <tr key={request.backendId}>
                      <td><strong>{request.id}</strong></td>
                      <td>
                        <strong>{request.patientName}</strong>
                        <span>{request.barangay || 'Barangay not set'}</span>
                      </td>
                      <td>
                        <strong>Prescription request</strong>
                        <span>{request.prescriptionUrl ? 'Prescription uploaded' : 'No prescription file'}</span>
                      </td>
                      <td>{formatDate(request.createdAt)}</td>
                      <td>
                        <span className={`cho-request-status ${getStatusClass(request.rawStatus)}`}>
                          <CheckCircle2 size={12} />
                          {request.status}
                        </span>
                      </td>
                      <td>
                        <div className="cho-request-actions">
                          {['available', 'ready_to_get', 'walk_in'].includes(request.rawStatus) && <button type="button" className="request-approve-button" onClick={() => setDispensing(request)}><PackageCheck size={13} />Release medicine</button>}
                          <button className="request-view-button" type="button" onClick={() => openRequestDetails(request)}>
                            <Eye size={13} />
                            View
                          </button>
                          {request.rawStatus === 'seen' && (
                            <button className="request-dispatch-button" type="button" onClick={onOpenInventory}>
                              <Search size={13} />
                              Check Stocks
                            </button>
                          )}
                          {request.rawStatus === 'available' && (
                            <button
                              className="request-approve-button"
                              disabled={updatingRequestId === request.backendId}
                              type="button"
                              onClick={() => handleRequestStatusChange(request, 'ready_to_get')}
                            >
                              <CheckCircle2 size={13} />
                              Ready to Get
                            </button>
                          )}
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
              No active medicine requests found.
            </div>
          )}

        </article>
      </section>

      <dialog ref={recordsDialog} className="bhc-distribution-records-dialog" aria-labelledby="bhc-distribution-records-title"><header><h2 id="bhc-distribution-records-title">Patient Distribution Records</h2><button type="button" aria-label="Close distribution records" onClick={() => recordsDialog.current.close()}><X size={18} /></button></header><label className="bhc-records-search"><Search size={16} /><input type="search" aria-label="Search distribution records" placeholder="Search patient, medicine, instructions or date..." value={recordsSearch} onChange={(event) => setRecordsSearch(event.target.value)} /></label><div className="department-table-wrap"><table className="department-table"><thead><tr><th>Patient</th><th>Medicine</th><th>Quantity</th><th>Instructions</th><th>Released</th></tr></thead><tbody>{filteredDistributions.map((item) => <tr key={item.backendId}><td>{item.patientName}</td><td>{item.medicineName} {item.dosage}</td><td>{item.quantity}</td><td>{item.instructions || '—'}</td><td>{item.distributedAt}</td></tr>)}</tbody></table></div>{!filteredDistributions.length && <p>{distributions.length ? 'No distribution records match your search.' : 'No patient distributions recorded yet.'}</p>}<footer><button type="button" onClick={() => recordsDialog.current.close()}>Close</button></footer></dialog>
      {detailRequest && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal cho-medicine-modal" aria-label="Patient medicine request details">
            <header>
              <div>
                <h2>Prescription Request</h2>
                <p>Request ID: {detailRequest.id}</p>
              </div>
              <button type="button" aria-label="Close request details" onClick={() => setDetailRequest(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="referral-log">
              <p><strong>Patient:</strong> {detailRequest.patientName}</p>
              <p><strong>Barangay:</strong> {detailRequest.barangay || 'Barangay not set'}</p>
              <p><strong>Status:</strong> {detailRequest.status}</p>
              <p><strong>Date:</strong> {formatDate(detailRequest.createdAt)}</p>
              {detailRequest.notes && <p><strong>Notes:</strong> {detailRequest.notes}</p>}
            </div>
            <div className="patient-form-actions">
              {detailRequest.prescriptionUrl && (
                <a className="request-view-button" href={detailRequest.prescriptionUrl} target="_blank" rel="noreferrer">
                  <FileText size={14} />
                  Open Prescription
                </a>
              )}
              {detailRequest.rawStatus === 'seen' && (
                <>
                  <button
                    className="request-approve-button"
                    type="button"
                    onClick={() => handleRequestStatusChange(detailRequest, 'available')}
                  >
                    <CheckCircle2 size={14} />
                    Available
                  </button>
                  <button
                    className="request-dispatch-button"
                    type="button"
                    onClick={() => handleRequestStatusChange(detailRequest, 'not_available')}
                  >
                    <X size={14} />
                    Not Available
                  </button>
                </>
              )}
              {detailRequest.rawStatus === 'available' && (
                <button
                  className="request-approve-button"
                  type="button"
                  onClick={() => handleRequestStatusChange(detailRequest, 'ready_to_get')}
                >
                  <CheckCircle2 size={14} />
                  Ready to Get
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default BHCMedicineDistribution
