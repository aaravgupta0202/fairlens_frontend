import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AuditResults from '../components/AuditResults'
import AuditHistoryPanel from '../components/AuditHistoryPanel'
import { decodeShareData } from '../api/share'
import styles from './Results.module.css'

export default function AuditResultsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showHistory, setShowHistory] = useState(false)

  const sharedParam = searchParams.get('shared')
  let stateData = location.state

  if (!stateData && sharedParam) {
    const decoded = decodeShareData(sharedParam)
    if (decoded) stateData = decoded
  }

  const { result, targetColumn, sensitiveColumn } = stateData || {}

  useEffect(() => {
    if (!result) navigate('/', { replace: true })
  }, [result, navigate])

  if (!result) return null

  return (
    <div className={styles.page}>
      {/* Same header as Results.jsx */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>← Back</button>
          <div className={styles.logoArea}>
            <img src="/fairlens_logo.png" alt="FairLens" className={styles.logoImg} />
            <span className={styles.logoText}></span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <button className={styles.actionBtn} onClick={() => setShowHistory(true)}>
            📊 Audit History
          </button>
        </div>
      </header>

      {/* Bias level banner matching Results.jsx style */}
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
          onReset={() => navigate('/')}
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
