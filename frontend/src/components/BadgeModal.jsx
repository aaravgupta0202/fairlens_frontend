import { useState, useMemo } from 'react'
import Icon from './Icon'
import { generateBadgeId } from '../api/badgeId'
import styles from './BadgeModal.module.css'

function safeBtoa(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

export default function BadgeModal({ result, onClose }) {
  const [copied, setCopied] = useState(null)

  const score    = Math.round(result?.bias_score ?? 0)
  const level    = result?.bias_level ?? 'Unknown'
  const colorHex = score < 20 ? '4ade80' : score < 45 ? 'fbbf24' : score < 70 ? 'f97316' : 'f87171'

  // Deterministic ID — same as the hash shown in the EU report
  const badgeId      = useMemo(() => generateBadgeId(result), [result])
  const badgePageUrl = `${window.location.origin}/badge/${badgeId}`

  const svgBadge = useMemo(() => [
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="40" role="img" aria-label="FairLens Audit: ${score}/100 - ${level}">`,
    `<title>FairLens Audit: ${score}/100 - ${level}</title>`,
    `<linearGradient id="b0" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
    `<clipPath id="c0"><rect width="280" height="40" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#c0)">`,
    `<rect width="160" height="40" fill="#26262a"/>`,
    `<rect x="160" width="120" height="40" fill="#${colorHex}"/>`,
    `<rect width="280" height="40" fill="url(#b0)"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="bold">`,
    `<text x="80" y="25" fill="#e8720c">FairLens <tspan fill="#f0ece4" font-weight="normal">Audited</tspan></text>`,
    `<text x="220" y="25" fill="#1a1a1a">${score}/100 - ${level}</text>`,
    `</g></svg>`,
  ].join(''), [score, level, colorHex])

  const badgeDataUrl = useMemo(() => {
    try { return `data:image/svg+xml;base64,${safeBtoa(svgBadge)}` }
    catch { return '' }
  }, [svgBadge])

  // GitHub-compatible: shields.io dynamic badge linking to the badge page
  const shieldsUrl   = `https://img.shields.io/badge/FairLens_Audit-${score}%2F100_${encodeURIComponent(level + ' Bias')}-${colorHex}?style=flat-square`
  const mdGithub     = `[![FairLens Audit](${shieldsUrl})](${badgePageUrl})`
  const htmlCode     = `<a href="${badgePageUrl}"><img src="${badgeDataUrl}" alt="FairLens Audit: ${score}/100 - ${level} Bias" /></a>`

  async function copy(text, key) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2500) }
    catch {}
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>🏅 FairScore Badge</h3>
          <button className={styles.closeBtn} onClick={onClose}><Icon name="close" size={16}/></button>
        </div>
        <div className={styles.modalBody}>
          <p>Share your audit results. The badge ID <strong>{badgeId}</strong> matches the EU Compliance Report hash — they're the same audit.</p>

          <div className={styles.badgePreview}>
            <span className={styles.previewLabel}>Preview</span>
            {badgeDataUrl ? <img src={badgeDataUrl} alt="FairLens Badge" /> : <span style={{color:'var(--red)'}}>Preview unavailable</span>}
          </div>

          <div className={styles.codeSection}>
            <div className={styles.codeHeader}>
              <span>🔗 Public Badge Page</span>
              <button className={copied === 'link' ? styles.copiedBtn : ''} onClick={() => copy(badgePageUrl, 'link')}>
                {copied === 'link' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <textarea readOnly value={badgePageUrl} rows={1} />
            <p className={styles.codeNote}>Badge ID: <strong>{badgeId}</strong> — same as in the EU report. Anyone with this link can view the certificate.</p>
          </div>

          <div className={styles.codeSection}>
            <div className={styles.codeHeader}>
              <span>Markdown (GitHub README)</span>
              <button className={copied === 'md' ? styles.copiedBtn : ''} onClick={() => copy(mdGithub, 'md')}>
                {copied === 'md' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <textarea readOnly value={mdGithub} rows={2} />
            <p className={styles.codeNote}>Uses shields.io — renders properly as an image in GitHub READMEs.</p>
          </div>

          <div className={styles.codeSection}>
            <div className={styles.codeHeader}>
              <span>HTML (Website)</span>
              <button className={copied === 'html' ? styles.copiedBtn : ''} onClick={() => copy(htmlCode, 'html')}>
                {copied === 'html' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <textarea readOnly value={htmlCode} rows={3} />
            <p className={styles.codeNote}>Inline SVG — works on any website without external hosting.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
