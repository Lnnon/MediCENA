import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Database, Loader2, MapPin, PackageCheck, ShieldAlert, TrendingUp } from 'lucide-react'
import { fetchOutbreakAnalytics } from '../../../services/gis'
import ForecastPanel from './ForecastPanel'

const formatNumber = (value) => value === null || value === undefined ? 'Unavailable' : Number(value).toLocaleString()

const monthLabel = (value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })

const getChartPlot = (values, history = [], width = 620, height = 220, padding = 28) => {
  const maxValue = Math.max(...values, 1)
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0

  const points = values.map((value, index) => {
      const x = padding + index * step
      const y = height - padding - 22 - (value / maxValue) * (height - padding * 2 - 26)
      return {
        ...history[index],
        cases: value,
        x,
        y,
      }
    })

  return {
    line: points.map((point) => `${point.x},${point.y}`).join(' '),
    points,
  }
}

function TrendChart({ history = [] }) {
  const values = history.map((item) => item.cases)
  const plot = getChartPlot(values, history)

  return (
    <svg className="analytics-main-chart" viewBox="0 0 620 220" role="img" aria-label="Monthly outbreak trend">
      {[0, 1, 2, 3, 4].map((line) => (
        <line key={line} x1="24" x2="596" y1={30 + line * 34} y2={30 + line * 34} />
      ))}
      <polyline className="current" points={plot.line} />
      {plot.points.map((point) => (
        <g key={point.month}>
          <circle cx={point.x} cy={point.y} r="4.5" />
          <text className="chart-value" x={point.x} y={Math.max(16, point.y - 11)}>
            {formatNumber(point.cases)}
          </text>
          <text className="chart-month" x={point.x} y="210">
            {monthLabel(point.month)}
          </text>
        </g>
      ))}
      {!history.length ? (
        <text className="chart-empty" x="310" y="112">
          No monthly disease data yet
        </text>
      ) : null}
    </svg>
  )
}

function SparkBars({ values = [] }) {
  const maxValue = Math.max(...values, 1)
  return (
    <div className="analytics-spark-bars" aria-hidden="true">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} style={{ height: `${Math.max(0, (value / maxValue) * 100)}%` }} />
      ))}
    </div>
  )
}

