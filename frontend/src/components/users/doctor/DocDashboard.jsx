import '../shared/MedicalWorkspace.css'
import {
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  HeartPulse,
  Stethoscope,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import DocConsultationPage from './DocConsultationPage'
import DocNavbar from './DocNavbar'
import DocPatientList from './DocPatientList'
import DocReferralPage from './DocReferralPage'
import { createConsultation, fetchConsultations, updateConsultation } from '../../../services/consultations'
import { fetchNotifications, markNotificationRead, markNotificationsRead } from '../../../services/notifications'
import { fetchReferrals, updateReferral } from '../../../services/referrals'
import { fetchCurrentUser } from '../../../services/users'
import DocSettings from './DocSettings'
import NotificationsPage from '../shared/NotificationsPage'
import './DocStyle.css'

const formatNumber = (value) => Number(value || 0).toLocaleString()

const formatDisplayDate = (value = new Date()) => new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  weekday: 'long',
}).format(value)

const formatShortTime = (value) => {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

const getSeenDoctorReferralIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem('doctor_seen_referrals') || '[]'))
  } catch {
    return new Set()
  }
}

function DocDashboard({ onLogout }) {
  const [acceptedReferral, setAcceptedReferral] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [consultations, setConsultations] = useState([])
  const [assignedReferrals, setAssignedReferrals] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(true)
  const [referralError, setReferralError] = useState('')
  const [referralNewCount, setReferralNewCount] = useState(0)


  useEffect(() => {
    let isMounted = true

    const loadDoctorData = async () => {
      try {
        const [backendUser, backendReferrals, backendConsultations] = await Promise.all([
          fetchCurrentUser(),
          fetchReferrals(),
          fetchConsultations(),
        ])
        if (!isMounted) return
        setCurrentUser(backendUser)
        setAssignedReferrals(backendReferrals)
        setReferralError('')
        const consultationReferrals = backendReferrals
          .filter((referral) => referral.status === 'accepted' || referral.status === 'completed')
          .map((referral) => ({
            ...referral,
            consultationRecord: backendConsultations.find((consultation) => consultation.referralId === referral.id) || null,
          }))
        setConsultations(consultationReferrals)
        setReferralNewCount(() => {
          const seenIds = getSeenDoctorReferralIds()
          return backendReferrals
            .filter((referral) => referral.status === 'pending' && !seenIds.has(referral.id))
            .length
        })
      } catch {
        if (isMounted) setReferralError('Unable to load assigned referrals from the backend.')
      } finally {
        if (isMounted) setIsLoadingReferrals(false)
      }
    }

    loadDoctorData()
    const intervalId = window.setInterval(loadDoctorData, 10000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadBackendNotifications = async () => {
      try {
        const backendNotifications = await fetchNotifications()
        if (!isMounted) return
        setNotifications(backendNotifications)
        setReferralNewCount(
          backendNotifications.filter((notification) => !notification.read && notification.targetPage === 'referrals').length,
        )
      } catch {
        // Keep the existing local referral badge if backend notifications are temporarily unavailable.
      }
    }

    loadBackendNotifications()
    const intervalId = window.setInterval(loadBackendNotifications, 5000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])
  const openReferrals = () => {
    localStorage.setItem(
      'doctor_seen_referrals',
      JSON.stringify(assignedReferrals.filter((referral) => referral.status === 'pending').map((referral) => referral.id)),
    )
    setReferralNewCount(0)
    setPage('referrals')
  }


  const handleNotificationOpen = async (notification) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    )
    await markNotificationRead(notification.id).catch(() => null)
    if (notification.targetPage === 'consultation') {
      setPage('consultation')
      return
    }
    if (notification.targetPage === 'patients') {
      setPage('patients')
      return
    }
    setPage(notification.targetPage || 'referrals')
  }

  const handleMarkAllNotificationsRead = () => {
    markNotificationsRead(notifications).catch(() => null)
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, read: true })),
    )
    setReferralNewCount(0)
  }
  const handleAcceptReferral = async (referral) => {
    try {
      const updatedReferral = await updateReferral(referral.id, { status: 'accepted' })
      setAssignedReferrals((currentReferrals) =>
        currentReferrals.map((item) => (item.id === updatedReferral.id ? updatedReferral : item)),
      )
      setConsultations((currentConsultations) => {
        const alreadyAccepted = currentConsultations.some((consultation) => consultation.id === updatedReferral.id)
        return alreadyAccepted ? currentConsultations : [updatedReferral, ...currentConsultations]
      })
      setReferralNewCount((currentCount) => Math.max(0, currentCount - 1))
      setReferralError('')
      return updatedReferral
    } catch {
      setReferralError('Unable to accept referral. Please try again.')
    }
  }

  const handleCompleteConsultation = async (referral, consultationForm) => {
    const diagnosis = consultationForm.diagnosis || referral.chiefComplaint || 'For assessment'
    const treatmentPlan = [
      consultationForm.subjective ? `Subjective findings: ${consultationForm.subjective}` : '',
      consultationForm.objective ? `Objective findings: ${consultationForm.objective}` : '',
      consultationForm.plan,
      consultationForm.medicine ? `Medicine: ${consultationForm.medicine}` : '',
      consultationForm.dosage ? `Dosage: ${consultationForm.dosage}` : '',
      consultationForm.duration ? `Duration: ${consultationForm.duration}` : '',
      consultationForm.disposition ? `Disposition: ${consultationForm.disposition}` : '',
    ].filter(Boolean).join('\n')

    try {
      const consultationPayload = {
        referralId: referral.id,
        diagnosis,
        treatmentPlan: treatmentPlan || 'Managed at CHO.',
      }
      const savedRecord = referral.consultationRecord?.id ? await updateConsultation(referral.consultationRecord.id, consultationPayload) : await createConsultation(consultationPayload)
      const updatedReferral = await updateReferral(referral.id, { status: 'completed' })
      setAssignedReferrals((currentReferrals) =>
        currentReferrals.map((item) => (item.id === updatedReferral.id ? updatedReferral : item)),
      )
      setConsultations((currentConsultations) =>
        currentConsultations.map((consultation) =>
          consultation.id === updatedReferral.id
            ? { ...updatedReferral, consultationRecord: savedRecord }
            : consultation,
        ),
      )
      setReferralError('')
      setPage('consultation')
    } catch (error) {
      setReferralError('Unable to complete consultation. Please try again.')
      throw error
    }
  }
  const activeReferrals = assignedReferrals.filter((referral) => !['completed', 'cancelled', 'rejected'].includes(referral.status))
  const doctorPatientReferrals = assignedReferrals.filter((referral) => ['accepted', 'completed'].includes(referral.status))
  const assignedPatientCount = new Set(doctorPatientReferrals.map((referral) => referral.patientId).filter(Boolean)).size
  const dashboardStats = [
    { label: 'Assigned Patients', value: assignedPatientCount, icon: Users },
    { label: 'Today Consultations', value: consultations.length, icon: CalendarCheck },
    { label: 'Active Referrals', value: activeReferrals.length, icon: HeartPulse },
    { label: 'Completed Notes', value: assignedReferrals.filter((referral) => referral.status === 'completed').length, icon: FileCheck2 },
  ]
  const patientRows = activeReferrals.slice(0, 4)

  return (
    <div className="medical-workspace doc-shell">
      <DocNavbar
        onLogout={onLogout}
        onOpenDashboard={() => setPage('dashboard')}
        onOpenPatients={() => setPage('patients')}
        onOpenReferrals={openReferrals}
        onOpenConsultation={() => setPage('consultation')}
        onOpenSettings={() => setPage('settings')}
        referralNewCount={referralNewCount}
        currentUser={currentUser}
        notifications={notifications}
        unreadCount={notifications.filter((notification) => !notification.read).length}
        onNotificationOpen={handleNotificationOpen}
        onViewAllNotifications={() => setPage('notifications')}
      />

      <main id="doctor-dashboard" className="doc-main">
        {page === 'patients' ? (
          <DocPatientList referrals={doctorPatientReferrals} isLoading={isLoadingReferrals} errorMessage={referralError} />
        ) : page === 'referrals' ? (
          <DocReferralPage
            referrals={assignedReferrals.filter((referral) => referral.status === 'pending')}
            isLoading={isLoadingReferrals}
            errorMessage={referralError}
            onAcceptReferral={handleAcceptReferral}
            onGoToConsultation={(referral) => { setAcceptedReferral(referral); setPage('consultation') }}
          />
        ) : page === 'consultation' ? (
          <DocConsultationPage initialReferral={acceptedReferral} clearInitialReferral={setAcceptedReferral} consultations={consultations} onCompleteConsultation={handleCompleteConsultation} />
        ) : page === 'settings' ? (
          <DocSettings />
        ) : page === 'notifications' ? (
          <NotificationsPage
            notifications={notifications}
            onNotificationOpen={handleNotificationOpen}
            onMarkAllRead={handleMarkAllNotificationsRead}
          />
        ) : (
          <>
        <div className="doc-page-heading">
          <div>
            <span>Doctor Portal</span>
            <h1>Dashboard</h1>
            <p>Review patients, referrals, and consultations assigned to you.</p>
          </div>
          <div className="doc-date-card">
            <CalendarDays size={18} />
            <span>{formatDisplayDate()}</span>
          </div>
        </div>

        <section className="doc-stats-grid" aria-label="Doctor summary">
          {dashboardStats.map((stat) => {
            const Icon = stat.icon
            return (
              <article className="doc-stat-card" key={stat.label}>
                <div className="doc-stat-icon">
                  <Icon size={24} />
                </div>
                <span>{stat.label}</span>
                <strong>{formatNumber(stat.value)}</strong>
              </article>
            )
          })}
        </section>

        <section className="doc-content-grid">
          <article className="doc-panel">
            <div className="doc-panel-heading">
              <div>
                <span>Patient</span>
                <h2>Patient List</h2>
              </div>
              <ClipboardList size={18} />
            </div>
            <div className="doc-table">
              {patientRows.length > 0 ? patientRows.map((referral) => (
                <div className="doc-table-row" key={referral.id}>
                  <div>
                    <strong>{referral.patient}</strong>
                    <span>{referral.specialty || referral.chiefComplaint}</span>
                  </div>
                  <span className="status">{referral.status}</span>
                  <time>{formatShortTime(referral.date)}</time>
                </div>
              )) : (
                <div className="doc-table-row">
                  <div>
                    <strong>No assigned patients</strong>
                    <span>Accepted referrals will appear here</span>
                  </div>
                  <span className="status">Clear</span>
                </div>
              )}
            </div>
          </article>

          <article className="doc-panel">
            <div className="doc-panel-heading">
              <div>
                <span>Consultation</span>
                <h2>Today’s Queue</h2>
              </div>
              <Stethoscope size={18} />
            </div>
            <div className="doc-queue">
              <strong>{formatNumber(consultations.length)}</strong>
              <span>consultations ready today</span>
              <p>{consultations[0] ? `${consultations[0].patient} is ready for assessment.` : 'Accepted referrals will populate the consultation queue.'}</p>
            </div>
          </article>

        </section>
          </>
        )}
      </main>
    </div>
  )
}

export default DocDashboard

