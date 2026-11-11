import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Eye, Filter, PackageCheck, Search, Truck, X } from 'lucide-react'
import { findMedicineAvailability } from '../../../services/medicines'
import '../pharmacist/PharmacistRequestList.css'

function CHOMedicineRequests({ requests, onApproveRequest, onUpdateRequestStatus, onCheckAvailability, patientListLayout = false }) {
  const [requestTab, setRequestTab] = useState('current')
  const [pageIndex, setPageIndex] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ search: '', barangay: '', date: '' })
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [dispatchRequest, setDispatchRequest] = useState(null)
  const [availableMedicine, setAvailableMedicine] = useState(null)
  const [availabilityMessage, setAvailabilityMessage] = useState('')
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [actionError, setActionError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const approve = async (request) => {
    setIsUpdating(true)
    try { await onApproveRequest(request.backendId); setActionError('') }
    catch { setActionError('Unable to approve this request. Refresh and retry.') }
    finally { setIsUpdating(false) }
  }
  const decline = async (request) => {
    setIsUpdating(true)
    try { await onUpdateRequestStatus(request.backendId, 'declined'); setActionError('') }
    catch { setActionError('Unable to decline this request. Refresh and retry.') }
    finally { setIsUpdating(false) }
  }

  const barangays = [...new Set(requests.map((request) => request.barangay))]

  const tabStatuses = { current: ['approved', 'dispatched'], new: ['requested'], past: ['released', 'declined'] }

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const searchText = filters.search.toLowerCase()
      const matchesSearch =
        String(request.id || '').toLowerCase().includes(searchText) ||
        String(request.bhc || '').toLowerCase().includes(searchText) ||
        String(request.medicine || '').toLowerCase().includes(searchText) ||
        String(request.requestedBy || '').toLowerCase().includes(searchText)

      return (
        (!patientListLayout || ({ current: ['approved', 'dispatched'], new: ['requested'], past: ['released', 'declined'] })[requestTab].includes(request.rawStatus)) &&
        matchesSearch &&
        (!filters.barangay || request.barangay === filters.barangay) &&
        (!filters.date || request.date === filters.date)
      )
    })
  }, [filters, requests, requestTab, patientListLayout])

  const updateFilter = (field, value) => {
    setPageIndex(0)
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  const pageCount = Math.max(1, Math.ceil(filteredRequests.length / 10))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const displayedRequests = patientListLayout ? filteredRequests.slice(currentPage * 10, currentPage * 10 + 10) : filteredRequests

  const getStatusClass = (status) => {
    if (status === 'Delivered') return 'delivered'
    if (status === 'Approved' || status === 'Dispatched') return 'approved'
    return 'pending'
  }

  const openDispatchForm = async (request) => {
    setDispatchRequest(request)
    setAvailableMedicine(null)
    setAvailabilityMessage('')
    setIsCheckingAvailability(true)

    try {
      const medicine = await findMedicineAvailability(request.medicine, request.medicineId)
      setAvailableMedicine(medicine)
      setAvailabilityMessage(medicine ? '' : 'No matching medicine stock was found in CHO inventory.')
    } catch {
      setAvailabilityMessage('Unable to check medicine availability.')
    } finally {
      setIsCheckingAvailability(false)
    }
  }

  const handleDispatchSubmit = async (event) => {
    event.preventDefault()
    const requestedQuantity = Number(dispatchRequest.quantity || 0)

    if (!availableMedicine || Number(availableMedicine.stocks || 0) < requestedQuantity) {
      setAvailabilityMessage('Available stock is not enough for this dispatch.')
      return
    }

    try {
      setIsUpdating(true)
      await onUpdateRequestStatus(dispatchRequest.backendId, 'dispatched')
      setDispatchRequest(null)
      setAvailableMedicine(null)
      setAvailabilityMessage('')
    } catch {
      setAvailabilityMessage('Unable to dispatch this medicine request. Stock may have changed; refresh and retry.')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className={patientListLayout ? `pharmacist-request-list ${showFilters ? 'filters-open' : ''}` : ''}>
      <div className="cho-page-heading">
        <div>
          <span>Medicine</span>
          <h1>Medicine Requests ({filteredRequests.length})</h1>
          <p>Review medicine requests submitted by BHC and barangay offices.</p>
        </div>
      </div>

      {actionError && <p className="patient-alert" role="alert">{actionError}</p>}
      {patientListLayout && <div className="pharma-request-tabs" aria-label="Medicine request categories">{[['current', 'Current Request'], ['new', 'New Request'], ['past', 'Past Request']].map(([key, label]) => <button type="button" key={key} aria-pressed={requestTab === key} onClick={() => { setRequestTab(key); setPageIndex(0) }}>{label}<span>{requests.filter((request) => tabStatuses[key].includes(request.rawStatus)).length}</span></button>)}</div>}
      <section className="cho-patient-page cho-medicine-request-page">
        <aside className="cho-filter-panel">
          <h2>Filter Request</h2>
          <label>
            <span>Search</span>
            <div>
              <Search size={15} />
              <input
                type="search"
                placeholder="Search request..."
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
            <span>Date</span>
            <div>
              <CalendarDays size={15} />
              <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
            </div>
          </label>
          <button className="filter-button" type="button" aria-expanded={showFilters} onClick={() => setShowFilters((current) => !current)}>
            <Filter size={15} />
            Filter
          </button>
        </aside>

        <article className="cho-patient-list-panel cho-medicine-request-panel">
          <h2>Request List</h2>

          {filteredRequests.length > 0 ? (
            <div className="cho-medicine-request-table-wrap">
              <table className="cho-medicine-request-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>BHC / Barangay</th>
                    <th>Medicine Request</th>
                    <th>Requested By</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRequests.map((request) => (
                    <tr key={request.id}>
                      <td><strong>{request.id}</strong></td>
                      <td>
                        <strong>{request.bhc}</strong>
                        <span>{request.barangay}</span>
                      </td>
                      <td>
                        <strong>{request.medicine}</strong>
                        <span>Qty: {request.quantity}</span>
                      </td>
                      <td>{request.requestedBy}</td>
                      <td>{new Date(request.date).toLocaleDateString()}</td>
                      <td>
                        <span className={`cho-request-status ${getStatusClass(request.status)}`}>
                          <CheckCircle2 size={12} />
                          {request.status}
                        </span>
                      </td>
                      <td>
                        <div className="cho-request-actions">
                          <button className="request-view-button" type="button" onClick={() => setSelectedRequest(request)}>
                            <Eye size={13} />
                            View
                          </button>
                          {request.status === 'Pending Approval' && (
                            <button
                              className="request-approve-button"
                              type="button"
                              disabled={isUpdating}
                              onClick={() => approve(request)}
                            >
                              <CheckCircle2 size={13} />
                              Approve
                            </button>
                          )}
                          {request.status === 'Approved' && (
                            <button
                              className="request-dispatch-button"
                              type="button"
                              onClick={() => openDispatchForm(request)}
                            >
                              <Truck size={13} />
                              Dispatch
                            </button>
                          )}
                          {['requested', 'approved'].includes(request.rawStatus) && <button className="request-reject-button" type="button" disabled={isUpdating} onClick={() => decline(request)}>Decline</button>}
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
              No medicine requests found!
            </div>
          )}
          {patientListLayout && <footer className="pharma-request-pagination"><button type="button" disabled={!currentPage} onClick={() => setPageIndex(currentPage - 1)}>← Previous</button><nav aria-label="Medicine request pages">{Array.from({ length: pageCount }, (_, index) => index).filter((index) => index === 0 || index === pageCount - 1 || Math.abs(index - currentPage) <= 1).map((index, position, pages) => <span key={index}>{position > 0 && index - pages[position - 1] > 1 && <span aria-hidden="true">…</span>}<button type="button" aria-label={`Page ${index + 1}`} aria-current={index === currentPage ? 'page' : undefined} onClick={() => setPageIndex(index)}>{index + 1}</button></span>)}</nav><button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPageIndex(currentPage + 1)}>Next →</button></footer>}
        </article>
      </section>

      {selectedRequest && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal cho-medicine-modal pharma-request-view" aria-label="Medicine request details">
            <header>
              <div>
                <span className="pharma-form-eyebrow">City Health Office · Pharmacy</span><h2>Medicine Supply Request</h2>
                <p>Request ID: {selectedRequest.id}</p>
              </div>
              <button type="button" aria-label="Close request details" onClick={() => setSelectedRequest(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="pharma-request-sheet">
              <div className="pharma-request-sheet-summary"><div><span>Request Reference</span><strong>{selectedRequest.id}</strong></div><div><span>Status</span><strong>{selectedRequest.status}</strong></div></div>
              <section><h3>Requesting Health Center</h3><dl>{[['BHC', selectedRequest.bhc], ['Barangay', selectedRequest.barangay], ['Requested By', selectedRequest.requestedBy], ['Request Date', selectedRequest.date ? new Date(selectedRequest.date).toLocaleDateString('en-PH') : 'Not recorded']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl></section>
              <section><h3>Requested Medicine</h3><dl><div><dt>Medicine Name</dt><dd>{selectedRequest.medicine}</dd></div><div><dt>Requested Quantity</dt><dd>{selectedRequest.quantity} unit(s)</dd></div></dl></section>
              <section><h3>Dispatch & Receipt</h3><dl>{[['Dispatched By', selectedRequest.dispatchedBy], ['Dispatch Date', selectedRequest.dispatchedAt ? new Date(selectedRequest.dispatchedAt).toLocaleString('en-PH') : null], ['Received By', selectedRequest.receivedBy], ['Receipt Date', selectedRequest.receivedAt ? new Date(selectedRequest.receivedAt).toLocaleString('en-PH') : null]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl></section>
            </div>
            <div className="patient-form-actions">
              <button type="button" onClick={() => setSelectedRequest(null)}><X size={15} />Close</button>
              {selectedRequest.rawStatus === 'approved' && (
                <button
                  className="request-dispatch-button"
                  type="button"
                  onClick={() => {
                    onCheckAvailability(selectedRequest)
                    setSelectedRequest(null)
                  }}
                >
                  <PackageCheck size={14} />
                  Check Medicine Availability
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {dispatchRequest && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal cho-medicine-modal" aria-label="Dispatch medicine request form">
            <header>
              <div>
                <h2>Dispatch Medicine</h2>
                <p>Request ID: {dispatchRequest.id}</p>
              </div>
              <button
                type="button"
                aria-label="Close dispatch form"
                onClick={() => {
                  setDispatchRequest(null)
                  setAvailableMedicine(null)
                  setAvailabilityMessage('')
                }}
              >
                <X size={18} />
              </button>
            </header>

            <form className="patient-form" onSubmit={handleDispatchSubmit}>
              <label>
                <span>Medicine Name</span>
                <input name="medicineName" type="text" value={dispatchRequest.medicine} readOnly />
              </label>
              <label>
                <span>Quantity</span>
                <input name="quantity" type="number" min="1" value={dispatchRequest.quantity} readOnly />
              </label>
              <label className="full">
                <span>Note</span>
                <input
                  type="text"
                  value={
                    isCheckingAvailability
                      ? 'Checking available stocks...'
                      : `Available stocks: ${availableMedicine ? availableMedicine.stocks : 0}`
                  }
                  readOnly
                />
                {availabilityMessage && <small>{availabilityMessage}</small>}
              </label>

              <div className="patient-form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setDispatchRequest(null)
                    setAvailableMedicine(null)
                    setAvailabilityMessage('')
                  }}
                >
                  <X size={15} />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isUpdating ||
                    isCheckingAvailability ||
                    !availableMedicine ||
                    Number(availableMedicine.stocks || 0) < Number(dispatchRequest.quantity || 0)
                  }
                >
                  <Truck size={15} />
                  Dispatch
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default CHOMedicineRequests
