import { useEffect, useState } from 'react'
import { AlertTriangle, Boxes, ClipboardList, PackageCheck, Search, Truck } from 'lucide-react'
import { fetchMedicineInventory, fetchMedicineRequestsForCho, fetchPatientMedicineDistributions } from '../../../services/medicines'
import './CHOReferralLayout.css'
import './CHOMedicineLayout.css'

const date = (value) => value ? new Date(value).toLocaleDateString('en-PH') : '—'
const isExpired = (value) => value && value < new Date().toLocaleDateString('en-CA')

function CHOMedicineMonitoring({ initialView = 'inventory' }) {
  const view = initialView
  const [data, setData] = useState({ inventory: [], requests: [], distributions: [] })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [facility, setFacility] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [inventory, requests, distributions] = await Promise.all([fetchMedicineInventory(true), fetchMedicineRequestsForCho(), fetchPatientMedicineDistributions()])
        if (active) { setData({ inventory, requests, distributions }); setError('') }
      } catch { if (active) setError('Unable to refresh medicine monitoring. Please reload or wait for the next update.') }
      finally { if (active) setLoading(false) }
    }
    load()
    const timer = window.setInterval(load, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  const matches = (values) => values.some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()))
  const inventory = data.inventory.filter((item) => (!facility || item.facility === facility) && matches([item.name, item.type, item.dosage, item.facility]) && (!status || (status === 'low' && item.stocks <= 10) || (status === 'expired' && isExpired(item.expiry))))
  const requests = data.requests.filter((item) => (!facility || item.bhc === facility) && (!status || item.rawStatus === status) && matches([item.id, item.medicine, item.bhc, item.requestedBy]))
  const distributions = data.distributions.filter((item) => (!facility || item.facility === facility) && matches([item.patientName, item.medicineName, item.facility, item.distributedBy]))
  const facilities = [...new Set(view === 'requests' ? data.requests.map((item) => item.bhc) : view === 'distributions' ? data.distributions.map((item) => item.facility) : data.inventory.map((item) => item.facility))].sort()
  const stats = [['Inventory Items', data.inventory.length, Boxes], ['Low Stock Items', data.inventory.filter((item) => item.stocks <= 10).length, AlertTriangle], ['Pending Pharmacy Review', data.requests.filter((item) => item.rawStatus === 'requested').length, ClipboardList], ['Awaiting BHC Receipt', data.requests.filter((item) => item.rawStatus === 'dispatched').length, Truck]]
  return <div className={`cho-referral-styled cho-medicine-styled cho-medicine-${view}`}>
    <div className="cho-page-heading"><div><span>CHO Oversight · Pharmacy & BHC</span><h1>{{ inventory: 'Stock Monitoring', requests: 'Request & Delivery Monitoring', distributions: 'Patient Distributions' }[view]}</h1><p>{{ inventory: 'Monitor citywide medicine availability, low stock, and expiry.', requests: 'Monitor pharmacy processing, dispatches, and BHC receipt confirmations.', distributions: 'Monitor medicines released to patients by their Barangay Health Centers.' }[view]}</p></div></div>
    {error && <p className="patient-alert" role="alert">{error}</p>}
    <section className="cho-stats-grid cho-monitor-stats">{stats.map(([label, count, Icon]) => <article className="cho-stat-card" key={label}><div className="cho-stat-icon"><Icon size={24} /></div><span>{label}</span><strong>{loading ? '—' : count}</strong></article>)}</section>
    <article className="cho-panel"><div className="cho-monitor-toolbar"><label><Search size={16} /><input type="search" aria-label="Search medicine monitoring" placeholder="Search medicine, facility, request, or patient" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Filter facility" value={facility} onChange={(event) => setFacility(event.target.value)}><option value="">All facilities</option>{facilities.map((item) => <option key={item}>{item}</option>)}</select>{view !== 'distributions' && <select aria-label="Filter stock or request status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{(view === 'inventory' ? [['low', 'Low stock (10 or fewer)'], ['expired', 'Expired']] : [['requested', 'Awaiting pharmacy review'], ['approved', 'Approved'], ['dispatched', 'Awaiting BHC receipt'], ['released', 'Received by BHC'], ['declined', 'Declined']]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>}</div>
      {loading ? <p role="status">Loading medicine monitoring…</p> : <div className="cho-medicine-request-table-wrap"><table className="cho-medicine-request-table">
        {view === 'inventory' ? <><thead><tr><th>Medicine</th><th>Facility</th><th>Available Stock</th><th>Expiry</th><th>Stock Condition</th></tr></thead><tbody>{inventory.map((item) => <tr key={item.backendId}><td><strong>{item.name}</strong><span>{item.type} · {item.dosage}</span></td><td>{item.facility}</td><td>{item.stocks}</td><td>{date(item.expiry)}</td><td><span className={`cho-request-status ${item.stocks <= 10 || isExpired(item.expiry) ? 'pending' : 'approved'}`}>{isExpired(item.expiry) ? 'Expired' : item.stocks === 0 ? 'Out of stock' : item.stocks <= 10 ? 'Low stock' : 'Available'}</span></td></tr>)}</tbody></> : view === 'requests' ? <><thead><tr><th>Request / Medicine</th><th>Receiving BHC</th><th>Quantity</th><th>Requested By</th><th>Status</th><th>Dispatched By / Date</th><th>Received By / Date</th></tr></thead><tbody>{requests.map((item) => <tr key={item.backendId}><td><strong>{item.id}</strong><span>{item.medicine}</span></td><td>{item.bhc}</td><td>{item.quantity}</td><td>{item.requestedBy}</td><td><span className={`cho-request-status ${item.rawStatus === 'released' ? 'delivered' : ['approved', 'dispatched'].includes(item.rawStatus) ? 'approved' : 'pending'}`}>{item.status}</span></td><td>{item.dispatchedBy || '—'}<span>{date(item.dispatchedAt)}</span></td><td>{item.receivedBy || '—'}<span>{date(item.receivedAt)}</span></td></tr>)}</tbody></> : <><thead><tr><th>Patient</th><th>Medicine</th><th>Quantity</th><th>Releasing BHC</th><th>Released By</th><th>Date</th></tr></thead><tbody>{distributions.map((item) => <tr key={item.backendId}><td>{item.patientName}</td><td>{item.medicineName}</td><td>{item.quantity}</td><td>{item.facility}</td><td>{item.distributedBy}</td><td>{date(item.distributedAt)}</td></tr>)}</tbody></>}
      </table>{!(view === 'inventory' ? inventory.length : view === 'requests' ? requests.length : distributions.length) && <p>No records match your filters.</p>}</div>}
      <p className="cho-monitor-note"><PackageCheck size={16} />Pharmacists process supply requests and dispatch stock. BHC staff confirm receipt and record patient releases.</p>
    </article>
  </div>
}
export default CHOMedicineMonitoring
