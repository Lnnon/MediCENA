import BHCFilterToolbar from '../bhc/BHCFilterToolbar'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, ArrowLeft, BarChart3, Boxes, Download, FileText, Loader2, Pill, Printer, Route, Send, ShieldCheck, Stethoscope } from 'lucide-react'
import { fetchOutbreakAnalytics, fetchPurokDiseaseMap } from '../../../services/gis'
import { fetchMedicineInventory, fetchMedicineRequestsForBhc, fetchMedicineRequestsForCho, fetchPatientMedicineDistributions } from '../../../services/medicines'
import { fetchPatients } from '../../../services/patients'
import { fetchReferrals } from '../../../services/referrals'
import './ReportsWorkspaceUI.css'

const formatDate = (value) => {
  if (!value) return 'Not dated'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value))
}

const getStatusCounts = (items, field = 'status') => items.reduce((counts, item) => {
  const status = item[field] || 'unknown'
  return { ...counts, [status]: (counts[status] || 0) + 1 }
}, {})

const reportTitles = {
  summary: 'Monitoring Summary',
  referrals: 'Referrals',
  medicineRequests: 'Medicine Requests',
  inventory: 'Inventory',
  distributions: 'Medicine Distribution',
  patientDistributions: 'Patient Medicine Distribution',
  diseaseCases: 'Disease Cases',
  outbreaks: 'Outbreak Analytics',
}

const reportCategories = {
  summary: 'Monitoring', referrals: 'Referrals', medicineRequests: 'Medicine', inventory: 'Medicine',
  distributions: 'Medicine', patientDistributions: 'Medicine', diseaseCases: 'Monitoring', outbreaks: 'Monitoring',
}

const reportOptions = [
  { id: 'summary', title: 'Summary', description: 'Overall monitoring metrics and workflow status.', icon: FileText },
  { id: 'referrals', title: 'Referrals', description: 'Patient referral records and status details.', icon: Send },
  { id: 'medicineRequests', title: 'Medicine Requests', description: 'Requested medicines and fulfillment status.', icon: Pill },
  { id: 'inventory', title: 'Inventory', description: 'Medicine stock levels by facility.', icon: Boxes },
  { id: 'distributions', title: 'Distribution', description: 'Medicine dispatches and BHC receipt confirmations.', icon: Boxes },
  { id: 'patientDistributions', title: 'Patient Distribution', description: 'Medicine quantities released to patients by BHC.', icon: Pill },
  { id: 'diseaseCases', title: 'Disease Cases', description: 'GIS case totals by barangay and purok.', icon: BarChart3 },
  { id: 'outbreaks', title: 'Outbreak Analytics', description: 'Risk levels, alerts, and outbreak trends.', icon: Activity },
]

