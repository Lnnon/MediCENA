import { AlertTriangle, CalendarDays, CheckCircle2, Eye, Loader2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchReferrals } from '../../../services/referrals'

const completedStatuses = ['completed', 'cancelled', 'rejected']

const formatStatus = (status) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ') : 'Pending'

const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : 'Not set')

function PatientPastReferrals() {
  const [referrals, setReferrals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedReferral, setSelectedReferral] = useState(null)
  const [filters, setFilters] = useState({ search: '', date: '' })

  useEffect(() => {
    let isMounted = true

    const loadReferrals = async () => {
      setIsLoading(true)
      try {
        const backendReferrals = await fetchReferrals()
        if (!isMounted) return
        setReferrals(backendReferrals)
        setErrorMessage('')
      } catch {
        if (isMounted) setErrorMessage('Unable to load your referral history from the backend.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadReferrals()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredReferrals = useMemo(() => {
    const searchText = filters.search.toLowerCase()

    return referrals.filter((referral) => {
      if (!completedStatuses.includes(referral.status)) return false

      const matchesSearch =
        referral.code.toLowerCase().includes(searchText) ||
        referral.referredTo.toLowerCase().includes(searchText) ||
        referral.chiefComplaint.toLowerCase().includes(searchText)
      const matchesDate = !filters.date || referral.date?.slice(0, 10) === filters.date

      return matchesSearch && matchesDate
    })
  }, [filters, referrals])

  const updateFilter = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  return (
    <>
      <div className="patient-page-heading">
        <div>
          <span>Referral</span>
          <h1>Past Referrals</h1>
          <p>Review your completed referrals and filter your history by date.</p>
        </div>
      </div>

      <section className="patient-referral-history-page">
        <aside className="patient-referral-filter">
          <h2>Filter History</h2>
          <label>
            <span>Search</span>
            <div>
              <Search size={15} />
              <input
                type="search"
                placeholder="Code, facility, reason"
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </div>
          </label>
          <label>
            <span>Date</span>
            <div>
              <CalendarDays size={15} />
              <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
            </div>
          </label>
          <button type="button" onClick={() => setFilters({ search: '', date: '' })}>
            Clear Filter
          </button>
        </aside>

        <article className="patient-panel patient-past-referrals">
          <div className="patient-panel-heading">
            <div>
              <span>History</span>
              <h2>Referral Records</h2>
            </div>
            <CheckCircle2 size={18} />
          </div>

          <div className="patient-table">
            {isLoading ? (
              <div className="patient-empty-state">
                <Loader2 className="cho-map-spin" size={16} />
                Loading referral history...
              </div>
            ) : errorMessage ? (
              <div className="patient-empty-state patient-empty-state-error">
                <AlertTriangle size={16} />
                {errorMessage}
              </div>
            ) : filteredReferrals.length === 0 ? (
              <div className="patient-empty-state">No completed referral records found.</div>
            ) : (
            filteredReferrals.map((referral) => (
              <div className="patient-table-row" key={referral.id}>
                <div>
                  <strong>{referral.referredTo}</strong>
                  <span>{referral.code} | {referral.chiefComplaint}</span>
                  <time>{formatDate(referral.date)}</time>
                </div>
                <div className="patient-referral-row-actions">
                  <span className={`status ${referral.status}`}>
                    {formatStatus(referral.status)}
                  </span>
                  <button type="button" onClick={() => setSelectedReferral(referral)}>
                    <Eye size={13} />
                    View Details
                  </button>
                </div>
              </div>
            ))
            )}
          </div>
        </article>
      </section>

      {selectedReferral && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal patient-referral-detail-modal" aria-label="Past referral details">
            <header>
              <h2>Referral Details</h2>
              <button type="button" aria-label="Close referral details" onClick={() => setSelectedReferral(null)}>
                <X size={18} />
              </button>
            </header>

            <div className="patient-referral-detail-body">
              <div>
                <span>Referral Code</span>
                <strong>{selectedReferral.code}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{formatStatus(selectedReferral.status)}</strong>
              </div>
              <div>
                <span>Submitted From</span>
                <strong>{selectedReferral.referredFrom}</strong>
              </div>
              <div>
                <span>Destination</span>
                <strong>{selectedReferral.referredTo}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{formatDate(selectedReferral.date)}</strong>
              </div>
              <div>
                <span>Referred By</span>
                <strong>{selectedReferral.referredBy}</strong>
              </div>
              <div className="full">
                <span>Reason</span>
                <strong>{selectedReferral.chiefComplaint}</strong>
              </div>
              <div className="full">
                <span>Clinical Notes</span>
                <p>{selectedReferral.otherDiagnosis || selectedReferral.callTakenBy || 'No additional notes recorded.'}</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export default PatientPastReferrals
