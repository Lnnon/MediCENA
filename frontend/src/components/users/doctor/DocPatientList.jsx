import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Filter, Loader2, Search } from 'lucide-react'
import DocPatientRecordDialog from './DocPatientRecordDialog'
import SearchableReferralSelect from '../shared/SearchableReferralSelect'
import './DocConsultationLayout.css'

function DocPatientList({ referrals = [], isLoading = false, errorMessage = '' }) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [barangayFilter, setBarangayFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [filterResetKey, setFilterResetKey] = useState(0)
  const [selectedPatientId, setSelectedPatientId] = useState(null)

  const patients = useMemo(() => {
    const byPatient = new Map()

    const sortedReferrals = [...referrals].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
    sortedReferrals.forEach((referral) => {
      if (!referral.patientId || byPatient.has(referral.patientId)) return
      byPatient.set(referral.patientId, {
        id: referral.patientId,
        name: referral.patient,
        contactNumber: referral.contactNumber,
        gender: referral.sex,
        age: typeof referral.age === 'number' ? `${referral.age} years old` : referral.age || 'Age not set',
        birthDate: referral.birthDate || 'No DOB',
        barangay: referral.barangay,
        municipality: 'Lucena City',
        status: referral.status,
        latestReferral: referral.code,
        referralDate: referral.date || '',
        chiefComplaint: referral.chiefComplaint,
      })
    })

    return [...byPatient.values()]
  }, [referrals])
  const barangayOptions = useMemo(() => [
    { value: '', label: 'All Barangays' },
    ...[...new Set(patients.map((patient) => patient.barangay?.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)).map((barangay) => ({ value: barangay, label: barangay })),
  ], [patients])

  const filteredPatients = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()

    return patients.filter((patient) => {
      const matchesSearch =
        !keyword ||
        [patient.name, patient.contactNumber, patient.barangay, patient.municipality, patient.latestReferral]
          .some((value) => String(value || '').toLowerCase().includes(keyword))

      return matchesSearch &&
        (!barangayFilter || patient.barangay?.trim() === barangayFilter) &&
        (!dateFilter || patient.referralDate.slice(0, 10) === dateFilter)
    })
  }, [patients, searchKeyword, barangayFilter, dateFilter])

  return (
    <>
      <div className="doc-page-heading">
        <div>
          <span>Patient</span>
          <h1>Patient List</h1>
          <p>Search, filter, and review patient records assigned to you.</p>
        </div>
      </div>

      <section className="doc-patient-page doc-consultation-page doc-consultation-organized">
        <section className="doc-consultation-filters doc-page-filter-row" aria-label="Filter patients">
          <label>
            <span>Search patient</span>
            <div>
              <Search size={15} />
              <input
                type="search"
                placeholder="Search patient, barangay, code..."
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
              />
            </div>
          </label>
          <label>
            <span>Barangay</span>
            <SearchableReferralSelect key={filterResetKey} name="patientBarangayFilter" label="Barangay" placeholder="Type to search barangays..." items={barangayOptions} menuClassName="doc-barangay-options" onValueChange={setBarangayFilter} />
          </label>
          <label>
            <span>Latest Referral Date</span>
            <div><CalendarDays size={15} /><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div>
          </label>
          <button className="filter-button" type="button" onClick={() => { setSearchKeyword(''); setBarangayFilter(''); setDateFilter(''); setFilterResetKey((key) => key + 1) }}>
            <Filter size={15} />
            Reset Filters
          </button>
          </section>

        <article className="doc-patient-list-panel">
          <h2>Patient List</h2>
          <p className="doc-consultation-filter-summary" role="status">{filteredPatients.length} patient{filteredPatients.length === 1 ? '' : 's'} · {barangayFilter || 'All Barangays'}</p>
          {isLoading ? (
            <div className="patient-alert">
              <Loader2 className="cho-map-spin" size={16} />
              Loading assigned patients...
            </div>
          ) : errorMessage ? (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              {errorMessage}
            </div>
          ) : filteredPatients.length > 0 ? (
            <div className="bhc-patient-table-wrap">
              <table className="bhc-patient-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Gender</th>
                    <th>Age / DOB</th>
                    <th>Barangay</th>
                    <th>Referral</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} className="doc-patient-record-row" onClick={() => setSelectedPatientId(patient.id)}>
                      <td>
                        <button type="button" className="doc-patient-record-link" aria-haspopup="dialog" onClick={(event) => { event.stopPropagation(); setSelectedPatientId(patient.id) }}>{patient.name}</button>
                        <span>{patient.contactNumber}</span>
                      </td>
                      <td>
                        <strong>{patient.gender}</strong>
                        <span>{patient.status}</span>
                      </td>
                      <td>
                        <strong>{patient.age}</strong>
                        <span>{patient.birthDate}</span>
                      </td>
                      <td>
                        <strong>{patient.barangay}</strong>
                        <span>{patient.municipality}</span>
                      </td>
                      <td>
                        <strong>{patient.latestReferral}</strong>
                        <span>{patient.chiefComplaint}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              No assigned patients found.
            </div>
          )}
        </article>
      </section>
      {patients.some((patient) => patient.id === selectedPatientId) && <DocPatientRecordDialog
        patient={patients.find((patient) => patient.id === selectedPatientId)}
        referrals={referrals.filter((referral) => referral.patientId === selectedPatientId)}
        onClose={() => setSelectedPatientId(null)}
      />}
    </>
  )
}

export default DocPatientList
