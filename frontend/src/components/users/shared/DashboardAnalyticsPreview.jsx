const formatNumber = (value) => Number(value || 0).toLocaleString()

const getMonthLabel = (value) => {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(value))
}

const getTrendPlot = (history = [], width = 720, height = 260, padding = 42) => {
  const values = history.map((item) => Number(item.cases || 0))
  const maxValue = Math.max(...values, 1)
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0

  const points = values.map((value, index) => {
      const x = padding + index * step
      const y = height - padding - 24 - (value / maxValue) * (height - padding * 2 - 24)
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

export default function DashboardAnalyticsPreview({ history = [], onOpen, linkClassName }) {
  const trend = getTrendPlot(history)

  return (
    <button className={`${linkClassName} dashboard-analytics-preview`} type="button" onClick={onOpen}>
      <svg viewBox="0 0 720 260" role="img" aria-label="12-month disease trend">
        {[0, 1, 2, 3, 4].map((line) => (
          <line key={line} x1="34" x2="686" y1={42 + line * 42} y2={42 + line * 42} />
        ))}
        {trend.line ? <polyline points={trend.line} /> : null}
        {trend.points.map((point) => (
          <g key={point.month}>
            <circle cx={point.x} cy={point.y} r="5" />
            <text className="value-label" x={point.x} y={Math.max(18, point.y - 12)}>{formatNumber(point.cases)}</text>
            <text className="month-label" x={point.x} y="244">{getMonthLabel(point.month)}</text>
          </g>
        ))}
      </svg>
      {!history.length ? <span>No disease trend data yet</span> : null}
    </button>
  )
}

