import BHCFilterToolbar from '../bhc/BHCFilterToolbar'
import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, TrendingUp } from 'lucide-react'
import { fetchForecastAnalysis } from '../../../services/gis'
import './PanelEnhancements.css'

const number = (value) => value === null || value === undefined ? 'Unavailable' : Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })
const month = (value) => new Date(`${value.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })

function ForecastChart({ series }) {
  const history = series.history || []
  const forecast = series.forecasts || []
  const values = [...history.map((item) => item.actual), ...forecast.map((item) => item.predicted)].filter((item) => item !== null)
  const max = Math.max(1, ...values)
  const length = history.length + forecast.length
  const x = (index) => 48 + index * 624 / Math.max(1, length - 1)
  const y = (value) => 210 - value / max * 160
  const segments = [[]]
  history.forEach((item, index) => {
    if (item.actual === null) { if (segments[segments.length - 1].length) segments.push([]); return }
    segments[segments.length - 1].push(`${x(index)},${y(item.actual)}`)
  })
  const projected = forecast.map((item, index) => `${x(history.length + index)},${y(item.predicted)}`)
  if (projected.length && history.at(-1)?.actual !== null) projected.unshift(`${x(history.length - 1)},${y(history.at(-1).actual)}`)
  return <><div className="forecast-legend"><span>Solid blue: recorded history</span><span>Dashed orange: computed forecast</span><span>Gaps: missing observations</span></div><svg className="forecast-chart" viewBox="0 0 720 260" role="img" aria-label="Historical monthly observations and moving-average forecasts">
    {[0, 1, 2, 3, 4].map((index) => <g key={index}><line x1="48" x2="672" y1={50 + index * 40} y2={50 + index * 40} stroke="#d7e3ee" /><text x="3" y={55 + index * 40}>{number(max * (4 - index) / 4)}</text></g>)}
    {segments.filter((item) => item.length).map((points, index) => <polyline key={index} points={points.join(' ')} fill="none" stroke="#15749a" strokeWidth="3" />)}
    {projected.length > 0 && <polyline points={projected.join(' ')} fill="none" stroke="#dc7b27" strokeWidth="3" strokeDasharray="7 5" />}
    {[...history, ...forecast].map((item, index) => { const value = item.actual ?? item.predicted; return <g key={item.month}>{value !== undefined && value !== null && <circle cx={x(index)} cy={y(value)} r="3" fill={item.predicted === undefined ? '#15749a' : '#dc7b27'} />}{(index % Math.ceil(length / 6) === 0 || index === length - 1) && <text x={x(index)} y="244" textAnchor="middle">{month(item.month)}</text>}</g>})}
  </svg></>
}

function ForecastPanel({ role = 'cho', onOpenMap }) {
  const [filters, setFilters] = useState({ start_date: '', end_date: '', disease_id: '', barangay: '', medicine_category: '', horizon: '3' })
  const [submitted, setSubmitted] = useState(filters)
  const [analysis, setAnalysis] = useState(null)
  const [type, setType] = useState('disease')
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState({ diseases: [], barangays: [], categories: [] })
  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const result = await fetchForecastAnalysis(submitted)
        if (!active) return
        setAnalysis(result); setError(''); setSelected('')
        setOptions((current) => ({ diseases: [...new Map([...current.diseases, ...result.diseases].map((item) => [item.disease_id, item])).values()], barangays: [...new Set([...current.barangays, ...result.diseases.map((item) => item.barangay)])].sort(), categories: [...new Set([...current.categories, ...result.medicines.map((item) => item.category).filter(Boolean)])].sort() }))
      } catch (failure) { if (active) setError(failure.response?.data?.detail || 'Unable to load forecasts. Check the selected dates and data sources.') }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [submitted])
  const choices = type === 'disease' ? analysis?.diseases || [] : analysis?.medicines || []
  const choice = choices[Number(selected) || 0]
  const series = type === 'disease' ? choice : type === 'requests' ? choice?.request_forecast : choice?.consumption_forecast
  const update = (field, value) => setFilters((current) => ({ ...current, [field]: value }))
  const filterForm = <form className="panel-filter-form" onSubmit={(event) => { event.preventDefault(); setSubmitted({ ...filters }) }}>
      <label>Start date<input type="date" value={filters.start_date} onChange={(event) => update('start_date', event.target.value)} /></label>
      <label>End date / cutoff<input type="date" value={filters.end_date} onChange={(event) => update('end_date', event.target.value)} /></label>
      {role === 'cho' && <label>Barangay<select value={filters.barangay} onChange={(event) => update('barangay', event.target.value)}><option value="">All barangays</option>{options.barangays.map((item) => <option key={item}>{item}</option>)}</select></label>}
      <label>Disease<select value={filters.disease_id} onChange={(event) => update('disease_id', event.target.value)}><option value="">All diseases</option>{options.diseases.map((item) => <option key={item.disease_id} value={item.disease_id}>{item.disease}</option>)}</select></label>
      <label>Medicine category<select value={filters.medicine_category} onChange={(event) => update('medicine_category', event.target.value)}><option value="">All categories</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Forecast period<select value={filters.horizon} onChange={(event) => update('horizon', event.target.value)}>{[1, 2, 3, 6].map((item) => <option key={item} value={item}>{item} month(s)</option>)}</select></label><button type="submit" disabled={loading}>Apply Filters</button>
    </form>
  return <section className="cho-panel forecast-panel" aria-label="Predictive analytics">
    <div className="cho-panel-heading"><div><span>Recorded-data decision support</span><h2>Predictive Analytics</h2><p>Disease trends and medicine consumption, with data coverage and backtest results.</p></div><TrendingUp size={24} /></div>
    {role === 'bhc' ? <BHCFilterToolbar active={submitted.start_date || submitted.end_date || submitted.disease_id || submitted.medicine_category || submitted.horizon !== '3'}>{filterForm}</BHCFilterToolbar> : filterForm}
    {loading && <p role="status"><Loader2 size={16} /> Computing forecasts…</p>}
    {error && <p className="patient-alert" role="alert"><AlertTriangle size={16} />{error}</p>}
    {!loading && !error && analysis && <>
      <p className="panel-notice">{analysis.provenance}</p>
      {analysis.gis_status !== 'available' && <p className="patient-alert">GIS source unavailable. Medicine records can still be analyzed.</p>}
      <div className="panel-summary"><span><strong>{analysis.summary.disease_forecasts_ready}</strong> disease series ready</span><span><strong>{analysis.summary.medicine_forecasts_ready}</strong> medicine series ready</span><span>Coverage: {analysis.filters.start} to {analysis.filters.end}</span></div>
      <div className="panel-filter-form"><label>Analysis<select value={type} onChange={(event) => { setType(event.target.value); setSelected('') }}><option value="disease">Disease cases</option><option value="medicine">Medicine consumption</option><option value="requests">Medicine supply requests</option></select></label><label>Series<select value={selected} onChange={(event) => setSelected(event.target.value)}>{choices.map((item, index) => <option key={index} value={index}>{type === 'disease' ? `${item.disease} — ${item.barangay}` : `${item.medicine} ${item.dosage || ''} — ${item.facility}`}</option>)}</select></label></div>
      {type === 'requests' && <p className="panel-notice">Supply request projections describe non-declined requested quantities, not patient consumption. They are not added to consumption forecasts.</p>}
      {series ? <>
        <p className={series.status === 'ready' ? 'panel-notice' : 'patient-alert'}><strong>{series.status.replaceAll('_', ' ')}:</strong> {series.reason}</p>
        <p>Method: {series.method}. Observed complete months: {series.observed_months}. Last observation: {series.last_observed_month || 'None'}. Forecast origin: {month(series.forecast_origin)}. Minimum: {series.minimum_months} consecutive complete months.</p>
        <ForecastChart series={series} />
        {type === 'disease' && onOpenMap && <button className="request-view-button" type="button" onClick={() => onOpenMap({ barangay: choice.barangay, diseaseId: String(choice.disease_id) })}>View recorded cases on GIS map</button>}
        {type === 'disease' && onOpenMap && <p className="panel-notice">The map shows recorded spatial case distribution, not predicted cases. Forecast date filters apply to this analysis.</p>}
        <div className="panel-summary"><span>Backtest MAE: <strong>{number(series.evaluation.mae)}</strong></span><span>RMSE: <strong>{number(series.evaluation.rmse)}</strong></span><span>{series.evaluation.test_months} evaluation month(s)</span></div>
        <p>{series.evaluation.method}. Errors are in {type === 'disease' ? 'case-count' : 'inventory'} units.</p>
        {type === 'medicine' && <p>Current usable stock: {number(choice.usable_stock)}. Expired stock: {number(choice.expired_stock)}. Forecast demand: {number(choice.forecast_total_units)}. Stock gap: {number(choice.stock_gap_units)}. {choice.allocation_note}</p>}
        <div className="cho-medicine-request-table-wrap"><table className="cho-medicine-request-table"><thead><tr><th>Month</th><th>Recorded Actual</th><th>Forecast</th></tr></thead><tbody>{[...series.history.slice(-12), ...series.forecasts].map((item) => <tr key={item.month}><td>{month(item.month)}</td><td>{item.actual === undefined ? 'Future period' : item.actual === null ? 'Missing' : number(item.actual)}</td><td>{item.predicted === undefined ? '—' : number(item.predicted)}</td></tr>)}</tbody></table></div>
      </> : <p>No eligible records for the selected filters. Collect complete monthly records before forecasting.</p>}
      <h3>Resource allocation support</h3><div className="cho-medicine-request-table-wrap"><table className="cho-medicine-request-table"><thead><tr><th>Facility</th><th>Medicine</th><th>Forecast Consumption</th><th>Usable Stock</th><th>Additional Units to Review</th></tr></thead><tbody>{analysis.medicines.filter((item) => item.stock_gap_units !== null).sort((a, b) => b.stock_gap_units - a.stock_gap_units).slice(0, 20).map((item) => <tr key={`${item.facility_id}-${item.medicine_id}`}><td>{item.facility}</td><td>{item.medicine}</td><td>{number(item.forecast_total_units)}</td><td>{number(item.usable_stock)}</td><td>{number(item.stock_gap_units)}</td></tr>)}</tbody></table></div>{!analysis.medicines.some((item) => item.stock_gap_units !== null) && <p>No allocation quantities are available for this cutoff and coverage.</p>}
      <ul className="panel-limitations">{analysis.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
    </>}
  </section>
}
export default ForecastPanel
