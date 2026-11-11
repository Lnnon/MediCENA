import { AlertTriangle, Ambulance, CalendarDays, ClipboardList, FileCheck2, PackageCheck, Stethoscope, Truck, Users } from 'lucide-react'

const formatDate = (date) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(date))
const badgeClass = (status) => ['completed', 'released'].includes(status) ? 'delivered' : ['approved', 'dispatched', 'accepted'].includes(status) ? 'approved' : 'pending'

function OverviewPanel({ title, subtitle, icon: Icon, rows, emptyMessage, onOpen, action }) {
  return <article className="cho-panel">
    <div className="cho-panel-heading"><div><span>{subtitle}</span><h2>{title}</h2></div><Icon size={20} /></div>
    <div className="cho-table">{rows.length ? rows.slice(0, 5).map((row) => <div className="cho-table-row" key={row.id}><div><strong>{row.title}</strong><span>{row.description}</span></div><span className={`cho-request-status ${badgeClass(row.status)}`}>{row.statusLabel || row.status}</span><time>{row.date ? formatDate(row.date) : '—'}</time></div>) : <div className="role-empty-state">{emptyMessage}</div>}</div>
    <button className="role-panel-action" type="button" onClick={onOpen}>{action} <span aria-hidden="true">→</span></button>
  </article>
}

function RoleOverview({ role, data, loading, onNavigate }) {
  const opd = role === 'opd'
  const incoming = opd ? data.referrals.filter((item) => !item.assignedDoctorId && ['pending', 'seen'].includes(item.status)) : []
  const assigned = opd ? data.referrals.filter((item) => item.assignedDoctorId && !['completed', 'cancelled', 'rejected'].includes(item.status)) : []
  const lowStock = opd ? [] : data.inventory.filter((item) => Number(item.stocks) <= 10)
  const pendingRequests = opd ? [] : data.requests.filter((item) => item.rawStatus === 'requested')
  const awaitingReceipt = opd ? [] : data.requests.filter((item) => item.rawStatus === 'dispatched')
  const stats = opd ? [
    ['Total Patients', data.patients.length, Users], ['Incoming Referrals', incoming.length, Ambulance], ['Assigned Referrals', assigned.length, Stethoscope], ['Completed Referrals', data.referrals.filter((item) => item.status === 'completed').length, FileCheck2],
  ] : [
    ['Inventory Items', data.inventory.length, PackageCheck], ['Low Stock Items', lowStock.length, AlertTriangle], ['Pending Requests', pendingRequests.length, ClipboardList], ['Awaiting Receipt', awaitingReceipt.length, Truck],
  ]
  const referralRows = (items) => items.map((item) => ({ id: item.id, title: item.patient, description: `${item.referredFrom} · ${item.specialty}`, status: item.status, date: item.date }))
  const requestRows = (items) => items.map((item) => ({ id: item.backendId, title: item.medicine, description: `${item.bhc} · ${item.quantity} unit(s)`, status: item.rawStatus, statusLabel: item.status, date: item.dispatchedAt || item.date }))
  return <>
    <div className="cho-page-heading"><div><span>{opd ? 'Outpatient Department' : 'CHO Pharmacy'}</span><h1>Dashboard</h1><p>{opd ? 'Monitor incoming referrals, doctor assignments, and patient progress.' : 'Monitor medicine stocks, BHC supply requests, and distribution progress.'}</p></div><div className="cho-date-card"><CalendarDays size={18} /><span>{new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' }).format(new Date())}</span></div></div>
    {loading ? <p className="patient-alert" role="status">Loading dashboard data…</p> : <>
      <section className="cho-stats-grid role-stats-grid" aria-label="Department summary">{stats.map(([label, value, Icon]) => <article className="cho-stat-card" key={label}><div className="cho-stat-icon"><Icon size={24} /></div><span>{label}</span><strong>{Number(value).toLocaleString()}</strong></article>)}</section>
      <section className="cho-content-grid role-content-grid">
        {opd ? <>
          <OverviewPanel title="Incoming Referrals" subtitle="BHC submissions" icon={Ambulance} rows={referralRows(incoming)} emptyMessage="No incoming referrals waiting for review." onOpen={() => onNavigate('incoming')} action="View incoming referrals" />
          <OverviewPanel title="Assigned Patients" subtitle="Doctor coordination" icon={Stethoscope} rows={referralRows(assigned)} emptyMessage="No active doctor assignments yet." onOpen={() => onNavigate('referrals')} action="Manage referrals" />
          <OverviewPanel title="Recent Referral Activity" subtitle="Patient progress" icon={ClipboardList} rows={referralRows(data.referrals)} emptyMessage="Referral activity will appear here." onOpen={() => onNavigate('referrals')} action="View referral progress" />
        </> : <>
          <OverviewPanel title="Medicine Requests" subtitle="BHC supply coordination" icon={ClipboardList} rows={requestRows(pendingRequests)} emptyMessage="No medicine requests awaiting approval." onOpen={() => onNavigate('medicineRequests')} action="Review medicine requests" />
          <OverviewPanel title="Low Stock Medicines" subtitle="Inventory monitoring · 10 units or fewer" icon={AlertTriangle} rows={lowStock.map((item) => ({ id: item.backendId, title: item.name, description: `${item.type} · ${item.dosage}`, status: 'pending', statusLabel: `${item.stocks} units`, date: item.expiry }))} emptyMessage="No low stock medicines." onOpen={() => onNavigate('inventory')} action="View inventory" />
          <OverviewPanel title="Dispatched Supplies" subtitle="Awaiting BHC confirmation" icon={Truck} rows={requestRows(awaitingReceipt)} emptyMessage="No dispatched supplies awaiting receipt." onOpen={() => onNavigate('medicineRequests')} action="View request records" />
        </>}
        <article className="cho-panel"><div className="cho-panel-heading"><div><span>Health coordination</span><h2>{opd ? 'Referral Workflow' : 'Medicine Supply Workflow'}</h2></div><FileCheck2 size={20} /></div><ol className="role-workflow-list">{(opd ? ['BHC submits patient referral', 'OPD reviews and assigns a doctor', 'Doctor accepts and records consultation', 'Patient follows referral progress'] : ['BHC submits supply request', 'Pharmacist approves and dispatches', 'BHC confirms medicine receipt', 'BHC releases medicine to patients']).map((step) => <li key={step}>{step}</li>)}</ol><button type="button" className="role-panel-action" onClick={() => onNavigate('reports')}>{opd ? 'Generate referral reports' : 'Generate pharmacy reports'} <span aria-hidden="true">→</span></button></article>
      </section>
    </>}
  </>
}
export default RoleOverview