const downloadCsv = (filename, rows) => {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function ReferralExport({ rows, onClose }) {
  const dialog = useRef(null)
  const [selected, setSelected] = useState([])
  const groups = useMemo(() => {
    const grouped = new Map()
    for (const row of rows) {
      const name = row.barangay?.trim() || 'No barangay'
      const key = name.toLowerCase()
      if (!grouped.has(key)) grouped.set(key, { key, name, rows: [] })
      grouped.get(key).rows.push(row)
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])
  const selectedRows = groups.filter((group) => selected.includes(group.key)).flatMap((group) => group.rows)

  useEffect(() => {
    dialog.current.showModal()
  }, [])

  return (
    <dialog className="referral-export-dialog" ref={dialog} onClose={onClose} aria-labelledby="referral-export-title">
      <h2 id="referral-export-title">Export referrals by barangay</h2>
      {groups.length ? (
        <fieldset>
          <legend>Choose barangays to include in the CSV</legend>
          {groups.map(({ key, name, rows: records }) => (
            <label key={key}>
              <input type="checkbox" checked={selected.includes(key)} onChange={(event) => {
                const checked = event.target.checked
                setSelected((current) => checked ? [...current, key] : current.filter((value) => value !== key))
              }} />
              {name}<small>{records.length} {records.length === 1 ? 'referral' : 'referrals'}</small>
            </label>
          ))}
        </fieldset>
      ) : <p>No referral history is available to export.</p>}
      <div className="reports-actions">
        <button type="button" onClick={() => dialog.current.close()}>Cancel</button>
        <button type="button" disabled={!selectedRows.length} onClick={() => {
          downloadCsv('mediflow-referrals-report.csv', selectedRows)
          dialog.current.close()
        }}>Download CSV ({selectedRows.length})</button>
      </div>
    </dialog>
  )
}

function ReportsPage({ role = 'cho' }) {
  const clinical = role !== 'pharmacist'
  const pharmacy = role !== 'opd' && role !== 'doctor'
  const monitoring = role === 'cho' || role === 'bhc'
  const options = reportOptions.filter((item) => item.id === 'summary' || (item.id === 'referrals' && clinical) || (['medicineRequests', 'inventory', 'distributions'].includes(item.id) && pharmacy) || (['diseaseCases', 'outbreaks', 'patientDistributions'].includes(item.id) && monitoring))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const visibleOptions = role === 'bhc' ? options.filter((option) => {
    const group = reportCategories[option.id]
    return (!category || category === group) && [option.title, option.description, group].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  }) : options
  const [reportData, setReportData] = useState({
    patients: [],
    referrals: [],
    medicineRequests: [],
    inventory: [],
    patientDistributions: [],
    diseaseCases: [],
    outbreakAnalytics: null,
  })
  const [choosingBarangays, setChoosingBarangays] = useState(false)
  const [selectedReport, setSelectedReport] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadReports = async () => {
      try {
        setIsLoading(true)
        const [patients, referrals, medicineRequests, inventory, diseaseMap, outbreakAnalytics, patientDistributions] = await Promise.all([
          clinical ? fetchPatients() : Promise.resolve([]),
          clinical ? fetchReferrals() : Promise.resolve([]),
          pharmacy ? (role === 'bhc' ? fetchMedicineRequestsForBhc() : fetchMedicineRequestsForCho()) : Promise.resolve([]),
          pharmacy ? fetchMedicineInventory(role === 'cho') : Promise.resolve([]),
          monitoring ? fetchPurokDiseaseMap() : Promise.resolve({ features: [] }),
          monitoring ? fetchOutbreakAnalytics() : Promise.resolve(null),
          monitoring ? fetchPatientMedicineDistributions() : Promise.resolve([]),
        ])

        if (!isMounted) return

        setReportData({
          patients,
          referrals,
          medicineRequests,
          inventory,
          diseaseCases: diseaseMap.features || [],
          outbreakAnalytics,
          patientDistributions,
        })
        setErrorMessage('')
      } catch {
        if (isMounted) {
          setErrorMessage('Unable to load report data from the backend.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadReports()

    return () => {
      isMounted = false
    }
  }, [role, clinical, pharmacy, monitoring])

  const summaries = useMemo(() => {
    const totalCases = reportData.diseaseCases.reduce((sum, feature) => sum + Number(feature.properties?.cases || 0), 0)
    const lowStock = reportData.inventory.filter((medicine) => Number(medicine.stocks) <= 10).length
    const pendingReferrals = reportData.referrals.filter((referral) => referral.status === 'pending').length
    const pendingMedicine = reportData.medicineRequests.filter((request) => request.rawStatus === 'requested').length
    const highRiskDiseases = reportData.outbreakAnalytics?.summary?.high_risk_diseases || 0

    return [
      { label: 'Patients', value: reportData.patients.length, icon: Stethoscope },
      { label: 'Referrals', value: reportData.referrals.length, icon: Send },
      { label: 'Medicine Requests', value: reportData.medicineRequests.length, icon: Pill },
      { label: 'Inventory Items', value: reportData.inventory.length, icon: Boxes },
      { label: 'Disease Cases', value: totalCases, icon: BarChart3 },
      { label: 'Outbreak Risk', value: highRiskDiseases, icon: Activity },
      { label: 'Needs Attention', value: pendingReferrals + pendingMedicine + lowStock + highRiskDiseases, icon: AlertTriangle },
    ].filter((item) => !(['Patients', 'Referrals'].includes(item.label) && !clinical) && !(['Medicine Requests', 'Inventory Items'].includes(item.label) && !pharmacy) && !(['Disease Cases', 'Outbreak Risk'].includes(item.label) && !monitoring))
  }, [reportData, clinical, pharmacy, monitoring])

  const referralStatus = useMemo(() => getStatusCounts(reportData.referrals), [reportData.referrals])
  const medicineStatus = useMemo(() => getStatusCounts(reportData.medicineRequests, 'rawStatus'), [reportData.medicineRequests])
  const topDiseaseAreas = useMemo(() => {
    return [...reportData.diseaseCases]
      .sort((first, second) => Number(second.properties?.cases || 0) - Number(first.properties?.cases || 0))
      .slice(0, 8)
  }, [reportData.diseaseCases])
  const outbreakDiseases = useMemo(() => reportData.outbreakAnalytics?.diseases || [], [reportData.outbreakAnalytics])
  const activeOutbreakDiseases = useMemo(() => {
    return outbreakDiseases
      .filter((disease) => disease.risk_level !== 'normal' || disease.is_common_ph_outbreak)
      .slice(0, 8)
  }, [outbreakDiseases])

  const exportRows = useMemo(() => {
    if (selectedReport === 'patientDistributions') {
      return reportData.patientDistributions.map((item) => ({ patient: item.patientName, barangay: item.barangay, medicine: item.medicineName, quantity: item.quantity, facility: item.facility, instructions: item.instructions, distributed_by: item.distributedBy, date: item.distributedAt }))
    }
    if (selectedReport === 'referrals') {
      return reportData.referrals.map((referral) => ({
        code: referral.code,
        patient: referral.patient,
        barangay: referral.barangay,
        specialty: referral.specialty,
        status: referral.status,
        date: formatDate(referral.date),
      }))
    }

    if (selectedReport === 'distributions') {
      return reportData.medicineRequests.filter((item) => ['dispatched', 'released'].includes(item.rawStatus)).map((item) => ({ code: item.id, bhc: item.bhc || item.address, medicine: item.medicine || item.medicineName, quantity: item.quantity, status: item.status, dispatched_at: item.dispatchedAt || '', received_at: item.receivedAt || '' }))
    }

    if (selectedReport === 'medicineRequests') {
      return reportData.medicineRequests.map((request) => ({
        code: request.id,
        medicine: request.medicine || request.medicineName,
        quantity: request.quantity,
        barangay: request.barangay || request.address,
        status: request.status,
        date: request.date || request.dateRequested,
      }))
    }

    if (selectedReport === 'inventory') {
      return reportData.inventory.map((medicine) => ({
        id: medicine.id,
        name: medicine.name,
        type: medicine.type,
        dosage: medicine.dosage,
        facility: medicine.facility,
        stocks: medicine.stocks,
        expiry: medicine.expiry,
      }))
    }

    if (selectedReport === 'diseaseCases') {
      return reportData.diseaseCases.map((feature) => ({
        barangay: feature.properties?.barangay,
        purok: feature.properties?.purok_name,
        cases: feature.properties?.cases,
      }))
    }

    if (selectedReport === 'outbreaks') {
      return outbreakDiseases.map((disease) => ({
        disease: disease.disease,
        category: disease.category,
        risk_level: disease.risk_level,
        gis_cases: disease.gis_cases,
        referrals: disease.referrals,
        recent_referrals: disease.recent_referrals,
        pending_referrals: disease.pending_referrals,
      }))
    }

    return summaries.map((summary) => ({ metric: summary.label, value: summary.value }))
  }, [outbreakDiseases, reportData, selectedReport, summaries])

  return (
    <div className="reports-workspace-ui">
      <div className="cho-page-heading">
        <div>
          <span>Monitoring</span>
          <h1>Generate Reports</h1>
          <p>View and produce reports from processed MediFlow health coordination data.</p>
        </div>
        {selectedReport && (
          <div className="reports-actions">
            <button type="button" onClick={() => window.print()}>
              <Printer size={15} />
              Print
            </button>
            <button type="button" disabled={isLoading || Boolean(errorMessage)} onClick={() => {
              if (selectedReport === 'referrals') setChoosingBarangays(true)
              else downloadCsv(`mediflow-${selectedReport}-report.csv`, exportRows)
            }}>
              <Download size={15} />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {choosingBarangays && <ReferralExport rows={exportRows} onClose={() => setChoosingBarangays(false)} />}

      {errorMessage && (
        <div className="patient-alert">
          <AlertTriangle size={16} />
          {errorMessage}
        </div>
      )}

      {role === 'bhc' && !selectedReport && <BHCFilterToolbar placeholder="Search reports..." value={query} onSearch={setQuery} active={category}>
        <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>{[...new Set(options.map((item) => reportCategories[item.id]))].map((group) => <option key={group}>{group}</option>)}
        </select></label><button type="button" onClick={() => { setCategory(''); setQuery('') }}>Reset Filters</button>
      </BHCFilterToolbar>}
      {!selectedReport ? (
        <section className="reports-picker-grid">
          {!visibleOptions.length && <p>No matching reports.</p>}
          {visibleOptions.map((report) => {
            const Icon = report.icon
            return (
              <button key={report.id} className="reports-picker-card" type="button" onClick={() => setSelectedReport(report.id)}>
                <Icon size={21} />
                <strong>{report.title}</strong>
                <span>{report.description}</span>
              </button>
            )
          })}
        </section>
      ) : (
      <section className="reports-page reports-page-detail">
        <article className="reports-main">
          <header>
            <div>
              <span>{{ cho: 'City Health Office', bhc: 'Barangay Health Center', opd: 'Outpatient Department', pharmacist: 'CHO Pharmacy', doctor: 'Doctor' }[role]}</span>
              <h2>{reportTitles[selectedReport]}</h2>
            </div>
            <div className="reports-detail-actions">
              <button className="reports-back-button" type="button" onClick={() => setSelectedReport('')}>
                <ArrowLeft size={15} />
                Back
              </button>
              {isLoading ? <Loader2 className="cho-map-spin" size={18} /> : <ShieldCheck size={18} />}
            </div>
          </header>

          {selectedReport === 'summary' && (
            <>
              <div className="reports-summary-grid">
                {summaries.map((summary) => {
                  const Icon = summary.icon
                  return (
                    <article key={summary.label}>
                      <Icon size={18} />
                      <span>{summary.label}</span>
                      <strong>{summary.value}</strong>
                    </article>
                  )
                })}
              </div>

              <div className="reports-detail-grid">
                {clinical && <section>
                  <h3>Referral Status</h3>
                  {Object.entries(referralStatus).length > 0 ? Object.entries(referralStatus).map(([status, count]) => (
                    <div className="report-row" key={status}>
                      <span>{status}</span>
                      <strong>{count}</strong>
                    </div>
                  )) : <p>No referral data yet.</p>}
                </section>}

                {pharmacy && <section>
                  <h3>Medicine Requests</h3>
                  {Object.entries(medicineStatus).length > 0 ? Object.entries(medicineStatus).map(([status, count]) => (
                    <div className="report-row" key={status}>
                      <span>{status}</span>
                      <strong>{count}</strong>
                    </div>
                  )) : <p>No medicine request data yet.</p>}
                </section>}
              </div>

              {monitoring && <section className="reports-flow-card">
                <h3>Referral to Analytics Flow</h3>
                <div className="reports-flow-steps">
                  {(reportData.outbreakAnalytics?.pipeline || []).map((step) => (
                    <div key={step.stage}>
                      <Route size={16} />
                      <strong>{step.stage}</strong>
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              </section>}
            </>
          )}

          {selectedReport === 'outbreaks' && (
            <section className="reports-outbreak-grid">
              {activeOutbreakDiseases.map((disease) => (
                <article className={`reports-outbreak-card ${disease.risk_level}`} key={disease.disease}>
                  <header>
                    <div>
                      <span>{disease.category}</span>
                      <h3>{disease.disease}</h3>
                    </div>
                    <strong>{disease.risk_level}</strong>
                  </header>
                  <div className="reports-outbreak-metrics">
                    <div>
                      <span>GIS cases</span>
                      <strong>{disease.gis_cases}</strong>
                    </div>
                    <div>
                      <span>BHC referrals</span>
                      <strong>{disease.referrals}</strong>
                    </div>
                    <div>
                      <span>Recent referrals</span>
                      <strong>{disease.recent_referrals}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className="reports-table-card">
            <h3>{selectedReport === 'diseaseCases' ? 'Highest Disease Case Areas' : selectedReport === 'outbreaks' ? 'Common Outbreak Diseases' : 'Report Preview'}</h3>
            {selectedReport === 'diseaseCases' ? (
              topDiseaseAreas.map((feature) => (
                <div className="report-row" key={`${feature.properties?.fid}-${feature.properties?.purok_name}`}>
                  <span>{feature.properties?.barangay} - {feature.properties?.purok_name}</span>
                  <strong>{feature.properties?.cases} cases</strong>
                </div>
              ))
            ) : selectedReport === 'outbreaks' ? (
              activeOutbreakDiseases.map((disease) => (
                <div className="report-row" key={disease.disease}>
                  <span>{disease.disease} | {disease.category}</span>
                  <strong>{disease.gis_cases} GIS cases</strong>
                </div>
              ))
            ) : (
              exportRows.slice(0, 8).map((row, index) => (
                <div className="report-row" key={`${selectedReport}-${index}`}>
                  <span>{Object.values(row).slice(0, 2).join(' | ')}</span>
                  <strong>{Object.values(row).at(-1)}</strong>
                </div>
              ))
            )}
          </section>
        </article>
      </section>
      )}
    </div>
  )
}

export default ReportsPage
