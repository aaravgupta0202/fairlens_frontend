import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import BiasGauge from '../components/BiasGauge'
import CategoryChart from '../components/CategoryChart'
import ExplanationPanel from '../components/ExplanationPanel'
import RewritePanel from '../components/RewritePanel'
import HistoryPanel from '../components/HistoryPanel'
import TrendChart from '../components/TrendChart'
import { buildShareUrl, decodeShareData } from '../api/share'
import { exportToPdf } from '../api/exportPdf'
import styles from './Results.module.css'

export default function Results() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [shareState, setShareState] = useState('idle') // idle | copied | error
  const [showHistory, setShowHistory] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Support loading from shared URL param
  const sharedParam = searchParams.get('shared')
  let stateData = location.state

  if (!stateData && sharedParam) {
    const decoded = decodeShareData(sharedParam)
    if (decoded) stateData = decoded
  }

  const { result, prompt, aiResponse } = stateData || {}

  useEffect(() => {
    if (!result) navigate('/', { replace: true })
  }, [result, navigate])

  if (!result) return null

  async function handleShare() {
    const url = buildShareUrl({ result, prompt, aiResponse })
    if (!url) { setShareState('error'); return }
    try {
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2500)
    } catch {
      setShareState('error')
    }
  }

  async function handleExportPdf() {
    setExporting(true)
    try {
      await exportToPdf(prompt, aiResponse, result)
    } finally {
      setExporting(false)
    }
  }

  const shareLabel = {
    idle: '🔗 Share',
    copied: '✓ Link copied!',
    error: 'Copy failed',
  }[shareState]

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>
            ← Analyse another
          </button>
          <div className={styles.logo}>⚖ FairLens</div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.actionBtn}
            onClick={() => setShowHistory(true)}
          >
            📋 History
          </button>
          <button
            className={`${styles.actionBtn} ${shareState === 'copied' ? styles.actionSuccess : ''}`}
            onClick={handleShare}
          >
            {shareLabel}
          </button>
          <button
            className={styles.actionBtn}
            onClick={handleExportPdf}
            disabled={exporting}
          >
            {exporting ? '⏳ Exporting...' : '📄 Export PDF'}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Top row: Gauge + Category chart */}
        <div className={styles.topRow}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Overall Bias Score</h3>
            <div className={styles.gaugeWrapper}>
              <BiasGauge
                score={result.bias_score}
                level={result.bias_level}
                confidence={result.confidence}
              />
            </div>
            <p className={styles.gaugeHint}>
              {result.bias_level === 'Low' && 'This response shows minimal bias.'}
              {result.bias_level === 'Moderate' && 'This response contains notable bias that could affect some groups.'}
              {result.bias_level === 'High' && 'This response contains significant bias. Review the unbiased rewrite below.'}
            </p>
          </div>

          <div className={`${styles.card} ${styles.chartCard}`}>
            <h3 className={styles.cardTitle}>Bias by Dimension</h3>
            <CategoryChart categories={result.categories} />
          </div>
        </div>

        {/* Trend chart — only shows if 2+ history items */}
        <div className={styles.card}>
          <TrendChart />
          {/* Fallback if only 1 analysis */}
          {(typeof window !== 'undefined' && JSON.parse(localStorage.getItem('fairlens_history') || '[]').length < 2) && (
            <p className={styles.trendHint}>Run more analyses to see your bias score trend over time.</p>
          )}
        </div>

        {/* Root cause */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Root Cause Analysis</h3>
          <ExplanationPanel
            explanation={result.explanation}
            flaggedPhrases={result.flagged_phrases}
          />
        </div>

        {/* Rewrite with inline highlighting */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Original vs. Unbiased Rewrite</h3>
          <RewritePanel
            original={aiResponse}
            unbiased={result.unbiased_response}
            flaggedPhrases={result.flagged_phrases}
          />
        </div>

        {/* Original prompt */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Original Prompt</h3>
          <p className={styles.promptText}>{prompt}</p>
        </div>
      </main>

      <footer className={styles.footer}>
        Built by Team Triple A · Solution Challenge 2026 · Powered by Gemini 2.5 Flash
      </footer>

      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
    </div>
  )
}
