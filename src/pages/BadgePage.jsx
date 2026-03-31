import { useParams, useNavigate } from 'react-router-dom'
import { getBadge } from '../api/badge'
import styles from './BadgePage.module.css'

export default function BadgePage() {
  const { badgeId } = useParams()
  const navigate = useNavigate()
  const badge = getBadge(badgeId)

  if (!badge) return (
    <div className={styles.notFound}>
      <div className={styles.notFoundIcon}>🔍</div>
      <h2>Badge Not Found</h2>
      <p>This badge may have been issued on a different device, or the link is invalid.</p>
      <button onClick={() => navigate('/')}>← Back to FairLens</button>
    </div>
  )

  const scoreColor = badge.score < 20 ? '#4ade80' : badge.score < 45 ? '#fbbf24' : badge.score < 70 ? '#f97316' : '#f87171'
  const issued = new Date(badge.issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <img src="/fairlens_logo.png" alt="FairLens" className={styles.logo}/>
          <div className={styles.headerText}>
            <span className={styles.headerLabel}>Fairness Audit Certificate</span>
            <span className={styles.headerSub}>Powered by FairLens · Gemini 2.5 Flash</span>
          </div>
        </div>

        {/* Score */}
        <div className={styles.scoreSection}>
          <div className={styles.scoreBig} style={{ color: scoreColor, borderColor: scoreColor + '40', background: scoreColor + '12' }}>
            <span className={styles.scoreNum}>{Math.round(badge.score)}</span>
            <span className={styles.scoreOf}>/100</span>
          </div>
          <div className={styles.scoreInfo}>
            <div className={styles.levelBadge} style={{ color: scoreColor, background: scoreColor + '18', borderColor: scoreColor + '50' }}>
              {badge.level} Bias
            </div>
            <p className={styles.riskLabel}>{badge.risk_label}</p>
            <p className={styles.issuedAt}>Audited on {issued}</p>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          {[
            { label: 'Dataset Rows', value: badge.total_rows?.toLocaleString() || '—' },
            { label: 'Protected Attribute', value: badge.sensitive_column || 'auto-detected' },
            { label: 'Outcome Column', value: badge.target_column || 'auto-detected' },
            { label: 'Metrics Flagged', value: `${badge.metrics_flagged} / ${badge.metrics_total}`, color: badge.metrics_flagged > 0 ? '#f87171' : '#4ade80' },
            ...(badge.cramers_v != null ? [{ label: "Cramér's V", value: `${badge.cramers_v.toFixed(3)} (${badge.effect_size} effect)` }] : []),
          ].map((s, i) => (
            <div key={i} className={styles.statItem}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statValue} style={s.color ? { color: s.color } : {}}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Key findings */}
        {badge.key_findings?.length > 0 && (
          <div className={styles.findings}>
            <p className={styles.findingsTitle}>Key Findings</p>
            {badge.key_findings.map((f, i) => (
              <div key={i} className={styles.findingItem}>
                <span className={styles.findingDot}/>
                <span>{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* EU AI Act note */}
        <div className={styles.compliance}>
          <span className={styles.complianceIcon}>⚖️</span>
          <p>This audit was conducted in accordance with EU AI Act obligations (Articles 10, 11, 12) for high-risk AI systems. Documentation retained for conformity assessment.</p>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span>Badge ID: {badgeId}</span>
          <span>·</span>
          <span>FairLens v1.0</span>
          <span>·</span>
          <button className={styles.footerLink} onClick={() => navigate('/')}>Run Your Own Audit →</button>
        </div>
      </div>
    </div>
  )
}
