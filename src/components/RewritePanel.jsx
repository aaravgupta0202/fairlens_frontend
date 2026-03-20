import { useState } from 'react'
import styles from './RewritePanel.module.css'

/**
 * Side-by-side comparison: original biased response vs Gemini's unbiased rewrite.
 */
export default function RewritePanel({ original, unbiased }) {
  const [copied, setCopied] = useState(false)

  function copyUnbiased() {
    navigator.clipboard.writeText(unbiased).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.wrapper}>
      {/* Original */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.badge} style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--red)' }}>
            ✗ Original Response
          </span>
        </div>
        <p className={styles.text}>{original}</p>
      </div>

      {/* Arrow */}
      <div className={styles.arrow}>→</div>

      {/* Unbiased */}
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
