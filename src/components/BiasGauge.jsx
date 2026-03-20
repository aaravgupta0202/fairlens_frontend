import styles from './BiasGauge.module.css'

/**
 * Circular bias score gauge.
 * score: 0-100
 * level: "Low" | "Moderate" | "High"
 */
export default function BiasGauge({ score, level }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const gap = circumference - filled

  const color =
    level === 'Low' ? '#34d399' :
    level === 'Moderate' ? '#fbbf24' : '#f87171'

  return (
    <div className={styles.wrapper}>
      <svg viewBox="0 0 120 120" className={styles.svg}>
        {/* Track */}
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
        />
        {/* Fill */}
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.4s ease' }}
        />
        {/* Score text */}
        <text x="60" y="55" textAnchor="middle" className={styles.scoreText} fill={color}>
          {Math.round(score)}
        </text>
        <text x="60" y="72" textAnchor="middle" className={styles.labelText} fill="var(--text-muted)">
          / 100
        </text>
      </svg>
      <div className={styles.levelBadge} style={{ background: `${color}22`, color }}>
        {level} Bias
      </div>
    </div>
  )
}
