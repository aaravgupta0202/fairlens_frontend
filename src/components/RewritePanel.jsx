import { useState } from 'react'
import HighlightedText from './HighlightedText'
import styles from './RewritePanel.module.css'

export default function RewritePanel({ original, unbiased, flaggedPhrases }) {
  const [copied, setCopied] = useState(false)

  function copyUnbiased() {
    navigator.clipboard.writeText(unbiased).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.wrapper}>
      {/* Original with inline highlights */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.badge} style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--red)' }}>
            ✗ Original Response
          </span>
          {flaggedPhrases?.length > 0 && (
            <span className={styles.flagCount}>
              {flaggedPhrases.length} phrase{flaggedPhrases.length > 1 ? 's' : ''} flagged
            </span>
          )}
        </div>
        <HighlightedText text={original} flaggedPhrases={flaggedPhrases} />
      </div>

      {/* Arrow */}
      <div className={styles.arrow}>→</div>

      {/* Unbiased rewrite */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.badge} style={{ background: 'rgba(52,211,153,0.15)', color: 'var(--green)' }}>
            ✓ Unbiased Rewrite
          </span>
          <button className={styles.copyBtn} onClick={copyUnbiased}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
        <p className={styles.text}>{unbiased}</p>
      </div>
    </div>
  )
}
