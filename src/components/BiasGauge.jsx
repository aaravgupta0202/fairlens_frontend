import { useEffect, useState } from 'react'
import styles from './BiasGauge.module.css'

/**
 * BiasGauge
 * Default (text bias): 100 = fully biased = RED, 0 = no bias = GREEN
 * fairnessMode (dataset audit): 100 = fully fair = GREEN, 0 = no fairness = RED
 */
export default function BiasGauge({ score, level, confidence, fairnessMode = false }) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const radius = 54
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    const start = performance.now()
    const duration = 900
    function step(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedScore(score * eased)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [score])

  const filled = (animatedScore / 100) * circumference
  const gap = circumference - filled

  let color
  if (fairnessMode) {
    // Dataset audit: higher = fairer = green
    color = score >= 85 ? '#34d399' : score >= 65 ? '#fbbf24' : '#f87171'
  } else {
    // Text bias: higher score = more biased = red
    color = score >= 65 ? '#f87171' : score >= 30 ? '#fbbf24' : '#34d399'
  }

  const badgeLabel = fairnessMode
    ? (score >= 85 ? 'Low Bias' : score >= 65 ? 'Moderate Bias' : 'High Bias')
    : level ? `${level} Bias` : (score >= 65 ? 'High Bias' : score >= 30 ? 'Moderate Bias' : 'Low Bias')

  return (
    <div className={styles.wrapper}>
      <div className={styles.gaugeContainer}>
        <svg viewBox="0 0 120 120" className={styles.svg}>
          <circle cx="60" cy="60" r={radius + 6} fill="none" stroke={color} strokeWidth="1" opacity="0.15" />
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${filled} ${gap}`}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="53" textAnchor="middle" className={styles.scoreText} fill={color}>
            {Math.round(animatedScore)}
          </text>
          <text x="60" y="66" textAnchor="middle" className={styles.labelText} fill="var(--text-muted)">
            / 100
          </text>
          {confidence !== undefined && (
            <text x="60" y="77" textAnchor="middle" className={styles.confText} fill="var(--text-muted)">
              {Math.round(confidence)}% confident
            </text>
          )}
        </svg>
      </div>
      <div className={styles.levelBadge} style={{ background: `${color}22`, color, borderColor: `${color}44` }}>
        {badgeLabel}
      </div>
    </div>
  )
}
