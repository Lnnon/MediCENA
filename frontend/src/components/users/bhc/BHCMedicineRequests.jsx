import BHCFilterToolbar from './BHCFilterToolbar'
import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, Clock, Eye, FileText, Filter, PackageCheck, PackageX, Truck } from 'lucide-react'
import { updateMedicineRequest } from '../../../services/medicines'
import './BHCMedicineRequests.css'

const requestSteps = ['Pending', 'Approve', 'Dispatch', 'Delivered']
const requestStatuses = [['all', 'All Requests'], ['requested', 'Pending Approval'], ['approved', 'Approved'], ['dispatched', 'Dispatched'], ['released', 'Delivered'], ['declined', 'Declined / Cancelled']]
const statusIcons = { all: FileText, requested: Clock, approved: Check, dispatched: Truck, released: PackageCheck, declined: PackageX }
const getRequestStatus = (request) => request.rawStatus || ({ 'Pending Approval': 'requested', Pending: 'requested', Approved: 'approved', Dispatched: 'dispatched', Delivered: 'released', Declined: 'declined' }[request.status]) || 'requested'

const getCompletedStepIndex = (status) => {
  const normalizedStatus = status?.toLowerCase()

  if (normalizedStatus === 'delivered' || normalizedStatus === 'received') return 3
  if (normalizedStatus === 'dispatch' || normalizedStatus === 'dispatched') return 2
  if (normalizedStatus === 'approve' || normalizedStatus === 'approved') return 1

  return 0
}

