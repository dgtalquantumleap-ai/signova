export default function RevenueMetrics({ metrics, monthlyData }) {
  if (!metrics) return null

  const mrrNow = parseFloat(metrics.mrrUsd || 0)
  const totalRev = parseFloat(metrics.totalRevenueUsd || 0)
  const acv = parseFloat(metrics.averageContractValueUsd || 0)
  const churn = parseFloat(metrics.churnRatePercent || 0)

  return (
    <div className="revenue-dashboard">
      <div className="revenue-grid">
        <div className="metric-card metric-primary">
          <div className="metric-label">Monthly Recurring Revenue</div>
          <div className="metric-value">${mrrNow.toFixed(2)}</div>
          <div className="metric-description">{metrics.activeSubscriptions} active subscriptions</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Average Contract Value</div>
          <div className="metric-value">${acv.toFixed(2)}</div>
          <div className="metric-description">Per subscription</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Churn Rate</div>
          <div className="metric-value">{churn.toFixed(1)}%</div>
          <div className="metric-description">{metrics.churnedSubscriptions} canceled subs</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Revenue</div>
          <div className="metric-value">${totalRev.toFixed(2)}</div>
          <div className="metric-description">All-time invoiced</div>
        </div>
      </div>

      <div className="subs-by-tier">
        <h3>Subscriptions by Tier</h3>
        <div className="tier-breakdown">
          <div className="tier-item">
            <span className="tier-name">Starter ($29/mo)</span>
            <span className="tier-count">{metrics.subscriptionsByTier?.starter || 0}</span>
          </div>
          <div className="tier-item">
            <span className="tier-name">Growth ($79/mo)</span>
            <span className="tier-count">{metrics.subscriptionsByTier?.growth || 0}</span>
          </div>
          <div className="tier-item">
            <span className="tier-name">Scale ($199/mo)</span>
            <span className="tier-count">{metrics.subscriptionsByTier?.scale || 0}</span>
          </div>
        </div>
      </div>

      {monthlyData && monthlyData.length > 0 && (
        <div className="monthly-chart">
          <h3>Revenue Trend (Last 12 Months)</h3>
          <div className="chart-container">
            {monthlyData.slice(-12).map((month) => {
              const maxRev = Math.max(...monthlyData.map(m => parseFloat(m.revenueUsd)))
              const pct = (parseFloat(month.revenueUsd) / (maxRev || 1)) * 100
              return (
                <div key={month.month} className="chart-bar-item">
                  <div className="chart-bar" style={{ height: `${pct}%` }} title={`$${month.revenueUsd}`} />
                  <div className="chart-label">{month.month.slice(5)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
