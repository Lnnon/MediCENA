import DashboardMapPreview from '../shared/DashboardMapPreview'
import DashboardAnalyticsPreview from '../shared/DashboardAnalyticsPreview'
import '../shared/MedicalWorkspace.css'
import {
  Ambulance,
  CalendarDays,
  FileCheck2,
  HeartPulse,
  MapPin,
  PackageCheck,
  PackagePlus,
  Pill,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStoredUser, getUserDisplayName } from '../../../services/authUser'
import { fetchMedicineInventory, fetchMedicineRequestsForBhc } from '../../../services/medicines'
import { fetchNotifications, markNotificationRead, markNotificationsRead } from '../../../services/notifications'
import { fetchPatients } from '../../../services/patients'
import { fetchReferrals } from '../../../services/referrals'
import { fetchOutbreakAnalytics, fetchPurokDiseaseMap } from '../../../services/gis'
import BHCNavbar from './BHCNavbar'
import BHCMedicineInventory from './BHCMedicineInventory'
import BHCMedicineDistribution from './BHCMedicineDistribution'
import BHCMedicineRequests from './BHCMedicineRequests'
import BHCPatientList from './BHCPatientList'
import BHCReferredPatients from './BHCReferredPatients'
import BHCSettings from './BHCSettings'
import BHCTrackPatients from './BHCTrackPatients'
import CHOHealthMap from '../cho/CHOHealthMap'
import OutbreakAnalyticsPage, { OutbreakAnalyticsDetailPage } from '../shared/OutbreakAnalyticsPage'
import NotificationsPage from '../shared/NotificationsPage'
import ProfilePage from '../shared/ProfilePage'
import ReportsPage from '../shared/ReportsPage'
import pollWhileVisible from '../shared/pollWhileVisible'
import './BHCStyle.css'
import './BHCWorkspacePages.css'
import '../cho/CHOStyle.css'

const LOW_STOCK_THRESHOLD = 20

const formatNumber = (value) => Number(value || 0).toLocaleString()

const isBackendNotification = (notification) => Number.isInteger(Number(notification.id))

const getBhcNotificationStorageKey = () => `bhc_notifications_${getStoredUser()?.id || 'current'}`

const readStoredBhcNotifications = () => {
  try {
    return JSON.parse(localStorage.getItem(getBhcNotificationStorageKey()) || '[]')
  } catch {
    return []
  }
}

const saveStoredBhcNotifications = (notifications) => {
  localStorage.setItem(
    getBhcNotificationStorageKey(),
    JSON.stringify(notifications.filter((notification) => !isBackendNotification(notification)).slice(0, 50)),
  )
}

const mergeNotifications = (backendNotifications, currentNotifications) => {
  const currentReadState = new Map(currentNotifications.map((notification) => [notification.id, notification.read]))
  const localNotifications = [...readStoredBhcNotifications(), ...currentNotifications.filter((notification) => !isBackendNotification(notification))]
    .filter((notification, index, allNotifications) =>
      allNotifications.findIndex((item) => item.id === notification.id) === index,
    )
  const syncedNotifications = backendNotifications.map((notification) => ({
    ...notification,
    read: currentReadState.has(notification.id) ? currentReadState.get(notification.id) || notification.read : notification.read,
  }))

  const mergedNotifications = [...localNotifications, ...syncedNotifications]
    .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0))
    .slice(0, 50)
  saveStoredBhcNotifications(mergedNotifications)
  return mergedNotifications
}

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

