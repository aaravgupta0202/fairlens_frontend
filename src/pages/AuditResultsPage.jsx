import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AuditResults from '../components/AuditResults'
import AuditHistoryPanel from '../components/AuditHistoryPanel'
import ThemeToggle from '../components/ThemeToggle'
import { decodeShareData } from '../api/share'
import styles from './Results.module.css'

const SESSION_KEY = 'fairlens_audit_result'

export default function AuditResultsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showHistory, setShowHistory] = useState(false)

  const sharedParam = searchParams.get('shared')

  // 1. Try React Router state first
  let stateData = location.state

  // 2. Try shared URL param
  if (!stateData && sharedParam) {
    const decoded = decodeShareData(sharedParam)
    if (decoded) stateData = decoded
  }

  // 3. Try sessionStorage recovery (survives Netlify full-page reloads)
  if (!stateData) {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) stateData = JSON.parse(saved)
    } catch { /* ignore */ }
  }

  const { result, targetColumn, sensitiveColumn } = stateData || {}

  // Save to sessionStorage whenever we have real data
  useEffect(() => {
    if (result) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ result, targetColumn, sensitiveColumn }))
      } catch { /* ignore */ }
    }
  }, [result, targetColumn, sensitiveColumn])

  useEffect(() => {
    if (!result) navigate('/', { replace: true })
  }, [result, navigate])

  if (!result) return null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>← Back</button>
          <div className={styles.logoArea}>
            <img src="/fairlens-logo.png" alt="FairLens" className={styles.logoImg} />
            <span className={styles.logoText}>FairLens</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <button className={styles.actionBtn} onClick={() => setShowHistory(true)}>
            📊 Audit History
          </button>
        </div>
      </header>

      <div style={{ width: '100%', maxWidth: '1000px' }}>
        <div className={`${styles.banner} ${styles[`banner${result.bias_level}`]}`}>
          {result.bias_level === 'Low' && '✓ Low bias detected. This dataset appears mostly fair.'}
          {result.bias_level === 'Moderate' && '⚠ Moderate bias detected. Review the comparison below.'}
          {result.bias_level === 'High' && '⚠ High bias detected. Significant bias found — see mitigation results below.'}
        </div>
      </div>

      <main className={styles.main}>
        <AuditResults
          result={result}
          targetColumn={targetColumn}
          sensitiveColumn={sensitiveColumn}
          onReset={() => {
            sessionStorage.removeItem(SESSION_KEY)
            navigate('/')
          }}
          standalone={true}
        />
      </main>

      <footer className={styles.footer}>
        Built by Team Triple A · Solution Challenge 2026 · Powered by Gemini 2.5 Flash
      </footer>

      {showHistory && (
        <AuditHistoryPanel
          onClose={() => setShowHistory(false)}
          onOpen={(entry) => {
            navigate('/audit-results', {
              state: {
                result: entry.result,
                targetColumn: entry.targetColumn,
                sensitiveColumn: entry.sensitiveColumn,
              }
            })
            setShowHistory(false)
          }}
        />
      )}
    </div>
  )
}