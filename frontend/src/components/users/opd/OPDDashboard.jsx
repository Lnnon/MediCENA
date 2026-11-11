import useDepartmentOverview from '../shared/useDepartmentOverview'
import '../shared/MedicalWorkspace.css'
import { useCallback, useState } from 'react'
import { getStoredUser, getUserDisplayName } from '../../../services/authUser'
import { fetchPatients } from '../../../services/patients'
import { fetchReferrals } from '../../../services/referrals'
import { fetchNotifications, markNotificationRead, markNotificationsRead } from '../../../services/notifications'
import CHOIncomingReferrals from '../cho/CHOIncomingReferrals'
import CHOSettings from '../cho/CHOSettings'
import ProfilePage from '../shared/ProfilePage'
import NotificationsPage from '../shared/NotificationsPage'
import ReportsPage from '../shared/ReportsPage'
import OPDReferralManagement from './OPDReferralManagement'
import OPDNavbar from './OPDNavbar'
import RoleOverview from '../shared/RoleOverview'
import '../cho/CHOStyle.css'
import './OPDStyle.css'
import '../shared/DepartmentWorkspaceUI.css'
import './OPDWorkspaceUI.css'
import './OPDReferralUI.css'
import './OPDMedicalForms.css'
import './OPDPageLayout.css'

const validPages = ['dashboard', 'incoming', 'referrals', 'reports', 'profile', 'settings', 'notifications']

function OPDDashboard({ onLogout }) {
  const [page, setPage] = useState('dashboard')
  const title = 'Outpatient Department'
  const load = useCallback(async () => {
    const [patients, referrals, notices] = await Promise.all([
      fetchPatients(), fetchReferrals(), fetchNotifications(),
    ])
    return { data: { patients, referrals }, notices }
  }, [])

  const { data, notifications, setNotifications, error, loading, refreshAfterSave } = useDepartmentOverview(load, { patients: [], referrals: [] })

  const openNotification = async (notification) => {
    await markNotificationRead(notification.id).catch(() => null)
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item))
    const target = ['referred', 'patients', 'trackPatients'].includes(notification.targetPage) ? 'referrals' : notification.targetPage
    setPage(validPages.includes(target) ? target : 'dashboard')
  }
  return <div className="medical-workspace cho-shell role-dashboard opd-shell">
    <OPDNavbar
      page={page}
      onNavigate={(target) => setPage(validPages.includes(target) ? target : 'dashboard')}
      onLogout={onLogout}
      currentUserName={getUserDisplayName(getStoredUser())}
      notifications={notifications}
      onNotificationOpen={openNotification}
    />
    <main className={`cho-main ${page !== 'dashboard' ? 'opd-content-page' : ''} ${['incoming', 'referrals'].includes(page) ? 'opd-referral-ui' : ''}`}>
      {error && <p className="patient-alert" role="alert">{error}</p>}
      {page === 'incoming' ? <CHOIncomingReferrals onReferralAccepted={refreshAfterSave} />
        : page === 'referrals' ? <OPDReferralManagement referrals={data.referrals} onSaved={refreshAfterSave} />
        : page === 'reports' ? <ReportsPage role="opd" />
        : page === 'profile' ? <ProfilePage roleLabel={title} />
        : page === 'settings' ? <CHOSettings />
        : page === 'notifications' ? <NotificationsPage notifications={notifications} onNotificationOpen={openNotification} onMarkAllRead={async () => { await markNotificationsRead(notifications); await refreshAfterSave() }} />
        : <RoleOverview role="opd" data={data} loading={loading} onNavigate={setPage} />}
    </main>
  </div>
}

export default OPDDashboard
