import { useNavigate, useParams } from 'react-router-dom'
import styles from './BadgePage.module.css'
import { generateBadgeId } from '../api/badgeId'

/**
 * BadgePage — public audit certificate page.
 * Accessible at /badge/:badgeId
 *
 * Badge IDs are deterministic (generated from audit result fields),
 * so the page reconstructs summary info from the ID parameters.
 * Full audit data lives in localStorage on the issuing device.
 */

function tryGetBadgeData(badgeId) {
  try {
    const stored = JSON.parse(localStorage.getItem('fairlens_badges') || '{}')
    return stored[badgeId] || null
  } catch {
    return null
  }
}

export default function BadgePage() {
  const { badgeId } = useParams()
  const navigate     = useNavigate()
  const badge        = tryGetBadgeData(badgeId)

  const scoreColor = (score) =>
    score < 20 ? '#4ade80' : score < 45 ? '#fbbf24' : score < 70 ? '#f97316' : '#f87171'

  // Badge was issued on this device — show full certificate
  if (badge) {
    const color  = scoreColor(badge.score ?? 0)
    const issued = new Date(badge.issuedAt).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <img src="/fairlens_logo.png" alt="FairLens" className={styles.logo} />
            <div className={styles.headerText}>
              <span className={styles.headerLabel}>Fairness Audit Certificate</span>
              <span className={styles.headerSub}>Powered by FairLens · Gemini 2.5 Flash</span>
            </div>
          </div>

          <div className={styles.scoreSection}>
            <div className={styles.scoreBig} style={{ color, borderColor: color + '40', background: color + '12' }}>
              <span className={styles.scoreNum}>{Math.round(badge.score ?? 0)}</span>
              <span className={styles.scoreOf}>/100</span>
            </div>
            <div className={styles.scoreInfo}>
              <div className={styles.levelBadge} style={{ color, background: color + '18', borderColor: color + '50' }}>
                {badge.level} Bias
              </div>
              <p className={styles.riskLabel}>{badge.risk_label}</p>
              <p className={styles.issuedAt}>Audited on {issued}</p>
            </div>
          </div>

          <div className={styles.statsGrid}>
            {[
              { label: 'Dataset Rows',        value: badge.total_rows?.toLocaleString() ?? '—' },
              { label: 'Protected Attribute',  value: badge.sensitive_column ?? 'auto-detected' },
              { label: 'Outcome Column',       value: badge.target_column ?? 'auto-detected' },
              { label: 'Metrics Flagged',      value: `${badge.metrics_flagged ?? '—'} / ${badge.metrics_total ?? '—'}`,
                color: (badge.metrics_flagged ?? 0) > 0 ? '#f87171' : '#4ade80' },
              ...(badge.cramers_v != null ? [{ label: "Cramér's V", value: `${badge.cramers_v.toFixed(3)} (${badge.effect_size} effect)` }] : []),
            ].map((s, i) => (
              <div key={i} className={styles.statItem}>
                <span className={styles.statLabel}>{s.label}</span>
                <span className={styles.statValue} style={s.color ? { color: s.color } : {}}>{s.value}</span>
              </div>
            ))}
          </div>

          {badge.key_findings?.length > 0 && (
            <div className={styles.findings}>
              <p className={styles.findingsTitle}>Key Findings</p>
              {badge.key_findings.map((f, i) => (
                <div key={i} className={styles.findingItem}>
                  <span className={styles.findingDot} />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}

          <div className={styles.compliance}>
            <span className={styles.complianceIcon}>⚖️</span>
            <p>This audit was conducted in accordance with EU AI Act obligations (Articles 10, 11, 12) for high-risk AI systems.</p>
          </div>

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

  // Badge was issued on a different device — show a clear explanation
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img src="/fairlens_logo.png" alt="FairLens" className={styles.logo} />
          <div className={styles.headerText}>
            <span className={styles.headerLabel}>Fairness Audit Certificate</span>
          </div>
        </div>

        <div className={styles.notFound}>
          <div className={styles.notFoundIcon}>🔍</div>
          <h2>Certificate Not Available Here</h2>
          <p>
            Badge ID: <code>{badgeId}</code>
          </p>
          <p>
            FairLens stores audit certificates locally in the browser where the audit was run.
            This badge was generated on a different device or browser, so the full certificate
            cannot be displayed here.
          </p>
          <p className={styles.notFoundHint}>
            To view this certificate, open this link on the device that originally ran the audit.
          </p>
          <button className={styles.backBtn} onClick={() => navigate('/')}>
            ← Run Your Own Audit
          </button>
        </div>

        <div className={styles.footer}>
          <span>Badge ID: {badgeId}</span>
          <span>·</span>
          <span>FairLens v1.0</span>
        </div>
      </div>
    </div>
  )
}
