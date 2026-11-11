import useDepartmentOverview from '../shared/useDepartmentOverview'
import '../shared/MedicalWorkspace.css'
import { useCallback, useState } from 'react'
import { getStoredUser, getUserDisplayName } from '../../../services/authUser'
import { fetchMedicineInventory, fetchMedicineRequestsForCho, updateMedicineRequest } from '../../../services/medicines'
import { fetchNotifications, markNotificationRead, markNotificationsRead } from '../../../services/notifications'
import CHOMedicineDistribution from '../cho/CHOMedicineDistribution'
import CHOMedicineRequests from '../cho/CHOMedicineRequests'
import CHOSettings from '../cho/CHOSettings'
import ProfilePage from '../shared/ProfilePage'
import NotificationsPage from '../shared/NotificationsPage'
import ReportsPage from '../shared/ReportsPage'
import PharmacistNavbar from './PharmacistNavbar'
import RoleOverview from '../shared/RoleOverview'
import '../cho/CHOStyle.css'
import './PharmacistStyle.css'
import '../shared/DepartmentWorkspaceUI.css'

const validPages = ['dashboard', 'inventory', 'medicineRequests', 'reports', 'profile', 'settings', 'notifications']

function PharmacistDashboard({ onLogout }) {
  const [page, setPage] = useState('dashboard')
  const title = 'CHO Pharmacy'
  const load = useCallback(async () => {
    const [inventory, requests, notices] = await Promise.all([
      fetchMedicineInventory(), fetchMedicineRequestsForCho(), fetchNotifications(),
    ])
    return { data: { inventory, requests }, notices }
  }, [])

  const { data, notifications, setNotifications, error, loading, refreshAfterSave } = useDepartmentOverview(load, { requests: [], inventory: [] })

  const updateRequest = async (id, status) => {
    await updateMedicineRequest(id, { status })
    await refreshAfterSave()
  }
  const openNotification = async (notification) => {
    await markNotificationRead(notification.id).catch(() => null)
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item))
    const target = ['transfers', 'distribution'].includes(notification.targetPage) ? 'medicineRequests' : notification.targetPage
    setPage(validPages.includes(target) ? target : 'dashboard')
  }
  return <div className="medical-workspace cho-shell role-dashboard pharmacist-shell">
    <PharmacistNavbar
      page={page}
      onNavigate={setPage}
      onLogout={onLogout}
      currentUserName={getUserDisplayName(getStoredUser())}
      notifications={notifications}
      onNotificationOpen={openNotification}
    />
    <main className="cho-main">
      {error && <p className="patient-alert" role="alert">{error}</p>}
      {page === 'inventory' ? <CHOMedicineDistribution onDistribute={() => setPage('medicineRequests')} />
        : page === 'medicineRequests' ? <CHOMedicineRequests patientListLayout requests={data.requests} onApproveRequest={(id) => updateRequest(id, 'approved')} onUpdateRequestStatus={updateRequest} onCheckAvailability={() => setPage('inventory')} />
        : page === 'reports' ? <ReportsPage role="pharmacist" />
        : page === 'profile' ? <ProfilePage roleLabel={title} />
        : page === 'settings' ? <CHOSettings />
        : page === 'notifications' ? <NotificationsPage notifications={notifications} onNotificationOpen={openNotification} onMarkAllRead={async () => { await markNotificationsRead(notifications); await refreshAfterSave() }} />
        : <RoleOverview role="pharmacist" data={data} loading={loading} onNavigate={setPage} />}
    </main>
  </div>
}

export default PharmacistDashboard
