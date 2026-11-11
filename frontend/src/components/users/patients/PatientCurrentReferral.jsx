import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarDays, Clock, FileText, HeartPulse, Loader2, MapPin } from 'lucide-react'
import { fetchReferrals } from '../../../services/referrals'

const referralSteps = ['Referred', 'Seen', 'Accepted', 'Assigned', 'Arrived', 'Admitted', 'Completed']

const formatStatus = (status) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ') : 'Pending'

const getCurrentStep = (referral) => {
  if (!referral) return 0
  const normalizedStatus = referral.status?.toLowerCase()
  if (['rejected', 'cancelled'].includes(normalizedStatus)) return -1

  if (normalizedStatus === 'completed') return 6
  if (normalizedStatus === 'admitted') return 5
  if (normalizedStatus === 'arrived') return 4
  if (normalizedStatus === 'assigned') return 3
  if (normalizedStatus === 'accepted') return 2
  if (normalizedStatus === 'seen') return 1
  if (referral.assignedDoctor && referral.assignedDoctor !== 'Unassigned') return 3
  return 0
}

function PatientCurrentReferral() {
  const [referrals, setReferrals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const hasLoadedReferrals = useRef(false)

  useEffect(() => {
    let isMounted = true

    const loadReferrals = async () => {
      if (!hasLoadedReferrals.current) {
        setIsLoading(true)
      }
      try {
        const backendReferrals = await fetchReferrals()
        if (!isMounted) return
        setReferrals(backendReferrals)
        setErrorMessage('')
      } catch {
        if (isMounted) setErrorMessage('Unable to load your current referral from the backend.')
      } finally {
        if (isMounted) {
          hasLoadedReferrals.current = true
          setIsLoading(false)
        }
      }
    }

    loadReferrals()
    const intervalId = window.setInterval(loadReferrals, 3000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const activeReferral = useMemo(
    () => referrals.find((referral) => !['completed', 'cancelled', 'rejected'].includes(referral.status)) || null,
    [referrals],
  )
  const currentStep = getCurrentStep(activeReferral)

  return (
    <>
      <div className="patient-page-heading">
        <div>
          <span>Referral</span>
          <h1>Current Referral</h1>
          <p>View the status of your active referral submitted from the BHC.</p>
        </div>
      </div>

      {isLoading ? (
        <article className="patient-referral-card">
          <div className="patient-referral-note">
            <Loader2 className="cho-map-spin" size={16} />
            <p>Loading your referral status...</p>
          </div>
        </article>
      ) : errorMessage ? (
        <article className="patient-referral-card">
          <div className="patient-referral-note">
            <AlertTriangle size={16} />
            <p>{errorMessage}</p>
          </div>
        </article>
      ) : !activeReferral ? (
        <article className="patient-referral-card">
          <header>
            <div>
              <span>Current Referral</span>
              <h2>No active referral</h2>
              <p>Your active referral will appear here once a BHC submits it.</p>
            </div>
            <strong>Clear</strong>
          </header>
        </article>
      ) : (
      <article className="patient-referral-card">
        <header>
          <div>
            <span>Current Referral</span>
            <h2>{activeReferral.referredTo}</h2>
            <p>Submitted from {activeReferral.referredFrom}</p>
          </div>
          <strong>{formatStatus(activeReferral.status)}</strong>
        </header>

        <div className="patient-referral-details">
          <div>
            <FileText size={17} />
            <span>Referral Code</span>
            <strong>{activeReferral.code}</strong>
          </div>
          <div>
            <CalendarDays size={17} />
            <span>Date Submitted</span>
            <strong>{new Date(activeReferral.date).toLocaleDateString()}</strong>
          </div>
          <div>
            <HeartPulse size={17} />
            <span>Reason</span>
            <strong>{activeReferral.chiefComplaint}</strong>
          </div>
          <div>
            <MapPin size={17} />
            <span>Referred By</span>
            <strong>{activeReferral.referredBy}</strong>
          </div>
        </div>

        <div className="patient-referral-steps" aria-label="Referral status tracking">
          {referralSteps.map((step, index) => (
            <div className={index <= currentStep ? 'complete' : ''} key={step}>
              <span>{index + 1}</span>
              <small>{step}</small>
            </div>
          ))}
        </div>

        <div className="patient-referral-note">
          <Clock size={16} />
          <p>Your referral is currently {formatStatus(activeReferral.status)}. Please wait for the next update from the health office.</p>
        </div>
      </article>
      )}
    </>
  )
}

export default PatientCurrentReferral
