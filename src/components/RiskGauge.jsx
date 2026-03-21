import styles from './RiskGauge.module.css'

/**
 * Semicircular risk gauge — 0=low risk (green), 100=high risk (red).
 */
export default function RiskGauge({ score, label }) {
  const radius = 70
  const cx = 100, cy = 100
  // Semicircle: from 180° to 0° (left to right)
  const circumference = Math.PI * radius  // half circle arc length
  const filled = (score / 100) * circumference
  const gap = circumference - filled

  const color = label === 'Low' ? '#34d399' : label === 'Medium' ? '#fbbf24' : '#f87171'
  const bgColor = label === 'Low' ? 'rgba(52,211,153,0.1)' : label === 'Medium' ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)'

  // Arc path for semicircle
  const toRad = deg => (deg * Math.PI) / 180
  const arcX = (angle) => cx + radius * Math.cos(toRad(angle))
  const arcY = (angle) => cy + radius * Math.sin(toRad(angle))

  return (
    <div className={styles.wrapper}>
      <svg viewBox="0 0 200 120" className={styles.svg}>
        {/* Background track semicircle */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke="var(--border)" strokeWidth="14" strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.9s ease' }}
        />
        {/* Score text */}
        <text x={cx} y={cy - 10} textAnchor="middle" className={styles.score} fill={color}>
          {Math.round(score)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" className={styles.outOf} fill="var(--text-muted)">
          / 100
        </text>
        {/* Zone labels */}
        <text x="22" y="116" className={styles.zoneLabel} fill="#34d399">Low</text>
        <text x="90" y="40" className={styles.zoneLabel} fill="#fbbf24">Med</text>
        <text x="162" y="116" className={styles.zoneLabel} fill="#f87171">High</text>
      </svg>
      <div className={styles.badge} style={{ background: bgColor, color }}>
        {label} Risk
      </div>
    </div>
  )
}
