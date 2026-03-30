export default function UsageChart({ history }) {
  if (!history || history.length === 0) return null

  // history format: [{ month: "2026-03", documents_generated: 12 }, ...]
  const data = [...history].reverse() // oldest first

  const maxDocs = Math.max(...data.map(d => d.documents_generated), 10)
  const chartHeight = 200
  const barWidth = 70
  const barGap = 10
  const padding = 30

  const svgInnerWidth = data.length * (barWidth + barGap) + padding * 2
  const svgHeight = chartHeight + padding * 2

  return (
    <div className="usage-chart-container">
      <h3>Usage trend (last 3 months)</h3>
      <svg viewBox={`0 0 ${svgInnerWidth} ${svgHeight}`} className="usage-chart-svg">
        {/* Y-axis */}
        <line x1={padding} y1={padding} x2={padding} y2={chartHeight + padding} stroke="#d1d5db" strokeWidth="1" />

        {/* X-axis */}
        <line x1={padding} y1={chartHeight + padding} x2={svgInnerWidth - padding} y2={chartHeight + padding} stroke="#d1d5db" strokeWidth="1" />

        {/* Grid lines and labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = chartHeight + padding - chartHeight * ratio
          const value = Math.round(maxDocs * ratio)
          return (
            <g key={`grid-${i}`}>
              {/* Grid line */}
              <line x1={padding} y1={y} x2={svgInnerWidth - padding} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              {/* Y-axis label */}
              <text x={padding - 8} y={y + 4} textAnchor="end" className="chart-label">
                {value}
              </text>
            </g>
          )
        })}

        {/* Bars and month labels */}
        {data.map((item, idx) => {
          const barHeight = (item.documents_generated / maxDocs) * chartHeight
          const x = padding + idx * (barWidth + barGap) + barGap / 2
          const y = chartHeight + padding - barHeight

          const [year, month] = item.month.split('-')
          const monthName = new Date(year, parseInt(month) - 1).toLocaleString('en-US', { month: 'short' })

          return (
            <g key={`bar-${idx}`}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="#3b82f6"
                rx="4"
                className="chart-bar"
              />
              {/* Value on top of bar */}
              {barHeight > 20 && (
                <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" className="chart-value">
                  {item.documents_generated}
                </text>
              )}
              {/* Month label */}
              <text x={x + barWidth / 2} y={chartHeight + padding + 18} textAnchor="middle" className="chart-label">
                {monthName}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
