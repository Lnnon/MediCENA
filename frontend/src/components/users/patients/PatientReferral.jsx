import '../shared/MedicalWorkspace.css'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  FileText,
  HeartPulse,
  Loader2,
  MapPin,
  Pill,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import PatientNavbar from './PatientNavbar'
import PatientCurrentReferral from './PatientCurrentReferral'
import PatientMedicineRequest from './PatientMedicineRequest'
import PatientPastReferrals from './PatientPastReferrals'
import PatientSettings from './PatientSettings'
import { getStoredUser } from '../../../services/authUser'
import { fetchPatientMedicineDistributions } from '../../../services/medicines'
import { fetchNotifications, markNotificationRead, markNotificationsRead } from '../../../services/notifications'
import { fetchReferrals } from '../../../services/referrals'
import { fetchCurrentUser } from '../../../services/users'
import NotificationsPage from '../shared/NotificationsPage'
import './PatientStyle.css'
import './PatientLayout.css'
import './PatientPagesUI.css'

const formatDisplayDate = (value = new Date()) => new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  weekday: 'long',
}).format(value)

const formatShortDate = (value) => {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

const formatStatus = (status) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ') : 'Pending'

const sortByNewest = (items, dateField) =>
  [...items].sort((firstItem, secondItem) => new Date(secondItem[dateField] || 0) - new Date(firstItem[dateField] || 0))

function PatientReferral({ onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [referrals, setReferrals] = useState([])
  const [medicineHistory, setMedicineHistory] = useState([])
  const [currentUser, setCurrentUser] = useState(() => getStoredUser())
  const [notifications, setNotifications] = useState([])
  const [isDashboardLoading, setIsDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadPatientDashboard = async () => {
      try {
        const [backendUser, backendReferrals, backendMedicineHistory] = await Promise.all([
          fetchCurrentUser(),
          fetchReferrals(),
          fetchPatientMedicineDistributions(),
        ])

        if (!isMounted) return
        setCurrentUser(backendUser)
        setReferrals(sortByNewest(backendReferrals, 'date'))
        setMedicineHistory(sortByNewest(backendMedicineHistory, 'distributedAt'))
        setDashboardError('')
      } catch {
        if (isMounted) setDashboardError('Unable to load your dashboard records from the backend.')
      } finally {
        if (isMounted) setIsDashboardLoading(false)
      }
    }

    loadPatientDashboard()
    const intervalId = window.setInterval(loadPatientDashboard, 10000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadNotifications = async () => {
      try {
        const backendNotifications = await fetchNotifications()
        if (isMounted) setNotifications(backendNotifications)
      } catch {
        // Keep the patient dashboard usable if notifications are temporarily unavailable.
      }
    }

    loadNotifications()
    const intervalId = window.setInterval(loadNotifications, 5000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const activeReferralCount = referrals.filter((referral) => !['completed', 'cancelled', 'rejected'].includes(referral.status)).length
  const latestReferral = referrals[0]
  const latestMedicine = medicineHistory[0]
  const visibleReferrals = referrals.slice(0, 5)
  const visibleMedicineHistory = medicineHistory.slice(0, 5)
  const unreadCount = notifications.filter((notification) => !notification.read).length
  const patientName = useMemo(
    () =>
      [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
      currentUser?.username ||
      'Patient',
    [currentUser],
  )

  const handleNotificationOpen = async (notification) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    )
    markNotificationRead(notification.id).catch(() => null)

    if (['currentReferral', 'referral', 'trackPatients'].includes(notification.targetPage)) {
      setPage('currentReferral')
      return
    }

    if (['pastReferral', 'history'].includes(notification.targetPage)) {
      setPage('pastReferral')
      return
    }

    if (notification.targetPage === 'settings') {
      setPage('settings')
      return
    }

    if (notification.targetPage === 'medicineRequest') {
      setPage('medicineRequest')
      return
    }

    setPage('dashboard')
  }

  const handleMarkAllNotificationsRead = () => {
    markNotificationsRead(notifications).catch(() => null)
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, read: true })),
    )
  }

  return (
    <div className={`patient-shell patient-workspace medical-workspace ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <PatientNavbar
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
        activePage={page}
        currentUser={currentUser}
        notifications={notifications}
        unreadCount={unreadCount}
        onLogout={onLogout}
        onOpenDashboard={() => setPage('dashboard')}
        onOpenCurrentReferral={() => setPage('currentReferral')}
        onOpenPastReferral={() => setPage('pastReferral')}
        onOpenMedicineRequest={() => setPage('medicineRequest')}
        onOpenSettings={() => setPage('settings')}
        onNotificationOpen={handleNotificationOpen}
        onViewAllNotifications={() => setPage('notifications')}
      />

      <main id="patient-dashboard" className="patient-main">
        {page === 'settings' ? (
          <PatientSettings />
        ) : page === 'currentReferral' ? (
          <PatientCurrentReferral />
        ) : page === 'pastReferral' ? (
          <PatientPastReferrals />
        ) : page === 'medicineRequest' ? (
          <PatientMedicineRequest />
        ) : page === 'notifications' ? (
          <NotificationsPage
            notifications={notifications}
            onNotificationOpen={handleNotificationOpen}
            onMarkAllRead={handleMarkAllNotificationsRead}
          />
        ) : (
          <>
        <div className="patient-page-heading">
          <div>
            <span>Patient Portal</span>
            <h1>Dashboard</h1>
            <p>Track your referral status and view important health coordination updates.</p>
          </div>
          <div className="patient-date-card">
            <CalendarDays size={18} />
            <span>{formatDisplayDate()}</span>
          </div>
        </div>

        <section className="patient-stats-grid">
          <article className="patient-stat-card">
            <div className="patient-stat-icon">
              <HeartPulse size={24} />
            </div>
            <span>Active Referral</span>
            <strong>{isDashboardLoading ? '-' : activeReferralCount}</strong>
          </article>
          <article className="patient-stat-card">
            <div className="patient-stat-icon">
              <Activity size={24} />
            </div>
            <span>Status Updates</span>
            <strong>{isDashboardLoading ? '-' : referrals.length}</strong>
          </article>
          <article className="patient-stat-card">
            <div className="patient-stat-icon">
              <FileText size={24} />
            </div>
            <span>Records</span>
            <strong>{isDashboardLoading ? '-' : referrals.length + medicineHistory.length}</strong>
          </article>
        </section>

        {dashboardError && (
          <div className="patient-dashboard-alert">
            <AlertTriangle size={16} />
            {dashboardError}
          </div>
        )}

        <section id="patient-referral" className="patient-content-grid">
          <article className="patient-panel">
            <div className="patient-panel-heading">
              <div>
                <span>Referral</span>
                <h2>Referral Timeline</h2>
              </div>
              <MapPin size={18} />
            </div>
            <div className="patient-table">
              {isDashboardLoading ? (
                <div className="patient-empty-state">
                  <Loader2 className="cho-map-spin" size={16} />
                  Loading referral timeline...
                </div>
              ) : visibleReferrals.length > 0 ? visibleReferrals.map((referral) => (
                <div className="patient-table-row" key={referral.id}>
                  <div>
                    <strong>{referral.referredTo}</strong>
                    <span>{referral.code} | {referral.chiefComplaint}</span>
                    <time>{formatShortDate(referral.date)}</time>
                  </div>
                  <span className={`status ${referral.status}`}>
                    {formatStatus(referral.status)}
                  </span>
                </div>
              )) : (
                <div className="patient-empty-state">Your referral timeline will appear here.</div>
              )}
            </div>
          </article>

          <article className="patient-panel">
            <div className="patient-panel-heading">
              <div>
                <span>Profile</span>
                <h2>Patient Information</h2>
              </div>
              <UserRound size={18} />
            </div>
            <div className="patient-info">
              <strong>{patientName}</strong>
              <span>Patient ID: {currentUser?.id ? `MF-${String(currentUser.id).padStart(6, '0')}` : 'Not available'}</span>
              <p>
                {latestReferral
                  ? `Latest referral: ${formatStatus(latestReferral.status)} at ${latestReferral.referredTo}.`
                  : 'Latest referral: No referral record yet.'}
              </p>
              <p>
                {latestMedicine
                  ? `Latest medicine: ${latestMedicine.quantity} ${latestMedicine.medicineName} from ${latestMedicine.facility || 'BHC'}.`
                  : 'Latest medicine: No distributed medicine record yet.'}
              </p>
            </div>
          </article>

          <article className="patient-panel patient-panel-wide">
            <div className="patient-panel-heading">
              <div>
                <span>Medicine</span>
                <h2>Medicine Distribution History</h2>
              </div>
              <Pill size={18} />
            </div>
            <div className="patient-table">
              {isDashboardLoading ? (
                <div className="patient-empty-state">
                  <Loader2 className="cho-map-spin" size={16} />
                  Loading medicine history...
                </div>
              ) : visibleMedicineHistory.length > 0 ? visibleMedicineHistory.map((record) => (
                <div className="patient-table-row" key={record.backendId}>
                  <div>
                    <strong>{record.medicineName}</strong>
                    <span>
                      {record.quantity} issued
                      {record.instructions ? ` | ${record.instructions}` : ''}
                    </span>
                    <time>{formatShortDate(record.distributedAt)}</time>
                  </div>
                  <span className="status accepted">Released</span>
                </div>
              )) : (
                <div className="patient-empty-state">Your distributed medicines will appear here.</div>
              )}
            </div>
          </article>
        </section>
          </>
        )}
      </main>
    </div>
  )
}

export default PatientReferral
