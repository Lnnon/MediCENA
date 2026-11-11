import DashboardMapPreview from '../shared/DashboardMapPreview'
import DashboardAnalyticsPreview from '../shared/DashboardAnalyticsPreview'
import {
  Ambulance,
  ArrowLeft,
  CalendarDays,
  FileCheck2,
  HeartPulse,
  MapPin,
  PackageCheck,
  TrendingUp,
  UserCog,
  Users,
  Wifi,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStoredUser, getUserDisplayName } from '../../../services/authUser'
import {
  fetchMedicineInventory,
  fetchMedicineRequestsForCho,
  fetchPatientMedicineRequests,
} from '../../../services/medicines'
import { fetchNotifications, markNotificationRead, markNotificationsRead } from '../../../services/notifications'
import { fetchPatients } from '../../../services/patients'
import { fetchIncomingReferrals, fetchReferrals } from '../../../services/referrals'
import { fetchOnlineUsers } from '../../../services/users'
import { fetchOutbreakAnalytics, fetchPurokDiseaseMap } from '../../../services/gis'
import CHOHealthMap from './CHOHealthMap'
import CHONavbar from './CHONavbar'
import CHOManageUsers from './CHOManageUsers'
import CHOOnlineUsers from './CHOOnlineUsers'
import CHOStaffActivity from './CHOStaffActivity'
import CHOPatientList from './CHOPatientList'
import CHOSettings from './CHOSettings'
import CHOTrackPatients from './CHOTrackPatients'
import ProfilePage from '../shared/ProfilePage'
import OutbreakAnalyticsPage, { OutbreakAnalyticsDetailPage } from '../shared/OutbreakAnalyticsPage'
import ForecastPanel from '../shared/ForecastPanel'
import NotificationsPage from '../shared/NotificationsPage'
import ReportsPage from '../shared/ReportsPage'
import pollWhileVisible from '../shared/pollWhileVisible'
import CHOReferralMonitoring from './CHOReferralMonitoring'
import CHOMedicineMonitoring from './CHOMedicineMonitoring'
import './CHOStyle.css'
import './CHOLayout.css'
import './CHODashboardLayout.css'
import './CHOMonitoring.css'
import './CHOMonitoringLayout.css'
import './CHOStaffLayout.css'
import './CHOProfileLayout.css'
import '../shared/DepartmentDashboard.css'


const formatNumber = (value) => Number(value || 0).toLocaleString()

const formatDisplayDate = (value = new Date()) => new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  weekday: 'long',
}).format(value)

const getSeenIds = (key) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'))
  } catch {
    return new Set()
  }
}

const saveSeenIds = (key, ids) => {
  localStorage.setItem(key, JSON.stringify([...ids]))
}

