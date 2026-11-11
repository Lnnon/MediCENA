import { useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Eye, Printer, RotateCcw, Search, Truck, X } from 'lucide-react'

const formatDate = (value, fallback = 'Not recorded') => value
  ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
  : fallback

const dispatchDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function PharmacistTransfers({ requests }) {
  const [filters, setFilters] = useState({ search: '', bhc: '', status: '', date: '' })
  const [selectedRequest, setSelectedRequest] = useState(null)
  const transfers = requests.filter((item) => ['dispatched', 'released'].includes(item.rawStatus))
  const facilities = [...new Set(transfers.map((item) => item.bhc))].sort()
  const rows = transfers.filter((item) =>
    [item.bhc, item.barangay, item.medicine, item.id, item.dispatchedBy, item.receivedBy]
      .some((value) => String(value || '').toLowerCase().includes(filters.search.trim().toLowerCase())) &&
    (!filters.bhc || item.bhc === filters.bhc) &&
    (!filters.status || item.rawStatus === filters.status) &&
    (!filters.date || dispatchDate(item.dispatchedAt) === filters.date),
  )
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }))
  const receiptDate = (item) => formatDate(item.receivedAt, item.rawStatus === 'released' ? 'Receipt date not recorded' : 'Awaiting BHC confirmation')

  return (
    <>
      <div className="cho-page-heading">
        <div>
          <span>Medicine Distribution</span>
          <h1>Dispatch & Receipt Records</h1>
          <p>Track CHO medicine dispatches and receipt confirmations from Barangay Health Centers.</p>
        </div>
        <div className="reports-actions">
          <button type="button" onClick={() => window.print()}><Printer size={15} />Print Records</button>
        </div>
      </div>

      <section className="cho-patient-page cho-medicine-request-page pharmacist-transfers-page">
        <aside className="cho-filter-panel">
          <h2>Filter Records</h2>
          <label>
            <span>Search</span>
            <div><Search size={15} /><input type="search" placeholder="Search request or medicine..." value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} /></div>
          </label>
          <label>
            <span>Receiving BHC</span>
            <select value={filters.bhc} onChange={(event) => updateFilter('bhc', event.target.value)}>
              <option value="">All Health Centers</option>
              {facilities.map((facility) => <option key={facility}>{facility}</option>)}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">All Statuses</option>
              <option value="dispatched">Awaiting BHC Receipt</option>
              <option value="released">Received by BHC</option>
            </select>
          </label>
          <label>
            <span>Dispatch Date</span>
            <div><CalendarDays size={15} /><input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} /></div>
          </label>
          <button className="filter-button" type="button" onClick={() => setFilters({ search: '', bhc: '', status: '', date: '' })}><RotateCcw size={15} />Reset Filters</button>
        </aside>

        <article className="cho-patient-list-panel cho-medicine-request-panel">
          <h2>Dispatch & Receipt List ({rows.length})</h2>
          {rows.length ? (
            <div className="cho-medicine-request-table-wrap">
              <table className="cho-medicine-request-table">
                <thead><tr><th>Request ID</th><th>BHC / Barangay</th><th>Medicine / Quantity</th><th>Dispatch</th><th>Receipt</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.backendId}>
                      <td><strong>{item.id}</strong></td>
                      <td><strong>{item.bhc}</strong><span>{item.barangay}</span></td>
                      <td><strong>{item.medicine}</strong><span>Qty: {item.quantity} unit(s)</span></td>
                      <td><strong>{item.dispatchedBy || 'Personnel not recorded'}</strong><span>{formatDate(item.dispatchedAt, 'Legacy dispatch — date not recorded')}</span></td>
                      <td><strong>{item.receivedBy || (item.rawStatus === 'released' ? 'Personnel not recorded' : 'Awaiting receipt')}</strong><span>{receiptDate(item)}</span></td>
                      <td><span className={`cho-request-status ${item.rawStatus === 'released' ? 'delivered' : 'approved'}`}>{item.rawStatus === 'released' ? <CheckCircle2 size={12} /> : <Truck size={12} />}{item.rawStatus === 'released' ? 'Received by BHC' : 'Dispatched'}</span></td>
                      <td><div className="cho-request-actions"><button className="request-view-button" type="button" onClick={() => setSelectedRequest(item)}><Eye size={13} />View</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="patient-alert"><AlertTriangle size={16} />{transfers.length ? 'No records match your filters.' : 'No dispatched medicines or receipt records yet.'}</div>}
        </article>
      </section>

      {selectedRequest && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal cho-medicine-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-details-title">
            <header><div><h2 id="transfer-details-title">{selectedRequest.medicine}</h2><p>Request ID: {selectedRequest.id}</p></div><button type="button" aria-label="Close dispatch details" onClick={() => setSelectedRequest(null)}><X size={18} /></button></header>
            <div className="referral-log">
              <p><strong>Receiving BHC:</strong> {selectedRequest.bhc}</p>
              <p><strong>Barangay:</strong> {selectedRequest.barangay}</p>
              <p><strong>Requested by:</strong> {selectedRequest.requestedBy}</p>
              <p><strong>Quantity:</strong> {selectedRequest.quantity} unit(s)</p>
              <p><strong>Dispatched by:</strong> {selectedRequest.dispatchedBy || 'Not recorded'}</p>
              <p><strong>Dispatch date:</strong> {formatDate(selectedRequest.dispatchedAt)}</p>
              <p><strong>Received by:</strong> {selectedRequest.receivedBy || 'Not recorded'}</p>
              <p><strong>Receipt date:</strong> {receiptDate(selectedRequest)}</p>
              <p><strong>Status:</strong> {selectedRequest.rawStatus === 'released' ? 'Received by BHC' : 'Awaiting BHC receipt'}</p>
            </div>
            <div className="patient-form-actions"><button type="button" onClick={() => setSelectedRequest(null)}><X size={15} />Close</button></div>
          </section>
        </div>
      )}
    </>
  )
}
export default PharmacistTransfers
