import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, Eye, Filter, Loader2, Search, X } from 'lucide-react'
import SearchableReferralSelect from '../shared/SearchableReferralSelect'
import './DocConsultationLayout.css'

const formatStatus = (status) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ') : 'Pending'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'Not set')

function DocReferralPage({ referrals = [], isLoading = false, errorMessage = '', onAcceptReferral, onGoToConsultation }) {
  const [viewedReferral, setViewedReferral] = useState(null)
  const [accepted, setAccepted] = useState(null)
  const [accepting, setAccepting] = useState(false)
  const confirmation = useRef(null)
  useEffect(() => {
    if (accepted) confirmation.current?.showModal()
  }, [accepted])

  const accept = async (referral) => {
    if (accepting) return
    setAccepting(true)
    try {
      const saved = await onAcceptReferral(referral)
      setViewedReferral(null)
      if (saved) setAccepted(saved)
    } finally {
      setAccepting(false)
    }
  }
  const [filterResetKey, setFilterResetKey] = useState(0)
  const [filters, setFilters] = useState({
    search: '',
    barangay: '',
    date: '',
  })

  const barangays = useMemo(
    () => [...new Set(referrals.map((referral) => referral.barangay).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [referrals],
  )

  const filteredReferrals = useMemo(() => {
    return referrals.filter((referral) => {
      const searchText = filters.search.toLowerCase()
      const matchesSearch =
        referral.patient.toLowerCase().includes(searchText) ||
        referral.code.toLowerCase().includes(searchText) ||
        referral.referredFrom.toLowerCase().includes(searchText)

      return (
        matchesSearch &&
        (!filters.barangay || referral.barangay === filters.barangay) &&
        (!filters.date || referral.date?.slice(0, 10) === filters.date)
      )
    })
  }, [filters, referrals])

  const updateFilter = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  return (
    <>
      <div className="doc-page-heading">
        <div>
          <span>Referral</span>
          <h1>Referral Page</h1>
          <p>Review referred patients and accept cases assigned to your service.</p>
        </div>
      </div>

      <section className="doc-referral-page doc-consultation-page doc-consultation-organized doc-referrals-organized">
        <section className="doc-consultation-filters doc-page-filter-row" aria-label="Filter referrals">
          <label>
            <span>Search</span>
            <div>
              <Search size={15} />
              <input
                type="search"
                placeholder="Search patient or code"
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </div>
          </label>
          <label>
            <span>Barangay</span>
            <SearchableReferralSelect key={filterResetKey} name="referralBarangayFilter" label="Barangay" placeholder="Type to search barangays..." items={[{ value: '', label: 'All Barangays' }, ...barangays.map((barangay) => ({ value: barangay, label: barangay }))]} menuClassName="doc-barangay-options" onValueChange={(value) => updateFilter('barangay', value)} />
          </label>
          <label>
            <span>Date</span>
            <div>
              <CalendarDays size={15} />
              <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
            </div>
          </label>
          <button className="filter-button" type="button" onClick={() => { setFilters({ search: '', barangay: '', date: '' }); setFilterResetKey((key) => key + 1) }}>
            <Filter size={15} />
            Reset Filters
          </button>
          </section>

        <div className="doc-referred-list doc-patient-list-panel">
          <h2>Referral List</h2>
          <p className="doc-consultation-filter-summary" role="status">{filteredReferrals.length} referral{filteredReferrals.length === 1 ? '' : 's'} · {filters.barangay || 'All Barangays'}</p>
          {isLoading ? (
            <article className="doc-referral-empty">
              <Loader2 className="cho-map-spin" size={18} />
              <div>
                <h2>Loading referrals</h2>
                <p>Fetching assigned cases from the backend.</p>
              </div>
            </article>
          ) : errorMessage ? (
            <article className="doc-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>Unable to load referrals</h2>
                <p>{errorMessage}</p>
              </div>
            </article>
          ) : filteredReferrals.length > 0 ? (
            <div className="bhc-patient-table-wrap">
              <table className="bhc-patient-table doc-referral-list-table">
                <thead><tr><th>Patient</th><th>Barangay / Source</th><th>Referral / Specialty</th><th>Chief Complaint</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{filteredReferrals.map((referral) => <tr key={referral.id}>
                  <td><button type="button" className="doc-referral-name-button" aria-haspopup="dialog" onClick={() => setViewedReferral(referral)}>{referral.patient}</button><span>{typeof referral.age === 'number' ? `${referral.age} years old` : referral.age || 'Age not set'}</span></td>
                  <td><strong>{referral.barangay}</strong><span>{referral.referredFrom}</span></td>
                  <td><strong>{referral.code}</strong><span>{referral.specialty}</span></td>
                  <td>{referral.chiefComplaint}</td>
                  <td>{formatDate(referral.date)}</td>
                  <td><span className="doc-referral-list-status" data-status={referral.status}>{formatStatus(referral.status)}</span></td>
                  <td><div className="doc-referral-actions">
                    <button className="primary-action-button" type="button" onClick={() => setViewedReferral(referral)}><Eye size={14} />View Form</button>
                    <button className="success-action-button" type="button" disabled={accepting || referral.status === 'accepted' || referral.status === 'completed'} onClick={() => accept(referral)}><Check size={14} />{referral.status === 'accepted' ? 'Accepted' : referral.status === 'completed' ? 'Completed' : 'Accept'}</button>
                  </div></td>
                </tr>)}</tbody>
              </table>
            </div>
          ) : (
            <article className="doc-referral-empty">
              <AlertTriangle size={18} />
              <div>
                <h2>No referrals found</h2>
                <p>Assigned referrals from the backend will appear here.</p>
              </div>
            </article>
          )}
        </div>
      </section>

      {accepted && <dialog ref={confirmation} className="doc-accept-confirmation" aria-labelledby="accepted-title" onClose={() => setAccepted(null)}>
        <h2 id="accepted-title">Referral accepted</h2>
        <p>Open the consultation form for <strong>{accepted.patient}</strong> ({accepted.code})?</p>
        <footer><button type="button" className="secondary-action-button" onClick={() => confirmation.current.close()}>Stay on Referrals</button>
          <button type="button" className="primary-action-button" autoFocus onClick={() => onGoToConsultation(accepted)}>Go to Consultation</button></footer>
      </dialog>}

      {viewedReferral && (
        <div className="patient-modal-backdrop" role="presentation">
          <article className="patient-modal doc-referral-modal doc-referral-landscape" role="dialog" aria-modal="true" aria-label="Referral form">
            <header>
              <h2>Referral Form</h2>
              <button type="button" aria-label="Close referral form" onClick={() => setViewedReferral(null)}>
                <X size={18} />
              </button>
            </header>
            <dl className="doc-referral-form-view">
              <div>
                <dt>Patient</dt>
                <dd>{viewedReferral.patient}</dd>
              </div>
              <div>
                <dt>Referral Code</dt>
                <dd>{viewedReferral.code}</dd>
              </div>
              <div>
                <dt>Age / Sex</dt>
                <dd>{viewedReferral.age} years old / {viewedReferral.sex}</dd>
              </div>
              <div>
                <dt>Barangay</dt>
                <dd>{viewedReferral.barangay}</dd>
              </div>
              <div>
                <dt>Referred From</dt>
                <dd>{viewedReferral.referredFrom}</dd>
              </div>
              <div>
                <dt>Specialty</dt>
                <dd>{viewedReferral.specialty}</dd>
              </div>
              <div className="wide">
                <dt>Chief Complaint</dt>
                <dd>{viewedReferral.chiefComplaint}</dd>
              </div>
              <div>
                <dt>Blood Pressure</dt>
                <dd>{viewedReferral.bp}</dd>
              </div>
              <div>
                <dt>Temperature</dt>
                <dd>{viewedReferral.temperature}</dd>
              </div>
              <div>
                <dt>O2 Saturation</dt>
                <dd>{viewedReferral.o2sat}</dd>
              </div>
              <div>
                <dt>Heart Rate</dt>
                <dd>{viewedReferral.cardiacRate}</dd>
              </div>
              <div>
                <dt>Respiration Rate</dt>
                <dd>{viewedReferral.respirationRate}</dd>
              </div>
              <div>
                <dt>Date Referred</dt>
                <dd>{formatDate(viewedReferral.date)}</dd>
              </div>
            </dl>
            <footer className="doc-referral-modal-actions">
              <button type="button" className="secondary-action-button" onClick={() => setViewedReferral(null)}>
                Close
              </button>
              <button
                type="button"
                className="success-action-button"
                disabled={accepting || ['accepted', 'completed'].includes(viewedReferral.status)}
                onClick={() => accept(viewedReferral)}
              >
                <Check size={14} />
                Accept Referral
              </button>
            </footer>
          </article>
        </div>
      )}
    </>
  )
}

export default DocReferralPage
