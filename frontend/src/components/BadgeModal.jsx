import { useState } from 'react'
import Icon from './Icon'
import { issueBadge, getBadgeUrl } from '../api/badge'
import styles from './BadgeModal.module.css'

export default function BadgeModal({ result, onClose }) {
  const [copied, setCopied] = useState(null) // 'md' | 'html' | 'link' | null
  const score = result?.bias_score || 0
  const level = result?.bias_level || 'Unknown'

  const color = score < 20 ? '4ade80' : score < 45 ? 'fbbf24' : score < 70 ? 'f97316' : 'f87171'

  // Generate inline SVG badge (embed codes — no server needed)
  const svgBadge = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="40" aria-label="FairLens Audit: ${score}/100">
  <linearGradient id="b" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="a"><rect width="280" height="40" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#a)">
    <rect width="160" height="40" fill="#26262a"/>
    <rect x="160" width="120" height="40" fill="#${color}"/>
    <rect width="280" height="40" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="bold">
    <text x="80" y="25" fill="#e8720c">FairLens <tspan fill="#f0ece4" font-weight="normal">Audited</tspan></text>
    <text x="220" y="25" fill="#1a1a1a">${score}/100 – ${level}</text>
  </g>
</svg>`

  const b64 = btoa(svgBadge)
  const badgeDataUrl = `data:image/svg+xml;base64,${b64}`

  // Issue a persistent badge and get its public URL
  const badge   = issueBadge(result, '')
  const badgePageUrl = getBadgeUrl(badge.id)

  const mdCode   = `[![FairLens Audit](${badgeDataUrl})](${badgePageUrl})`
  const htmlCode = `<a href="${badgePageUrl}"><img src="${badgeDataUrl}" alt="FairLens Audit: ${score}/100 – ${level}"></a>`

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2200)
    } catch {}
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>🏅 FairScore Badge</h3>
          <button className={styles.closeBtn} onClick={onClose}><Icon name="close" size={16}/></button>
        </div>

        <div className={styles.modalBody}>
          <p>Embed this badge in your GitHub README, website, or compliance portal to prove your AI model's fairness.</p>

          {/* Preview */}
          <div className={styles.badgePreview}>
            <span className={styles.previewLabel}>Preview</span>
            <img src={badgeDataUrl} alt="FairLens Badge Preview" />
          </div>

          {/* Shareable link */}
          <div className={styles.codeSection}>
            <div className={styles.codeHeader}>
              <span>🔗 Public Badge Link</span>
              <button
                className={copied === 'link' ? styles.copiedBtn : ''}
                onClick={() => copy(badgePageUrl, 'link')}>
                {copied === 'link' ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
            <textarea readOnly value={badgePageUrl} rows={2} />
            <p className={styles.codeNote}>Share this link directly — anyone can view your audit certificate.</p>
          </div>

          {/* Markdown */}
          <div className={styles.codeSection}>
            <div className={styles.codeHeader}>
              <span>Markdown</span>
              <button
                className={copied === 'md' ? styles.copiedBtn : ''}
                onClick={() => copy(mdCode, 'md')}>
                {copied === 'md' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <textarea readOnly value={mdCode} rows={3} />
            <p className={styles.codeNote}>Paste into your GitHub README. The badge links to the public certificate page.</p>
          </div>

          {/* HTML */}
          <div className={styles.codeSection}>
            <div className={styles.codeHeader}>
              <span>HTML</span>
              <button
                className={copied === 'html' ? styles.copiedBtn : ''}
                onClick={() => copy(htmlCode, 'html')}>
                {copied === 'html' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <textarea readOnly value={htmlCode} rows={3} />
            <p className={styles.codeNote}>Paste into any HTML page or documentation site.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
