import { useEffect, useState } from 'react'
import styles from './BiasGauge.module.css'

export default function BiasGauge({ score, level, confidence }) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const radius = 54
  const circumference = 2 * Math.PI * radius

  // Animate score fill on mount
  useEffect(() => {
    const start = performance.now()
    const duration = 900

    function step(now) {
      const progress = Math.min((now - start) / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedScore(score * eased)
      if (progress < 1) requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }, [score])

  const filled = (animatedScore / 100) * circumference
  const gap = circumference - filled

  const color =
    level === 'Low' ? '#34d399' :
    level === 'Moderate' ? '#fbbf24' : '#f87171'

  return (
    <div className={styles.wrapper}>
      <div className={styles.gaugeContainer}>
        <svg viewBox="0 0 120 120" className={styles.svg}>
          {/* Outer glow ring */}
          <circle cx="60" cy="60" r={radius + 6} fill="none" stroke={color} strokeWidth="1" opacity="0.15" />
          {/* Track */}
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
          {/* Fill */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${gap}`}
            transform="rotate(-90 60 60)"
          />
          {/* Score */}
          <text x="60" y="53" textAnchor="middle" className={styles.scoreText} fill={color}>
            {Math.round(animatedScore)}
          </text>
          <text x="60" y="66" textAnchor="middle" className={styles.labelText} fill="var(--text-muted)">
            / 100
          </text>
          {/* Confidence */}
          {confidence !== undefined && (
            <text x="60" y="77" textAnchor="middle" className={styles.confText} fill="var(--text-muted)">
              {Math.round(confidence)}% confident
            </text>
          )}
        </svg>
      </div>
      <div className={styles.levelBadge} style={{ background: `${color}22`, color, borderColor: `${color}44` }}>
        {level} Bias
      </div>
    </div>
  )
}