function InsightTable({ columns = [], rows = [], emptyMessage = 'No data available.' }) {
  if (!rows.length) {
    return <p className="analytics-insight-empty">{emptyMessage}</p>
  }

  return (
    <div className="analytics-insight-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.label || row.disease || row.month || row.barangay || row.purok_name}-${index}`}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const getAnalyticsModel = (analytics) => {
  const diseases = analytics?.diseases || []
  const summary = analytics?.summary || {}
  const scope = analytics?.scope || {}
  const monthlyHistory = analytics?.monthly_history || []
  const scopedLabel = scope.is_barangay_scoped && scope.barangay ? scope.barangay : 'Lucena City'
  const topDiseases = [
    ...diseases.filter((disease) => disease.is_common_ph_outbreak),
    ...diseases.filter((disease) => !disease.is_common_ph_outbreak),
  ].slice(0, 6)
  const primaryDisease = topDiseases[0] || {}
  const medicineDemandMap = new Map()

  topDiseases.forEach((disease) => {
    disease.medicine_demand_forecast?.forEach((item) => {
      const current = medicineDemandMap.get(item.medicine) || { ...item, recommended_quantity: 0, diseases: [] }
      current.recommended_quantity += Number(item.recommended_quantity || 0)
      current.diseases = [...new Set([...current.diseases, disease.disease])]
      medicineDemandMap.set(item.medicine, current)
    })
  })

  const medicineDemand = [...medicineDemandMap.values()]
    .sort((first, second) => second.recommended_quantity - first.recommended_quantity)
    .slice(0, 10)

  return { diseases, summary, scope, monthlyHistory, scopedLabel, topDiseases, primaryDisease, medicineDemand }
}

const getDetailInsight = (detailType, model) => {
  const { medicineDemand, monthlyHistory, primaryDisease, scopedLabel, topDiseases } = model
  const diseaseColumns = [
    { key: 'disease', label: 'Disease' },
    { key: 'category', label: 'Category' },
    { key: 'risk_level', label: 'Risk' },
    { key: 'gis_cases', label: 'GIS Cases', render: (row) => formatNumber(row.gis_cases) },
    { key: 'affected_puroks', label: 'Puroks', render: (row) => formatNumber(row.affected_puroks) },
    { key: 'projected_30_day_cases', label: 'Projected', render: (row) => formatNumber(row.projected_30_day_cases) },
  ]
  const purokColumns = [
    { key: 'disease', label: 'Disease' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'purok_name', label: 'Purok' },
    { key: 'cases', label: 'Cases', render: (row) => formatNumber(row.cases) },
  ]
  const barangayColumns = [
    { key: 'disease', label: 'Disease' },
    { key: 'barangay', label: 'Barangay' },
    { key: 'cases', label: 'Cases', render: (row) => formatNumber(row.cases) },
  ]

  if (detailType === 'trend') {
    return {
      title: '12-Month Disease Trend',
      subtitle: `${scopedLabel} monthly GIS case history`,
      columns: [
        { key: 'month', label: 'Month', render: (row) => new Date(row.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
        { key: 'cases', label: 'Cases', render: (row) => formatNumber(row.cases) },
      ],
      rows: monthlyHistory,
    }
  }

  if (detailType === 'signal') {
    return {
      title: `${primaryDisease.disease || 'Outbreak Signal'} by Purok`,
      subtitle: 'Highest affected puroks from GIS disease cases',
      columns: purokColumns,
      rows: (primaryDisease.purok_breakdown || []).map((row) => ({ ...row, disease: primaryDisease.disease })),
    }
  }

  if (detailType === 'mix') {
    return {
      title: 'Disease Mix Analysis',
      subtitle: 'Common outbreak diseases ranked by GIS cases, risk, and projections',
      columns: diseaseColumns,
      rows: topDiseases,
    }
  }

  if (detailType === 'medicine') {
    return {
      title: 'Medicine Demand Forecast',
      subtitle: 'Use the recorded-consumption forecast panel for evaluated medicine predictions.',
      columns: [
        { key: 'medicine', label: 'Medicine' },
        { key: 'recommended_quantity', label: 'Quantity', render: (row) => `${formatNumber(row.recommended_quantity)} ${row.unit}` },
        { key: 'basis', label: 'Basis' },
        { key: 'diseases', label: 'Disease Link', render: (row) => row.diseases?.join(', ') || 'Outbreak demand' },
      ],
      rows: medicineDemand,
    }
  }

  if (detailType === 'projected-demand') {
    return {
      title: 'Projected Cases by Disease',
      subtitle: 'Next complete calendar-month forecast; unavailable when history is stale or insufficient.',
      columns: diseaseColumns,
      rows: topDiseases,
    }
  }

  if (detailType === 'high-risk') {
    return {
      title: 'High Risk Disease Puroks',
      subtitle: 'Purok rows for diseases currently marked high risk',
      columns: purokColumns,
      rows: topDiseases.filter((disease) => disease.risk_level === 'high').flatMap((disease) => (
        (disease.purok_breakdown || []).map((row) => ({ ...row, disease: disease.disease }))
      )),
    }
  }

  if (detailType === 'active-clusters') {
    return {
      title: 'Active Cluster Barangays',
      subtitle: 'Barangay case totals from GIS cluster contributors',
      columns: barangayColumns,
      rows: topDiseases.flatMap((disease) => (
        (disease.barangay_breakdown || []).map((row) => ({ ...row, disease: disease.disease }))
      )),
    }
  }

  return {
    title: 'GIS Cases by Barangay',
    subtitle: 'Barangay totals from outbreak GIS records',
    columns: barangayColumns,
    rows: topDiseases.flatMap((disease) => (
      (disease.barangay_breakdown || []).map((row) => ({ ...row, disease: disease.disease }))
    )),
  }
}

function OutbreakAnalyticsPage({ role = 'cho', onOpenDetail, onOpenMap, onOpenSection }) {
  const [analytics, setAnalytics] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadAnalytics = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await fetchOutbreakAnalytics()
        if (isMounted) setAnalytics(response)
      } catch {
        if (isMounted) setErrorMessage('Unable to load outbreak analytics from the backend.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadAnalytics()

    return () => {
      isMounted = false
    }
  }, [])

  const model = useMemo(() => getAnalyticsModel(analytics), [analytics])
  const { medicineDemand, monthlyHistory, primaryDisease, scope, scopedLabel, summary, topDiseases } = model

  const openDetail = (detailType) => {
    onOpenDetail?.(detailType)
  }

  const metricCards = [
    {
      id: 'gis-cases',
      label: 'GIS Cases',
      value: summary.total_gis_cases,
      accent: 'violet',
      icon: Database,
      spark: monthlyHistory.slice(-10).map((item) => item.cases),
    },
    {
      id: 'projected-demand',
      label: 'Next-Month Cases',
      value: summary.projected_30_day_cases,
      accent: 'pink',
      icon: TrendingUp,
      spark: topDiseases.map((disease) => disease.projected_30_day_cases || 0),
    },
    {
      id: 'high-risk',
      label: 'High Risk',
      value: summary.high_risk_diseases,
      accent: 'green',
      icon: ShieldAlert,
      spark: topDiseases.map((disease) => disease.cluster_count || 0),
    },
    {
      id: 'active-clusters',
      label: 'Active Clusters',
      value: summary.total_clusters,
      accent: 'orange',
      icon: MapPin,
      spark: topDiseases.map((disease) => disease.gis_cases || 0),
    },
  ]

  return (
    <>
      <div className="cho-page-heading">
        <div>
          <span>{role === 'bhc' ? 'Barangay Health Center' : 'City Health Office'}</span>
          <h1>Outbreak Analytics</h1>
        </div>
        <div className="cho-date-card">
          {isLoading ? <Loader2 className="cho-map-spin" size={18} /> : <ShieldAlert size={18} />}
          <span>{scopedLabel}</span>
        </div>
      </div>

      {role !== 'cho' && <ForecastPanel role={role} onOpenMap={onOpenMap} />}
      {errorMessage ? (
        <article className="cho-referral-empty">
          <AlertTriangle size={28} />
          <h2>Analytics unavailable</h2>
          <p>{errorMessage}</p>
        </article>
      ) : (
        <section className="analytics-dashboard">
          <div className="analytics-overview-grid">
            <div className="analytics-metric-grid">
              {metricCards.map((card) => {
                const Icon = card.icon
                return (
                  <button
                    type="button"
                    className={`analytics-metric-card analytics-clickable ${card.accent}`}
                    key={card.label}
                    onClick={() => openDetail(card.id)}
                  >
                    <header>
                      <span>{card.label}</span>
                      <Icon size={18} />
                    </header>
                    <strong>{formatNumber(card.value)}</strong>
                    <SparkBars values={card.spark} />
                  </button>
                )
              })}
            </div>

            <button type="button" className="analytics-wide-card analytics-clickable" onClick={() => openDetail('trend')}>
              <header>
                <div>
                  <span>Outbreak Survey</span>
                  <h2>12-Month Disease Trend</h2>
                </div>
                <small>{scope.gis_status === 'unavailable' ? 'GIS offline' : 'GIS connected'}</small>
              </header>
              <TrendChart history={monthlyHistory} />
            </button>
          </div>

          <div className="analytics-detail-grid">
            <button type="button" className="analytics-detail-card analytics-clickable" onClick={() => openDetail('signal')}>
              <header>
                <span>Outbreak Signal</span>
                <small>{primaryDisease.trend_direction || 'stable'}</small>
              </header>
              <h2>{primaryDisease.disease || 'No disease signal'}</h2>
              <div className="analytics-card-metrics">
                <div>
                  <span>Overall Cases</span>
                  <strong>{formatNumber(primaryDisease.gis_cases)}</strong>
                </div>
                <div>
                  <span>Monthly</span>
                  <strong>{formatNumber(primaryDisease.recent_gis_cases)}</strong>
                </div>
                <div>
                  <span>Projected</span>
                  <strong>{formatNumber(primaryDisease.projected_30_day_cases)}</strong>
                </div>
              </div>
              <TrendChart history={monthlyHistory.slice(-7)} />
            </button>

            <button type="button" className="analytics-detail-card analytics-clickable" onClick={() => openDetail('mix')}>
              <header>
                <span>Disease Mix</span>
                <small>{formatNumber(summary.watchlist_diseases)} watchlist</small>
              </header>
              <h2>Top Outbreaks</h2>
              <div className="analytics-stacked-bars">
                {topDiseases.slice(0, 6).map((disease) => (
                  <div key={disease.disease}>
                    <span>{disease.disease}</span>
                    <strong>{formatNumber(disease.gis_cases)}</strong>
                    <i style={{ width: `${Math.min(100, (Number(disease.gis_cases || 0) / Math.max(Number(primaryDisease.gis_cases || 1), 1)) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </button>

            <button type="button" className="analytics-detail-card analytics-clickable" onClick={() => openDetail('medicine')}>
              <header>
                <span>Medical Treatment</span>
                <small>Forecasted supply</small>
              </header>
              <h2>Medicine Demand</h2>
              <div className="analytics-medicine-demand">
                {medicineDemand.map((item) => (
                  <div key={item.medicine}>
                    <PackageCheck size={16} />
                    <span>{item.medicine}</span>
                    <strong>{formatNumber(item.recommended_quantity)} {item.unit}</strong>
                  </div>
                ))}
              </div>
            </button>
          </div>

        </section>
      )}
      {role === 'cho' && (
        <section className="analytics-page-links" aria-label="Analytics pages">
          {[
            ['predictiveAnalytics', 'Predictive Analytics', 'Explore disease forecasts and medicine demand.'],
          ].map(([page, title, description]) => (
            <button key={page} type="button" className="cho-panel analytics-page-link" onClick={() => onOpenSection?.(page)}><h2>{title}</h2><p>{description}</p><span>View page →</span></button>
          ))}
        </section>
      )}

    </>
  )
}

export function OutbreakAnalyticsDetailPage({ detailType = 'gis-cases', role = 'cho', onBack }) {
  const [analytics, setAnalytics] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadAnalytics = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await fetchOutbreakAnalytics()
        if (isMounted) setAnalytics(response)
      } catch {
        if (isMounted) setErrorMessage('Unable to load outbreak analytics from the backend.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadAnalytics()

    return () => {
      isMounted = false
    }
  }, [])

  const model = useMemo(() => getAnalyticsModel(analytics), [analytics])
  const insight = useMemo(() => getDetailInsight(detailType, model), [detailType, model])
  const { monthlyHistory, scopedLabel, summary, topDiseases } = model
  const detailCards = [
    { label: 'GIS Cases', value: summary.total_gis_cases },
    { label: 'Next-Month Forecast', value: summary.projected_30_day_cases },
    { label: 'Active Clusters', value: summary.total_clusters },
    { label: 'Watchlist Diseases', value: summary.watchlist_diseases },
  ]

  return (
    <>
      <div className="cho-page-heading">
        <div>
          <span>{role === 'bhc' ? 'Barangay Health Center' : 'City Health Office'}</span>
          <h1>{insight.title}</h1>
          <p>{insight.subtitle}</p>
        </div>
        <button type="button" className="analytics-back-button" onClick={onBack}>
          <ArrowLeft size={18} />
          Back to Analytics
        </button>
      </div>

      {errorMessage ? (
        <article className="cho-referral-empty">
          <AlertTriangle size={28} />
          <h2>Analytics unavailable</h2>
          <p>{errorMessage}</p>
        </article>
      ) : (
        <section className="analytics-detail-page">
          <div className="analytics-detail-stats">
            {detailCards.map((card) => (
              <article key={card.label}>
                <span>{card.label}</span>
                <strong>{isLoading ? '...' : formatNumber(card.value)}</strong>
              </article>
            ))}
          </div>

          <article className="analytics-detail-hero">
            <header>
              <div>
                <span>{scopedLabel}</span>
                <h2>{insight.title}</h2>
              </div>
              {isLoading ? <Loader2 className="cho-map-spin" size={18} /> : <ShieldAlert size={18} />}
            </header>
            <TrendChart history={monthlyHistory} />
          </article>

          <article className="analytics-insight-panel">
            <header>
              <div>
                <span>Detailed Data</span>
                <h2>{insight.title}</h2>
                <p>{insight.subtitle}</p>
              </div>
            </header>
            <InsightTable columns={insight.columns} rows={insight.rows} />
          </article>

          <div className="analytics-disease-detail-grid">
            {topDiseases.map((disease) => (
              <article className="analytics-disease-detail-card" key={disease.disease}>
                <header>
                  <div>
                    <span>{disease.category}</span>
                    <h2>{disease.disease}</h2>
                  </div>
                  <small>{disease.risk_level}</small>
                </header>
                <div className="analytics-card-metrics">
                  <div>
                    <span>GIS Cases</span>
                    <strong>{formatNumber(disease.gis_cases)}</strong>
                  </div>
                  <div>
                    <span>Projected</span>
                    <strong>{formatNumber(disease.projected_30_day_cases)}</strong>
                  </div>
                  <div>
                    <span>Puroks</span>
                    <strong>{formatNumber(disease.affected_puroks)}</strong>
                  </div>
                </div>
                <div className="analytics-mini-lists">
                  <div>
                    <strong>Top Barangays</strong>
                    {(disease.barangay_breakdown || []).slice(0, 3).map((row) => (
                      <span key={`${disease.disease}-${row.barangay}`}>{row.barangay}: {formatNumber(row.cases)}</span>
                    ))}
                  </div>
                  <div>
                    <strong>Medicine Demand</strong>
                    {(disease.medicine_demand_forecast || []).slice(0, 3).map((item) => (
                      <span key={`${disease.disease}-${item.medicine}`}>{item.medicine}: {formatNumber(item.recommended_quantity)} {item.unit}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

export default OutbreakAnalyticsPage