function BHCDashboard({ onLogout }) {
  const [page, setPage] = useState('dashboard')
  const showOverview = page === 'dashboard'
  const [analyticsDetailType, setAnalyticsDetailType] = useState('gis-cases')
  const [submittedReferrals, setSubmittedReferrals] = useState([])
  const [medicineRequests, setMedicineRequests] = useState([])
  const [patients, setPatients] = useState([])
  const [inventory, setInventory] = useState([])
  const [mapPreview, setMapPreview] = useState({ features: [] })
  const [analyticsPreview, setAnalyticsPreview] = useState(null)
  const [notifications, setNotifications] = useState(() => readStoredBhcNotifications())
  const knownReferralIds = useRef(new Set())
  const hasLoadedReferrals = useRef(false)
  const hasReportedReferralSyncError = useRef(false)
  const knownMedicineRequestIds = useRef(new Set())
  const hasLoadedMedicineRequests = useRef(false)
  const hasReportedMedicineSyncError = useRef(false)
  const currentUserName = useMemo(() => getUserDisplayName(getStoredUser()), [])

  const addNotification = useCallback((notification) => {
    setNotifications((currentNotifications) => {
      const nextNotifications = [
        {
          id: `${notification.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
          read: false,
          ...notification,
        },
        ...currentNotifications,
      ].slice(0, 50)
      saveStoredBhcNotifications(nextNotifications)
      return nextNotifications
    })
  }, [])

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
  const loadBackendNotifications = useCallback(async () => {
    try {
      const backendNotifications = await fetchNotifications()
      setNotifications((currentNotifications) => mergeNotifications(backendNotifications, currentNotifications))
    } catch {
      // Keep current notifications visible if the notification API is temporarily unavailable.
    }
  }, [])

  useEffect(() => {
    if (!showOverview) return
    let isMounted = true

    const loadDashboardData = async () => {
      const [backendPatients, backendInventory] = await Promise.all([
        fetchPatients().catch(() => []),
        fetchMedicineInventory().catch(() => []),
      ])

      if (!isMounted) return
      setPatients(backendPatients)
      setInventory(backendInventory)
    }

    const stopPolling = pollWhileVisible(loadDashboardData, 10000)

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

    const loadReferrals = async () => {
      try {
        const backendReferrals = await fetchReferrals()
        if (!isMounted) return

        setSubmittedReferrals(backendReferrals)

        const incomingIds = new Set(backendReferrals.map((referral) => referral.id))
        if (hasLoadedReferrals.current) {
          backendReferrals
            .filter((referral) => !knownReferralIds.current.has(referral.id))
            .forEach((referral) => {
              addNotification({
                type: 'referral',
                title: 'Referral updated',
                message: `${referral.patient} is now in your referred patients list.`,
                targetPage: 'trackPatients',
              })
            })
        }

        knownReferralIds.current = incomingIds
        hasLoadedReferrals.current = true
        hasReportedReferralSyncError.current = false
      } catch {
        if (isMounted && !hasLoadedReferrals.current && !hasReportedReferralSyncError.current) {
          addNotification({
            type: 'system',
            title: 'Referral sync failed',
            message: 'Unable to load referred patients from the backend.',
            targetPage: 'referred',
          })
          hasReportedReferralSyncError.current = true
        }
      }
    }

    const stopPolling = pollWhileVisible(loadReferrals, 5000)

    return () => {
      isMounted = false
      stopPolling()
    }
  }, [addNotification])

  useEffect(() => {
    let isMounted = true

    const loadMedicineRequests = async () => {
      try {
        const backendRequests = await fetchMedicineRequestsForBhc()
        if (!isMounted) return

        setMedicineRequests(backendRequests)

        const incomingIds = new Set(backendRequests.map((request) => request.backendId || request.id))
        if (hasLoadedMedicineRequests.current) {
          backendRequests
            .filter((request) => !knownMedicineRequestIds.current.has(request.backendId || request.id))
            .forEach((request) => {
              addNotification({
                type: 'medicine',
                title: 'Medicine request synced',
                message: `${request.medicineName} request is now in your request tracker.`,
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
            title: 'Medicine sync failed',
            message: 'Unable to load medicine requests from the backend.',
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
  }, [addNotification])

  const handleReferralSubmit = (referral) => {
    const patientName = referral.localPatient?.name || referral.patient || 'Patient'
    setSubmittedReferrals((currentReferrals) => [referral, ...currentReferrals])
    knownReferralIds.current.add(referral.backendId || referral.id)
    addNotification({
      type: 'referral',
      title: 'Referral submitted',
      message: `${patientName} was referred by ${referral.referredBy || currentUserName}.`,
      targetPage: 'referred',
    })
    setPage('referred')
  }

  const handleMedicineRequestSubmit = (request) => {
    setMedicineRequests((currentRequests) => [request, ...currentRequests])
    knownMedicineRequestIds.current.add(request.backendId || request.id)
    addNotification({
      type: 'medicine',
      title: 'Medicine request submitted',
      message: `${request.quantity} unit/s of ${request.medicineName} requested by ${request.pickUpBy}.`,
      targetPage: 'medicineRequests',
    })
    setPage('medicineRequests')
  }

  const handleMedicineDistributionSaved = (distribution) => {
    addNotification({
      type: 'medicine',
      title: 'Medicine distributed',
      message: `${distribution.quantity} ${distribution.medicineName} given to ${distribution.patientName}.`,
      targetPage: 'medicineDistribution',
    })
  }

  const handleMedicineRequestUpdated = (updatedRequest) => {
    setMedicineRequests((currentRequests) =>
      currentRequests.map((request) =>
        (request.backendId || request.id) === (updatedRequest.backendId || updatedRequest.id)
          ? updatedRequest
          : request,
      ),
    )
    addNotification({
      type: 'medicine',
      title: 'Medicine request updated',
      message: `${updatedRequest.medicineName} is now ${updatedRequest.status}.`,
      targetPage: 'medicineRequests',
    })
  }

  const handlePatientMedicineRequestCreated = (request) => {
    addNotification({
      type: 'medicine',
      title: 'Walk-in medicine request',
      message: `${request.patientName} was added to the medicine request list.`,
      targetPage: 'medicineDistribution',
    })
  }

  const handlePatientSaved = (patient) => {
    addNotification({
      type: 'patient',
      title: patient.wasExistingRecord ? 'Existing patient reused' : 'Patient added',
      message: `${patient.name} is saved under ${patient.barangay}.`,
      targetPage: 'patients',
    })
  }

  const handlePatientUpdated = (patient) => {
    addNotification({
      type: 'patient',
      title: 'Patient updated',
      message: `${patient.name}'s record was updated.`,
      targetPage: 'patients',
    })
  }

  const handleReferralUpdated = (updatedReferral) => {
    setSubmittedReferrals((currentReferrals) =>
      currentReferrals.map((referral) => (referral.id === updatedReferral.id ? updatedReferral : referral)),
    )
    addNotification({
      type: 'referral',
      title: 'Referral updated',
      message: `${updatedReferral.patient} is now marked ${updatedReferral.status}.`,
      targetPage: 'referred',
    })
  }

  const handleNotificationOpen = async (notification) => {
    setNotifications((currentNotifications) => {
      const nextNotifications = currentNotifications.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
      saveStoredBhcNotifications(nextNotifications)
      return nextNotifications
    })
    markNotificationRead(notification.id).catch(() => null)
    setPage(notification.targetPage || 'dashboard')
  }

  const handleMarkAllNotificationsRead = () => {
    markNotificationsRead(notifications).catch(() => null)
    setNotifications((currentNotifications) => {
      const nextNotifications = currentNotifications.map((notification) => ({ ...notification, read: true }))
      saveStoredBhcNotifications(nextNotifications)
      return nextNotifications
    })
  }

  const openAnalyticsDetail = (detailType) => {
    setAnalyticsDetailType(detailType)
    setPage('analyticsDetail')
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length
  const activeReferrals = submittedReferrals.filter((referral) => !['completed', 'cancelled'].includes(referral.status))
  const dashboardStats = [
    { label: 'Registered Patients', value: patients.length, icon: Users, tone: 'blue' },
    { label: 'Active Referrals', value: activeReferrals.length, icon: Ambulance, tone: 'teal' },
    { label: 'Medicine Requests', value: medicineRequests.length, icon: PackagePlus, tone: 'aqua' },
    { label: 'Inventory Items', value: inventory.length, icon: Pill, tone: 'navy' },
    { label: 'Completed Referrals', value: submittedReferrals.filter((referral) => referral.status === 'completed').length, icon: FileCheck2, tone: 'green' },
  ]
  const recentReferralRows = submittedReferrals.slice(0, 4)
  const inventoryWatchRows = [...inventory]
    .sort((first, second) => Number(first.stocks || 0) - Number(second.stocks || 0))
    .slice(0, 4)
  const mapScopeLabel = mapPreview.scope?.is_barangay_scoped && mapPreview.scope?.barangay
    ? mapPreview.scope.barangay
    : 'Lucena City'
  const analyticsScopeLabel = analyticsPreview?.scope?.is_barangay_scoped && analyticsPreview?.scope?.barangay
    ? analyticsPreview.scope.barangay
    : 'Lucena City'

  return (
    <div className="medical-workspace bhc-shell">
      <BHCNavbar
        currentUserName={currentUserName}
        notifications={notifications}
        unreadCount={unreadCount}
        onOpenDashboard={() => setPage('dashboard')}
        onOpenPatients={() => setPage('patients')}
        onOpenTrackPatients={() => setPage('trackPatients')}
        onOpenReferred={() => setPage('referred')}
        onOpenInventory={() => setPage('inventory')}
        onOpenMedicineDistribution={() => setPage('medicineDistribution')}
        onOpenMedicineRequests={() => setPage('medicineRequests')}
        onOpenHealthMap={() => setPage('healthMap')}
        onOpenAnalytics={() => setPage('analytics')}
        onOpenReports={() => setPage('reports')}
        onOpenProfile={() => setPage('profile')}
        onOpenSettings={() => setPage('settings')}
        onLogout={onLogout}
        onNotificationOpen={handleNotificationOpen}
        onViewAllNotifications={() => setPage('notifications')}
      />

      <main id="bhc-dashboard" className={`bhc-main ${page === 'patients' ? 'bhc-patients-main' : ''}`}>
        {page === 'patients' ? (
          <BHCPatientList
            currentUserName={currentUserName}
            onBack={() => setPage('dashboard')}
            onPatientSaved={handlePatientSaved}
            onPatientUpdated={handlePatientUpdated}
            onReferralSubmit={handleReferralSubmit}
            onMedicineRequestCreated={handlePatientMedicineRequestCreated}
            onOpenMedicineDistribution={() => setPage('medicineDistribution')}
          />
        ) : page === 'referred' ? (
          <BHCReferredPatients
            referrals={submittedReferrals}
            onBack={() => setPage('dashboard')}
            onReferralUpdated={handleReferralUpdated}
          />
        ) : page === 'trackPatients' ? (
          <BHCTrackPatients referrals={submittedReferrals} onBack={() => setPage('dashboard')} />
        ) : page === 'inventory' ? (
          <BHCMedicineInventory
            currentUserName={currentUserName}
            onBack={() => setPage('dashboard')}
            onRequestSubmit={handleMedicineRequestSubmit}
          />
        ) : page === 'medicineDistribution' ? (
          <BHCMedicineDistribution
            onDistributionSaved={handleMedicineDistributionSaved}
            onOpenInventory={() => setPage('inventory')}
          />
        ) : page === 'medicineRequests' ? (
          <BHCMedicineRequests
            requests={medicineRequests}
            onBack={() => setPage('dashboard')}
            onRequestUpdated={handleMedicineRequestUpdated}
          />
        ) : page === 'settings' ? (
          <BHCSettings onBack={() => setPage('dashboard')} />
        ) : page === 'healthMap' ? (
          <CHOHealthMap barangayScoped />
        ) : page === 'analytics' ? (
          <OutbreakAnalyticsPage role="bhc" onOpenDetail={openAnalyticsDetail} />
        ) : page === 'analyticsDetail' ? (
          <OutbreakAnalyticsDetailPage
            detailType={analyticsDetailType}
            role="bhc"
            onBack={() => setPage('analytics')}
          />
        ) : page === 'reports' ? (
          <ReportsPage role="bhc" />
        ) : page === 'profile' ? (
          <ProfilePage roleLabel="Barangay Health Center Staff" />
        ) : page === 'notifications' ? (
          <NotificationsPage role="bhc"
            notifications={notifications}
            onNotificationOpen={handleNotificationOpen}
            onMarkAllRead={handleMarkAllNotificationsRead}
          />
        ) : (
          <>
        <div className="bhc-page-heading">
          <div>
            <span>Barangay Health Center</span>
            <h1>Dashboard</h1>
            <p>Here are your important tasks, patient updates, and medicine alerts.</p>
          </div>
          <div className="bhc-date-card">
            <CalendarDays size={18} />
            <span>{formatDisplayDate()}</span>
          </div>
        </div>

        <section className="bhc-stats-grid" aria-label="BHC summary">
          {dashboardStats.map((stat) => {
            const Icon = stat.icon
            return (
              <article className={`bhc-stat-card ${stat.tone}`} key={stat.label}>
                <div className="bhc-stat-icon">
                  <Icon size={24} />
                </div>
                <span>{stat.label}</span>
                <strong>{formatNumber(stat.value)}</strong>
              </article>
            )
          })}
        </section>

        <section className="bhc-content-grid">
          <article className="bhc-panel bhc-map-panel">
            <div className="bhc-panel-heading">
              <div>
                <span>All Diseases</span>
                <h2>{mapScopeLabel} Purok Disease Monitoring</h2>
              </div>
              <MapPin size={18} />
            </div>
            <DashboardMapPreview features={mapPreview.features || []} onOpen={() => setPage('healthMap')} />
          </article>

          <article className="bhc-panel">
            <div className="bhc-panel-heading">
              <div>
                <span>Patients</span>
                <h2>Recent Referrals</h2>
              </div>
              <HeartPulse size={18} />
            </div>
            <div className="bhc-table">
              {recentReferralRows.length > 0 ? recentReferralRows.map((referral) => (
                <div className="bhc-table-row" key={referral.id}>
                  <div>
                    <strong>{referral.patient}</strong>
                    <span>{referral.specialty || referral.chiefComplaint}</span>
                  </div>
                  <span className={`status ${referral.status.toLowerCase().replace(' ', '-')}`}>
                    {referral.status}
                  </span>
                  <time>{formatShortDate(referral.date)}</time>
                </div>
              )) : (
                <div className="bhc-table-row">
                  <div>
                    <strong>No referrals yet</strong>
                    <span>Create a referral from the patient list</span>
                  </div>
                </div>
              )}
            </div>
          </article>

          <article className="bhc-panel">
            <div className="bhc-panel-heading">
              <div>
                <span>Medicine</span>
                <h2>Inventory Watch</h2>
              </div>
              <PackageCheck size={18} />
            </div>
            <div className="bhc-medicine-list">
              {inventoryWatchRows.length > 0 ? inventoryWatchRows.map((medicine) => {
                const isLowStock = Number(medicine.stocks || 0) < LOW_STOCK_THRESHOLD
                return (
                  <div key={medicine.backendId || medicine.id}>
                    <Pill size={18} />
                    <div>
                      <strong>{medicine.name}</strong>
                      <span>{formatNumber(medicine.stocks)} unit/s</span>
                    </div>
                    <em>{isLowStock ? 'Low Stock' : 'Stable'}</em>
                  </div>
                )
              }) : (
                <div>
                  <Pill size={18} />
                  <div>
                    <strong>No inventory yet</strong>
                    <span>Add medicine inventory</span>
                  </div>
                  <em>Empty</em>
                </div>
              )}
            </div>
          </article>

          <article className="bhc-panel bhc-analytics-panel">
            <div className="bhc-panel-heading">
              <div>
                <span>{analyticsScopeLabel}</span>
                <h2>12-Month Disease Trend</h2>
              </div>
              <TrendingUp size={18} />
            </div>
            <DashboardAnalyticsPreview linkClassName="bhc-analytics-link" history={analyticsPreview?.monthly_history || []} onOpen={() => setPage('analytics')} />
          </article>
        </section>
          </>
        )}
      </main>
    </div>
  )
}

export default BHCDashboard