function CHODashboard({ onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [page, setPage] = useState('dashboard')
  const showOverview = page === 'dashboard'
  const showTrackedReferrals = showOverview || ['patients', 'trackPatients', 'incoming', 'referred'].includes(page)
  const [analyticsDetailType, setAnalyticsDetailType] = useState('gis-cases')
  const [trackFocusPatientId, setTrackFocusPatientId] = useState(null)
  const [medicineRequests, setMedicineRequests] = useState([])
  const [distributionQueue, setDistributionQueue] = useState([])
  const [latestIncomingReferrals, setLatestIncomingReferrals] = useState([])
  const [trackedReferrals, setTrackedReferrals] = useState([])
  const [referralSyncError, setReferralSyncError] = useState('')
  const [monitorDoctorId, setMonitorDoctorId] = useState('')
  const [totalPatients, setTotalPatients] = useState(0)
  const [forecastMapScope, setForecastMapScope] = useState({ barangay: '', diseaseId: '' })
  const [inventory, setInventory] = useState([])
  const [onlineUsers, setOnlineUsers] = useState({ stats: {}, staff: [], patients: [] })
  const [mapPreview, setMapPreview] = useState({ features: [] })
  const [analyticsPreview, setAnalyticsPreview] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [medicineNewCount, setMedicineNewCount] = useState(0)
  const [referralNewCount, setReferralNewCount] = useState(0)
  const knownIncomingIds = useRef(new Set())
  const hasLoadedIncoming = useRef(false)
  const hasReportedIncomingSyncError = useRef(false)
  const knownMedicineRequestIds = useRef(new Set())
  const hasLoadedMedicineRequests = useRef(false)
  const hasReportedMedicineSyncError = useRef(false)
  const currentUserName = useMemo(() => getUserDisplayName(getStoredUser()), [])
  const seenIncomingKey = useMemo(() => `cho_seen_incoming_referrals_${getStoredUser()?.id || 'current'}`, [])
  const seenMedicineKey = useMemo(() => `cho_seen_medicine_requests_${getStoredUser()?.id || 'current'}`, [])

  const addNotification = useCallback((notification) => {
    setNotifications((currentNotifications) => [
      {
        id: `${notification.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        read: false,
        ...notification,
      },
      ...currentNotifications,
    ].slice(0, 50))
  }, [])
  const loadBackendNotifications = useCallback(async () => {
    try {
      const backendNotifications = await fetchNotifications()
      setNotifications(backendNotifications)
      setReferralNewCount(
        backendNotifications.filter(
          (notification) => !notification.read && ['incoming', 'referred', 'trackPatients'].includes(notification.targetPage),
        ).length,
      )
      setMedicineNewCount(
        backendNotifications.filter(
          (notification) => !notification.read && ['medicineRequests', 'distribution'].includes(notification.targetPage),
        ).length,
      )
    } catch {
      // Keep current notifications visible if the notification API is temporarily unavailable.
    }
  }, [])

  useEffect(() => {
    if (!showOverview) return
    let isMounted = true

    const loadDashboardData = async () => {
      const [backendPatients, backendInventory, backendOnlineUsers] = await Promise.all([
        fetchPatients().catch(() => []),
        fetchMedicineInventory().catch(() => []),
        fetchOnlineUsers().catch(() => ({ stats: {}, staff: [], patients: [] })),
      ])

      if (!isMounted) return
      setTotalPatients(backendPatients.length)
      setInventory(backendInventory)
      setOnlineUsers(backendOnlineUsers)
    }

    const stopPolling = pollWhileVisible(loadDashboardData, 10000)

    return () => {
      isMounted = false
      stopPolling()
    }
  }, [showOverview])

  useEffect(() => {
    if (!showOverview) return
    let isMounted = true

    const loadDistributionQueue = async () => {
      const backendQueue = await fetchPatientMedicineRequests().catch(() => [])
      if (!isMounted) return
      setDistributionQueue(backendQueue)
    }

    const stopPolling = pollWhileVisible(loadDistributionQueue, 15000)

    return () => {
      isMounted = false
      stopPolling()
    }
  }, [showOverview])

  useEffect(() => {
    if (!showOverview) return
    let isMounted = true

    const loadMonitoringPreviews = async () => {
      const [backendMapPreview, backendAnalyticsPreview] = await Promise.all([
        fetchPurokDiseaseMap().catch(() => ({ features: [] })),
        fetchOutbreakAnalytics().catch(() => null),
      ])

      if (!isMounted) return
      setMapPreview(backendMapPreview)
      setAnalyticsPreview(backendAnalyticsPreview)
    }

    const stopPolling = pollWhileVisible(loadMonitoringPreviews, 15000)

    return () => {
      isMounted = false
      stopPolling()
    }
  }, [showOverview])

  useEffect(() => {
    return pollWhileVisible(loadBackendNotifications, 5000)
  }, [loadBackendNotifications])

  useEffect(() => {
    let isMounted = true

    const loadIncomingNotifications = async () => {
      try {
        const backendIncoming = await fetchIncomingReferrals()
        if (!isMounted) return

        setLatestIncomingReferrals(backendIncoming)
        const seenIncomingIds = getSeenIds(seenIncomingKey)
        const incomingIds = new Set(backendIncoming.map((referral) => referral.backendId || referral.id))
        setReferralNewCount(backendIncoming.filter((referral) => !seenIncomingIds.has(referral.backendId || referral.id)).length)

        if (hasLoadedIncoming.current) {
          backendIncoming
            .filter((referral) => !knownIncomingIds.current.has(referral.backendId || referral.id))
            .forEach((referral) => {
              addNotification({
                type: 'incoming-referral',
                title: 'New incoming referral',
                message: `${referral.patient} from ${referral.source} needs ${referral.specialty} review.`,
                targetPage: 'incoming',
              })
            })
        }

        knownIncomingIds.current = incomingIds
        hasLoadedIncoming.current = true
        hasReportedIncomingSyncError.current = false
      } catch {
        if (isMounted && !hasLoadedIncoming.current && !hasReportedIncomingSyncError.current) {
          addNotification({
            type: 'system',
            title: 'Incoming referral sync failed',
            message: 'Unable to load incoming referrals from the backend.',
            targetPage: 'incoming',
          })
          hasReportedIncomingSyncError.current = true
        }
      }
    }

    const stopPolling = pollWhileVisible(loadIncomingNotifications, 5000)

    return () => {
      isMounted = false
      stopPolling()
    }
  }, [addNotification, seenIncomingKey])

  useEffect(() => {
    let isMounted = true

    const loadMedicineRequests = async () => {
      try {
        const backendRequests = await fetchMedicineRequestsForCho()
        if (!isMounted) return

        setMedicineRequests(backendRequests)
        const newSubmittedRequests = backendRequests.filter((request) => request.rawStatus === 'requested')

        const seenMedicineIds = getSeenIds(seenMedicineKey)
        const incomingIds = new Set(newSubmittedRequests.map((request) => request.backendId || request.id))
        setMedicineNewCount(newSubmittedRequests.filter((request) => !seenMedicineIds.has(request.backendId || request.id)).length)

        if (hasLoadedMedicineRequests.current) {
          newSubmittedRequests
            .filter((request) => !knownMedicineRequestIds.current.has(request.backendId || request.id))
            .forEach((request) => {
              addNotification({
                type: 'medicine',
                title: 'New medicine request',
                message: `${request.bhc} requested ${request.quantity} unit/s of ${request.medicine}.`,
                targetPage: 'medicineRequests',
              })
            })
        }

        knownMedicineRequestIds.current = incomingIds
        hasLoadedMedicineRequests.current = true
        hasReportedMedicineSyncError.current = false
      } catch {
        if (isMounted && !hasLoadedMedicineRequests.current && !hasReportedMedicineSyncError.current) {
          addNotification({
            type: 'system',
            title: 'Medicine request sync failed',
            message: 'Unable to load medicine coordination requests from the backend.',
            targetPage: 'medicineRequests',
          })
          hasReportedMedicineSyncError.current = true
        }
      }
    }

    const stopPolling = pollWhileVisible(loadMedicineRequests, 5000)

    return () => {
      isMounted = false
      stopPolling()
    }
  }, [addNotification, seenMedicineKey])

  useEffect(() => {
    if (!showTrackedReferrals) return
    let isMounted = true

    const loadTrackedReferrals = async () => {
      try {
        const backendReferrals = await fetchReferrals()
        if (isMounted) {
          setTrackedReferrals(backendReferrals)
          setReferralSyncError('')
        }
      } catch {
        if (isMounted) {
          setReferralSyncError('Unable to refresh referral monitoring. Previously loaded records are shown.')
        }
      }
    }

    const stopPolling = pollWhileVisible(loadTrackedReferrals, 3000)

    return () => {
      isMounted = false
      stopPolling()
    }
  }, [showTrackedReferrals])

  const handleNotificationOpen = async (notification) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    )
    markNotificationRead(notification.id).catch(() => null)

    if (notification.targetPage === 'incoming') {
      const incomingIds = new Set(latestIncomingReferrals.map((referral) => referral.backendId || referral.id))
      saveSeenIds(seenIncomingKey, incomingIds)
      setReferralNewCount(0)
    }

    if (notification.targetPage === 'medicineRequests') {
      const medicineIds = new Set(
        medicineRequests
          .filter((request) => request.rawStatus === 'requested')
          .map((request) => request.backendId || request.id),
      )
      saveSeenIds(seenMedicineKey, medicineIds)
      setMedicineNewCount(0)
    }

    setPage(notification.targetPage || 'dashboard')
  }

  const handleMarkAllNotificationsRead = () => {
    markNotificationsRead(notifications).catch(() => null)
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, read: true })),
    )
    setReferralNewCount(0)
    setMedicineNewCount(0)
  }

  const openPageAndReadNotifications = (targetPage, notificationTypes = []) => {
    const targetNotifications = notifications.filter((item) => item.targetPage === targetPage || notificationTypes.includes(item.type))
    markNotificationsRead(targetNotifications).catch(() => null)
    setNotifications((currentNotifications) =>
      currentNotifications.map((item) =>
        notificationTypes.includes(item.type) ? { ...item, read: true } : item,
      ),
    )

    if (targetPage === 'incoming') {
      const incomingIds = new Set(latestIncomingReferrals.map((referral) => referral.backendId || referral.id))
      saveSeenIds(seenIncomingKey, incomingIds)
      setReferralNewCount(0)
    }

    if (targetPage === 'medicineRequests') {
      const medicineIds = new Set(
        medicineRequests
          .filter((request) => request.rawStatus === 'requested')
          .map((request) => request.backendId || request.id),
      )
      saveSeenIds(seenMedicineKey, medicineIds)
      setMedicineNewCount(0)
    }

    setPage(targetPage)
  }

  const openAnalyticsDetail = (detailType) => {
    setAnalyticsDetailType(detailType)
    setPage('analyticsDetail')
  }

  const openForecastMap = (scope) => {
    setForecastMapScope(scope)
    setPage('healthMap')
  }

  const openPatientEhr = (patient) => {
    setTrackFocusPatientId(patient.id)
    setPage('trackPatients')
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length
  const activeReferrals = trackedReferrals.filter((item) => !['completed', 'rejected', 'cancelled'].includes(item.status))
  const unassignedReferrals = activeReferrals.filter((item) => !item.assignedDoctorId)
  const pendingSupplyRequests = medicineRequests.filter((item) => item.rawStatus === 'requested')
  const outOfStock = inventory.filter((item) => item.stocks <= 0)
  const completedReferrals = trackedReferrals.filter((item) => item.status === 'completed').length
  const workload = new Map()
  activeReferrals.filter((item) => item.assignedDoctorId).forEach((item) => {
    const current = workload.get(item.assignedDoctorId) || { id: item.assignedDoctorId, name: item.assignedDoctor, total: 0 }
    current.total += 1
    workload.set(item.assignedDoctorId, current)
  })
  const doctorWorkload = [...workload.values()].sort((a, b) => b.total - a.total).slice(0, 5)
  const dashboardStats = [
    { label: 'Registered Patients', value: totalPatients, icon: Users, page: 'patients' },
    { label: 'Active Referrals', value: activeReferrals.length, icon: Ambulance, page: 'incoming' },
    { label: 'Awaiting Doctor Assignment', value: unassignedReferrals.length, icon: HeartPulse, page: 'referred' },
    { label: 'Pending BHC Supply Requests', value: pendingSupplyRequests.length, icon: PackageCheck, page: 'medicineRequests' },
    { label: 'Out-of-Stock Entries', value: outOfStock.length, icon: FileCheck2, page: 'distribution' },
  ]
  const onlineStaffRows = (onlineUsers.staff || []).slice(0, 4)
  const mapScopeLabel = mapPreview.scope?.is_barangay_scoped && mapPreview.scope?.barangay
    ? mapPreview.scope.barangay
    : 'Lucena City'
  const analyticsScopeLabel = analyticsPreview?.scope?.is_barangay_scoped && analyticsPreview?.scope?.barangay
    ? analyticsPreview.scope.barangay
    : 'Lucena City'

  return (
    <div className={`cho-shell cho-workspace ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <CHONavbar
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
        onLogout={onLogout}
        currentUserName={currentUserName}
        notifications={notifications}
        unreadCount={unreadCount}
        onOpenDashboard={() => setPage('dashboard')}
        onOpenPatients={() => setPage('patients')}
        onOpenTrackPatients={() => {
          setTrackFocusPatientId(null)
          setPage('trackPatients')
        }}
        onOpenIncoming={() => { setMonitorDoctorId(''); openPageAndReadNotifications('incoming', ['incoming-referral']) }}
        onOpenReferred={() => setPage('referred')}
        onOpenMedicineRequests={() => openPageAndReadNotifications('medicineRequests', ['medicine'])}
        onOpenDistribution={() => setPage('distribution')}
        onOpenPatientDistributions={() => setPage('patientDistributions')}
        onOpenHealthMap={() => { setForecastMapScope({ barangay: '', diseaseId: '' }); setPage('healthMap') }}
        onOpenAnalytics={() => setPage('analytics')}
        onOpenPredictiveAnalytics={() => setPage('predictiveAnalytics')}
        onOpenReports={() => setPage('reports')}
        onOpenProfile={() => setPage('profile')}
        onOpenOnlineUsers={() => setPage('onlineUsers')}
        onOpenActivity={() => setPage('activity')}
        onOpenManageUsers={() => setPage('manageUsers')}
        onOpenSettings={() => setPage('settings')}
        onNotificationOpen={handleNotificationOpen}
        onViewAllNotifications={() => setPage('notifications')}
        medicineNewCount={medicineNewCount}
        referralNewCount={referralNewCount}
      />

      <main id="cho-dashboard" className={`cho-main ${page === 'patients' ? 'cho-patients-main' : page === 'dashboard' ? 'cho-overview-main' : ['onlineUsers', 'manageUsers', 'activity'].includes(page) ? 'cho-monitoring-styled cho-staff-styled' : ['healthMap', 'analytics', 'analyticsDetail', 'predictiveAnalytics', 'reports'].includes(page) ? 'cho-monitoring-styled' : ''}`}>
        {page === 'patients' ? (
          <CHOPatientList referrals={trackedReferrals} onViewEhr={openPatientEhr} />
        ) : page === 'trackPatients' ? (
          <CHOTrackPatients referrals={trackedReferrals} focusPatientId={trackFocusPatientId} />
        ) : page === 'incoming' || page === 'referred' ? (
          <CHOReferralMonitoring key={`${page}-${monitorDoctorId}`} referrals={trackedReferrals} initialView={page === 'referred' ? 'doctors' : 'referrals'} initialDoctorId={monitorDoctorId} onViewDoctor={(id) => { setMonitorDoctorId(String(id)); setPage('incoming') }} onViewPatient={openPatientEhr} syncError={referralSyncError} />
        ) : ['medicineRequests', 'distribution', 'patientDistributions'].includes(page) ? (
          <CHOMedicineMonitoring key={page} initialView={{ medicineRequests: 'requests', distribution: 'inventory', patientDistributions: 'distributions' }[page]} />
        ) : page === 'healthMap' ? (
          <CHOHealthMap key={`${forecastMapScope.barangay}-${forecastMapScope.diseaseId}`} initialBarangay={forecastMapScope.barangay} initialDiseaseId={forecastMapScope.diseaseId} />
        ) : page === 'analytics' ? (
          <OutbreakAnalyticsPage role="cho" onOpenDetail={openAnalyticsDetail} onOpenSection={setPage} />
        ) : page === 'predictiveAnalytics' ? (
          <><div className="cho-page-heading"><div><span>City Health Office</span><h1>Predictive Analytics</h1><p>Disease trends and medicine demand forecasts from recorded data</p></div><button type="button" className="analytics-back-button" onClick={() => setPage('analytics')}><ArrowLeft size={18} />Back to Analytics</button></div><ForecastPanel role="cho" onOpenMap={openForecastMap} /></>
        ) : page === 'analyticsDetail' ? (
          <OutbreakAnalyticsDetailPage
            detailType={analyticsDetailType}
            role="cho"
            onBack={() => setPage('analytics')}
          />
        ) : page === 'reports' ? (
          <ReportsPage role="cho" />
        ) : page === 'profile' ? (
          <div className="cho-profile-styled"><ProfilePage roleLabel="City Health Office Staff" /></div>
        ) : page === 'onlineUsers' ? (
          <CHOOnlineUsers />
        ) : page === 'activity' ? (
          <CHOStaffActivity />
        ) : page === 'manageUsers' ? (
          <CHOManageUsers />
        ) : page === 'settings' ? (
          <CHOSettings />
        ) : page === 'notifications' ? (
          <NotificationsPage
            notifications={notifications}
            onNotificationOpen={handleNotificationOpen}
            onMarkAllRead={handleMarkAllNotificationsRead}
          />
        ) : (
          <>
        <div className="cho-page-heading">
          <div>
            <span>City Health Office</span>
            <h1>CHO Monitoring Overview</h1>
            <p>Monitor referral progress, doctor assignments, medicine supply coordination, and public health across Lucena City.</p>
          </div>
          <div className="cho-date-card">
            <CalendarDays size={18} />
            <span>{formatDisplayDate()}</span>
          </div>
        </div>

        <section className="cho-stats-grid" aria-label="CHO summary">
          {dashboardStats.map((stat) => {
            const Icon = stat.icon
            return (
              <button type="button" className="cho-stat-card" key={stat.label} onClick={() => setPage(stat.page)}>
                <div className="cho-stat-icon">
                  <Icon size={24} />
                </div>
                <span>{stat.label}</span>
                <strong>{stat.value === null || stat.value === undefined ? 'Unavailable' : formatNumber(stat.value)}</strong>
              </button>
            )
          })}
        </section>

        <section className="cho-content-grid">
          <article className="cho-panel cho-map-panel">
            <div className="cho-panel-heading">
              <div>
                <span>All Diseases</span>
                <h2>{mapScopeLabel} Purok Disease Monitoring</h2>
              </div>
              <MapPin size={18} />
            </div>
            <DashboardMapPreview features={mapPreview.features || []} onOpen={() => setPage('healthMap')} />
          </article>

          <article className="cho-panel">
            <div className="cho-panel-heading"><div><span>OPD Coordination</span><h2>Referral Progress</h2></div><button className="cho-overview-link" type="button" onClick={() => setPage('incoming')}>View referrals →</button></div>
            {referralSyncError && <p role="alert">{referralSyncError}</p>}
            <div className="cho-overview-status-grid">{[['Active', activeReferrals.length], ['Unassigned', unassignedReferrals.length], ['Completed', completedReferrals], ['Rejected / Cancelled', trackedReferrals.filter((item) => ['rejected', 'cancelled'].includes(item.status)).length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{formatNumber(value)}</strong></div>)}</div>
            <p className="cho-overview-note">OPD processes referrals and assigns doctors. CHO monitors progress and workload.</p>
            <h3 className="cho-overview-subtitle">Doctor Workload · Active Referrals</h3>
            <div className="cho-table">{doctorWorkload.length ? doctorWorkload.map((doctor) => <button className="cho-overview-workload" type="button" key={doctor.id} onClick={() => { setMonitorDoctorId(String(doctor.id)); setPage('incoming') }}><span>{doctor.name}</span><strong>{doctor.total}</strong></button>) : <p className="cho-overview-note">No active referrals assigned to doctors.</p>}</div>
          </article>

          <article className="cho-panel cho-analytics-panel">
            <div className="cho-panel-heading">
              <div>
                <span>{analyticsScopeLabel}</span>
                <h2>12-Month Disease Trend</h2>
              </div>
              <TrendingUp size={18} />
            </div>
            <DashboardAnalyticsPreview linkClassName="cho-analytics-link" history={analyticsPreview?.monthly_history || []} onOpen={() => setPage('analytics')} />
          </article>

          <article className="cho-panel">
            <div className="cho-panel-heading"><div><span>Pharmacy & BHC Coordination</span><h2>Medicine Supply Monitoring</h2></div><button className="cho-overview-link" type="button" onClick={() => setPage('medicineRequests')}>View requests →</button></div>
            <div className="cho-overview-status-grid"><div><span>Pending Supply Requests</span><strong>{pendingSupplyRequests.length}</strong></div><div><span>Out-of-Stock Entries</span><strong>{outOfStock.length}</strong></div></div>
            <p className="cho-overview-note">Pharmacists process supplies and dispatch medicines. BHC personnel confirm receipt.</p>
            <div className="cho-distribution">{pendingSupplyRequests.slice(0, 4).map((request) => <div key={request.backendId || request.id}><strong>{request.bhc}</strong><span>{request.medicine} · {formatNumber(request.quantity)} units requested</span><em>{request.status}</em></div>)}</div>
            {!pendingSupplyRequests.length && <p className="cho-overview-note">No pending BHC supply requests.</p>}
            <button className="cho-overview-link" type="button" onClick={() => setPage('patientDistributions')}>Monitor patient medicine distributions ({distributionQueue.length} request records) →</button>
          </article>

          <article className="cho-panel">
            <div className="cho-panel-heading"><div><span>Personnel Oversight</span><h2>Online Personnel</h2></div><UserCog size={18} /></div>
            <div className="cho-user-list">{onlineStaffRows.length ? onlineStaffRows.map((user) => <div key={user.name}><Wifi size={16} /><div><strong>{user.name}</strong><span>{user.role}</span></div><em>{user.status}</em></div>) : <p className="cho-overview-note">No personnel currently online.</p>}</div>
            <div className="cho-overview-actions"><button className="cho-overview-link" type="button" onClick={() => setPage('onlineUsers')}>View online users →</button><button className="cho-overview-link" type="button" onClick={() => setPage('activity')}>Personnel activity →</button></div>
          </article>

          <article className="cho-panel">
            <div className="cho-panel-heading"><div><span>Planning & Administration</span><h2>CHO Reports and Planning</h2></div><FileCheck2 size={18} /></div>
            <p className="cho-overview-note">Review recorded health summaries and forecasts for planning and oversight.</p>
            <div className="cho-overview-shortcuts">{[['reports', 'Health Summary Reports'], ['predictiveAnalytics', 'Predictive Analytics'], ['manageUsers', 'Manage Users']].map(([target, label]) => <button type="button" key={target} onClick={() => setPage(target)}>{label}<span aria-hidden="true">→</span></button>)}</div>
          </article>
        </section>
          </>
        )}
      </main>
    </div>
  )
}

export default CHODashboard




