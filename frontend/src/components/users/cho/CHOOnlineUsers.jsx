import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Phone, Search, UserCheck } from 'lucide-react'
import { fetchOnlineUsers } from '../../../services/users'

const formatTime = (dateValue) => {
  if (!dateValue) return 'Not logged in'

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateValue))
}

function CHOOnlineUsers() {
  const [onlineData, setOnlineData] = useState({
    stats: {
      total_online: 0,
      doctors: 0,
      barangay_health_workers: 0,
      patients: 0,
    },
    staff: [],
    patients: [],
  })
  const [patientSearch, setPatientSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true
    let intervalId

    const loadOnlineUsers = async (showLoading = false) => {
      if (showLoading && isMounted) {
        setIsLoading(true)
      }

      try {
        const backendOnlineUsers = await fetchOnlineUsers()
        if (isMounted) {
          setOnlineData(backendOnlineUsers)
          setError('')
        }
      } catch {
        if (isMounted) {
          setError('Unable to load online users from the backend.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadOnlineUsers(true)
    intervalId = window.setInterval(() => loadOnlineUsers(false), 5000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const onlineStats = [
    { label: 'Total Online', value: onlineData.stats.total_online, tone: 'orange' },
    { label: 'Doctors', value: onlineData.stats.doctors, tone: 'green' },
    { label: 'OPD Personnel', value: onlineData.stats.opd || 0, tone: 'blue' },
    { label: 'Pharmacists', value: onlineData.stats.pharmacists || 0, tone: 'teal' },
    { label: 'Barangay Health Workers', value: onlineData.stats.barangay_health_workers, tone: 'blue' },
    { label: 'Patients', value: onlineData.stats.patients, tone: 'teal' },
  ]

  const filteredPatients = useMemo(() => {
    const searchText = patientSearch.trim().toLowerCase()

    if (!searchText) return onlineData.patients

    return onlineData.patients.filter((patient) =>
      [patient.name, patient.barangay].some((value) => value.toLowerCase().includes(searchText)),
    )
  }, [onlineData.patients, patientSearch])

  return (
    <>
      <div className="cho-page-heading">
        <div>
          <span>Manage Users</span>
          <h1>Online Users</h1>
          <p>Monitor active staff accounts and patients currently online.</p>
        </div>
      </div>

      <section className="cho-online-page">
        <div className="cho-online-main">
          <article className="cho-online-summary">
            <h2>Online Users</h2>
            <div className="cho-online-stat-list">
              {onlineStats.map((stat) => (
                <div key={stat.label}>
                  <span>{stat.label}</span>
                  <strong className={stat.tone}>{stat.value}</strong>
                </div>
              ))}
            </div>
          </article>

          {isLoading ? (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              Loading online users...
            </div>
          ) : error ? (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              {error}
            </div>
          ) : onlineData.staff.length > 0 ? (
            <div className="cho-online-staff-grid">
              {onlineData.staff.map((staff) => (
                <article className="cho-online-staff-card" key={staff.id}>
                  <header>
                    <strong>{staff.name}</strong>
                    <span>{staff.role}</span>
                  </header>
                  <div className="cho-online-contact">
                    <span>{staff.contact}</span>
                    <button type="button" aria-label={`Call ${staff.name}`}>
                      <Phone size={13} />
                    </button>
                  </div>
                  <p>{staff.area}</p>
                  <footer>
                    <span>{staff.status}</span>
                    <time>{formatTime(staff.last_login)}</time>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              No staff accounts are online right now.
            </div>
          )}
        </div>

        <aside className="cho-online-patients">
          <header>
            <div>
              <h2>Online Patients</h2>
              <strong>{filteredPatients.length}</strong>
            </div>
            <label>
              <Search size={14} />
              <input
                type="search"
                placeholder="Search patient"
                value={patientSearch}
                onChange={(event) => setPatientSearch(event.target.value)}
              />
            </label>
          </header>

          <div className="cho-online-patient-list">
            {filteredPatients.map((patient) => (
              <div key={patient.id}>
                <div>
                  <strong>{patient.name}</strong>
                  <span>{patient.barangay}</span>
                </div>
                <UserCheck size={14} />
              </div>
            ))}
          </div>
        </aside>
      </section>
    </>
  )
}

export default CHOOnlineUsers
