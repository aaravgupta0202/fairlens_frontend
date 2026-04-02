import { useState, useMemo } from 'react'
import Icon from './Icon'
import { issueBadge, getBadgeUrl } from '../api/badge'
import styles from './BadgeModal.module.css'

export default function BadgeModal({ result, onClose }) {
  const [copied, setCopied] = useState(null) // 'md' | 'html' | 'link' | null

  const score = Math.round(result?.bias_score || 0)
  const level = result?.bias_level || 'Unknown'

  // Color hex (no # — used inside SVG attribute)
  const colorHex = score < 20 ? '4ade80' : score < 45 ? 'fbbf24' : score < 70 ? 'f97316' : 'f87171'

  // Build SVG — MUST use only Latin-1 safe characters for btoa()
  // No em dashes, no curly quotes, no unicode
  const svgText = `${score}/100 - ${level}`
  const svgBadge = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="40" role="img" aria-label="FairLens Audit: ${svgText}">`,
    `<linearGradient id="bg" x2="0" y2="100%">`,
    `<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>`,
    `<stop offset="1" stop-opacity=".1"/>`,
    `</linearGradient>`,
    `<clipPath id="cp"><rect width="280" height="40" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#cp)">`,
    `<rect width="160" height="40" fill="#26262a"/>`,
    `<rect x="160" width="120" height="40" fill="#${colorHex}"/>`,
    `<rect width="280" height="40" fill="url(#bg)"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="bold">`,
    `<text x="80" y="25" fill="#e8720c">FairLens <tspan fill="#f0ece4" font-weight="normal">Audited</tspan></text>`,
    `<text x="220" y="25" fill="#1a1a1a">${svgText}</text>`,
    `</g>`,
    `</svg>`,
  ].join('')

  // Safe btoa — encode to UTF-8 bytes first, then base64
  const badgeDataUrl = useMemo(() => {
    try {
      // encodeURIComponent -> unescape gives us a Latin-1 safe string
      const encoded = unescape(encodeURIComponent(svgBadge))
      return `data:image/svg+xml;base64,${btoa(encoded)}`
    } catch (e) {
      console.error('Badge SVG encoding failed:', e)
      return ''
    }
  }, [svgBadge])

  // Issue badge once and store the URL
  const { badge, badgePageUrl } = useMemo(() => {
    const b = issueBadge(result, '')
    return { badge: b, badgePageUrl: getBadgeUrl(b.id) }
  }, [result])

  const mdCode   = `[![FairLens Audit](${badgeDataUrl})](${badgePageUrl})`
  const htmlCode = `<a href="${badgePageUrl}"><img src="${badgeDataUrl}" alt="FairLens Audit: ${svgText}"></a>`

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
          <button className={styles.closeBtn} onClick={onClose}>
            <Icon name="close" size={16}/>
          </button>
        </div>

        <div className={styles.modalBody}>
          <p>Embed this badge in your GitHub README, website, or compliance portal to prove your AI model's fairness.</p>

          {/* Live preview */}
          <div className={styles.badgePreview}>
            <span className={styles.previewLabel}>Preview</span>
            {badgeDataUrl
              ? <img src={badgeDataUrl} alt="FairLens Badge Preview" />
              : <span style={{color:'var(--red)',fontSize:13}}>Badge preview unavailable</span>
            }
          </div>

          {/* Public link */}
          <div className={styles.codeSection}>
            <div className={styles.codeHeader}>
              <span>🔗 Public Badge Page</span>
              <button
                className={copied === 'link' ? styles.copiedBtn : undefined}
                onClick={() => copy(badgePageUrl, 'link')}>
                {copied === 'link' ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
            <textarea readOnly value={badgePageUrl} rows={1} />
            <p className={styles.codeNote}>Share this link — anyone can view your full audit certificate page.</p>
          </div>

          {/* Markdown */}
          <div className={styles.codeSection}>
            <div className={styles.codeHeader}>
              <span>Markdown</span>
              <button
                className={copied === 'md' ? styles.copiedBtn : undefined}
                onClick={() => copy(mdCode, 'md')}>
                {copied === 'md' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <textarea readOnly value={mdCode} rows={3} />
            <p className={styles.codeNote}>Paste into your GitHub README. Badge image links to the certificate page.</p>
          </div>

          {/* HTML */}
          <div className={styles.codeSection}>
            <div className={styles.codeHeader}>
              <span>HTML</span>
              <button
                className={copied === 'html' ? styles.copiedBtn : undefined}
                onClick={() => copy(htmlCode, 'html')}>
                {copied === 'html' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <textarea readOnly value={htmlCode} rows={3} />
            <p className={styles.codeNote}>Paste into any website or documentation page.</p>
          </div>
        </div>

      </div>
    </div>
  )
}