function BHCMedicineRequests({ requests, onRequestUpdated }) {
  const [filters, setFilters] = useState({ search: '', date: '' })
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const matchingRequests = useMemo(() => {
    return requests.filter((request) => {
      const searchText = filters.search.toLowerCase()
      const matchesSearch =
        request.medicineName.toLowerCase().includes(searchText) ||
        request.id.toLowerCase().includes(searchText) ||
        request.requestedFrom.toLowerCase().includes(searchText) ||
        request.pickUpBy.toLowerCase().includes(searchText)

      const matchesDate = !filters.date || request.dateRequested === filters.date

      return matchesSearch && matchesDate
    })
  }, [filters, requests])
  const filteredRequests = matchingRequests.filter((request) => statusFilter === 'all' || getRequestStatus(request) === statusFilter)

  const updateFilter = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  const handleStatusUpdate = async (request, status) => {
    try {
      const updatedRequest = await updateMedicineRequest(request.backendId, { status })
      onRequestUpdated(updatedRequest.bhc)
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to update medicine request status.')
    }
  }

  return (
    <>
      <div className="bhc-page-heading">
        <div>
          <span>Medicine</span>
          <h1>Medicine Requests</h1>
          <p>Track requested medicine approval, dispatch, and delivery.</p>
        </div>
      </div>

      <section className="bhc-referral-page bhc-medicine-request-page bhc-requests-organized">
        <div className="bhc-request-status-filters" role="group" aria-label="Filter requests by status">
          {requestStatuses.map(([value, label]) => {
            const Icon = statusIcons[value]
            return <button key={value} type="button" data-status={value} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>
              <span className="bhc-request-stat-icon"><Icon size={20} /></span>
              <span className="bhc-request-stat-label">{label}</span>
              <strong>{value === 'all' ? requests.length : requests.filter((request) => getRequestStatus(request) === value).length}</strong>
            </button>
          })}
        </div>
        <BHCFilterToolbar placeholder="Search request..." value={filters.search} onSearch={(value) => updateFilter('search', value)}
          active={filters.date || statusFilter !== 'all'}>
          <label>
            <span>Date Requested</span>
            <div>
              <CalendarDays size={15} />
              <input
                type="date"
                value={filters.date}
                onChange={(event) => updateFilter('date', event.target.value)}
              />
            </div>
          </label>
          <button className="filter-button" type="button" onClick={() => { setFilters({ search: '', date: '' }); setStatusFilter('all') }}>
            <Filter size={15} />
            Reset Filters
          </button>
        </BHCFilterToolbar>

        <div className="bhc-referred-list bhc-medicine-request-list">
          <p className="bhc-request-result-count" role="status">{filteredRequests.length} request{filteredRequests.length === 1 ? '' : 's'} · {requestStatuses.find(([value]) => value === statusFilter)?.[1]}</p>
          {errorMessage && (
            <article className="bhc-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>Update failed</h2>
                <p>{errorMessage}</p>
              </div>
            </article>
          )}
          {filteredRequests.length > 0 ? (
            filteredRequests.map((request) => {
              const completedStepIndex = getCompletedStepIndex(request.status)
              const canReceive = request.rawStatus === 'dispatched'
              const canCancel = request.rawStatus === 'requested'

              return (
                <article className="bhc-referral-card medicine-request-card" data-status={getRequestStatus(request)} key={request.id}>
                  <header>
                    <div>
                      <h2>{request.medicineName}</h2>
                      <p>{request.quantity} unit/s requested from {request.requestedFrom}</p>
                      <span>Request Code: {request.id}</span>
                    </div>
                    <strong>{request.status || 'Pending'}</strong>
                  </header>

                  <div className="referral-destination">
                    <Truck size={15} />
                    {request.medicineName} request filed for {request.address}
                  </div>

                  {getRequestStatus(request) === 'declined' ? <p className="bhc-request-closed">This request was declined or cancelled.</p> : <div className="referral-steps medicine-request-steps" aria-label="Medicine request tracking">
                    {requestSteps.map((step, stepIndex) => (
                      <div className={stepIndex <= completedStepIndex ? 'complete' : ''} key={step}>
                        <span>{stepIndex + 1}</span>
                        <small>{step}</small>
                      </div>
                    ))}
                  </div>}

                  <div className="referral-log">
                    <time>{new Date(request.dateRequested).toLocaleDateString()}</time>
                    <p>
                      <strong>{request.quantity}</strong> unit/s requested by {request.pickUpBy}.
                    </p>
                    <p>Requested Address: {request.address}</p>
                  </div>

                  <div className="referral-card-actions">
                    <button className="view-patient-button" type="button" onClick={() => setSelectedRequest(request)}>
                      <Eye size={14} />
                      View
                    </button>
                    {canReceive && (
                      <button
                        className="success-action-button"
                        type="button"
                        onClick={() => handleStatusUpdate(request, 'released')}
                      >
                        <PackageCheck size={14} />
                        Received
                      </button>
                    )}
                    {canCancel && (
                      <button
                        className="secondary-action-button"
                        type="button"
                        onClick={() => handleStatusUpdate(request, 'declined')}
                      >
                        <PackageX size={14} />
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              )
            })
          ) : (
            <article className="bhc-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>No medicine requests found</h2>
                <p>Request medicine from the inventory list or adjust your filters.</p>
              </div>
            </article>
          )}
        </div>
      </section>

      {selectedRequest && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal medicine-request-modal bhc-request-view-sheet" aria-label="Medicine request details">
            <header>
              <div>
                <span className="bhc-request-sheet-eyebrow">Barangay Health Center · Medicine Supply</span><h2>Medicine Request Details</h2>
                <p>Request Code: {selectedRequest.id}</p>
              </div>
              <button type="button" aria-label="Close request details" onClick={() => setSelectedRequest(null)}>
                x
              </button>
            </header>
            <div className="bhc-request-sheet-body">
              <div className="bhc-request-sheet-summary"><div><span>Request Reference</span><strong>{selectedRequest.id}</strong></div><div><span>Status</span><strong>{selectedRequest.status}</strong></div></div>
              <section><h3>Request Information</h3><dl>{[['Requested From', selectedRequest.requestedFrom], ['Requested By', selectedRequest.pickUpBy], ['Address / Barangay', selectedRequest.address], ['Request Date', selectedRequest.dateRequested ? new Date(selectedRequest.dateRequested).toLocaleDateString('en-PH') : null]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl></section>
              <section><h3>Requested Medicine</h3><dl><div><dt>Medicine Name</dt><dd>{selectedRequest.medicineName}</dd></div><div><dt>Requested Quantity</dt><dd>{selectedRequest.quantity} unit(s)</dd></div></dl></section>
              <section><h3>Dispatch & Receipt</h3><dl><div><dt>Dispatch Date</dt><dd>{selectedRequest.dispatchedAt ? new Date(selectedRequest.dispatchedAt).toLocaleString('en-PH') : 'Not recorded'}</dd></div><div><dt>Receipt Date</dt><dd>{selectedRequest.receivedAt ? new Date(selectedRequest.receivedAt).toLocaleString('en-PH') : 'Not recorded'}</dd></div></dl></section>
            </div>
            <div className="patient-form-actions"><button type="button" onClick={() => setSelectedRequest(null)}>Close</button></div>
          </section>
        </div>
      )}
    </>
  )
}

export default BHCMedicineRequests
