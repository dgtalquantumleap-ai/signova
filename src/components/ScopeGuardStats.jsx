import { Warning, CheckCircle, ShieldCheck, ChatCircle, FileText } from '@phosphor-icons/react'

const INLINE = { size: 14, weight: 'regular', style: { verticalAlign: '-2px', marginRight: 4 } }

export default function ScopeGuardStats({ stats }) {
  if (!stats) return null

  const current = stats.current_month || {}
  const analyzeCalls = current.analyze_calls || 0
  const changeOrders = current.change_orders_generated || 0
  const violations = current.violations_detected || 0
  const breakdown = current.response_breakdown || {}

  return (
    <div className="scope-guard-stats-grid">
      <div className="stat-card">
        <div className="stat-label">Analyses Run</div>
        <div className="stat-value">{analyzeCalls}</div>
        <div className="stat-description">Contracts analyzed this month</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Violations Found</div>
        <div className="stat-value">{violations}</div>
        <div className="stat-description">
          {violations > 0
            ? <><Warning {...INLINE} weight="fill" />Scope creep detected</>
            : <><CheckCircle {...INLINE} weight="fill" />Clean contracts</>}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Change Orders</div>
        <div className="stat-value">{changeOrders}</div>
        <div className="stat-description">Generated for clients</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Response Strategy</div>
        <ul className="stat-breakdown">
          {breakdown.firm_responses > 0 && <li><ShieldCheck {...INLINE} weight="duotone" />Firm responses: {breakdown.firm_responses}</li>}
          {breakdown.pushback_responses > 0 && <li><ChatCircle {...INLINE} weight="duotone" />Pushback drafts: {breakdown.pushback_responses}</li>}
          {breakdown.change_order_responses > 0 && <li><FileText {...INLINE} weight="duotone" />Change orders: {breakdown.change_order_responses}</li>}
          {Object.values(breakdown).every(v => v === 0) && <li className="stat-empty">No responses tracked yet</li>}
        </ul>
      </div>
    </div>
  )
}
