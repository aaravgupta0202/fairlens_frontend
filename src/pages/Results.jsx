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
  const [shareState, setShareState] = useState('idle')
  const [showHistory, setShowHistory] = useState(false)
  const [exporting, setExporting] = useState(false)

  const sharedParam = searchParams.get('shared')
  let stateData = location.state
  if (!stateData && sharedParam) {
    const decoded = decodeShareData(sharedParam)
    if (decoded) stateData = decoded
  }

  const { result, prompt, aiResponse } = stateData || {}

  useEffect(() => { if (!result) navigate('/', { replace: true }) }, [result, navigate])
  if (!result) return null

  async function handleShare() {
    const url = buildShareUrl({ result, prompt, aiResponse })
    if (!url) { setShareState('error'); return }
    try {
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2500)
    } catch { setShareState('error') }
  }

  async function handleExportPdf() {
    setExporting(true)
    try { await exportToPdf(prompt, aiResponse, result) }
    finally { setExporting(false) }
  }

  const shareLabel = { idle: '🔗 Share', copied: '✓ Copied!', error: 'Failed' }[shareState]

  const levelColor = {
    Low: 'var(--green)', Moderate: 'var(--amber)', High: 'var(--red)'
  }[result.bias_level]

  return (
    <div className={styles.page}>
      {/* Header — matches audit style */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>← Back</button>
          <div className={styles.logo}>⚖ FairLens</div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.actionBtn} onClick={() => setShowHistory(true)}>
            📋 History
          </button>
          <button
            className={`${styles.actionBtn} ${shareState === 'copied' ? styles.actionSuccess : ''}`}
            onClick={handleShare}>{shareLabel}
          </button>
          <button className={styles.actionBtn} onClick={handleExportPdf} disabled={exporting}>
            {exporting ? '⏳ Exporting...' : '📄 Export PDF'}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Bias level banner — same style as audit */}
        <div className={`${styles.banner} ${styles[`banner${result.bias_level}`]}`}>
          {result.bias_level === 'Low' && '✓ Low bias detected. This response appears mostly fair.'}
          {result.bias_level === 'Moderate' && '⚠ Moderate bias detected. Review the analysis and unbiased rewrite below.'}
          {result.bias_level === 'High' && '⚠ High bias detected. This response contains significant bias. See the corrected version below.'}
        </div>

        {/* Top row: Gauge + Category chart */}
        <div className={styles.topRow}>
          <div className={styles.card}>
            <p className={styles.cardTitle}>Overall Bias Score</p>
            <div className={styles.gaugeWrapper}>
              <BiasGauge score={result.bias_score} level={result.bias_level} confidence={result.confidence} />
            </div>
            <p className={styles.gaugeHint}>
              {result.bias_level === 'Low' && 'Minimal bias. Minor improvements may still apply.'}
              {result.bias_level === 'Moderate' && 'Notable bias that could affect some groups.'}
              {result.bias_level === 'High' && 'Significant bias. Review the unbiased rewrite.'}
            </p>
          </div>
          <div className={`${styles.card} ${styles.chartCard}`}>
            <p className={styles.cardTitle}>Bias by Dimension</p>
            <CategoryChart categories={result.categories} />
          </div>
        </div>

        {/* Trend chart */}
        <div className={styles.card}>
          <TrendChart />
          {JSON.parse(localStorage.getItem('fairlens_history') || '[]').length < 2 && (
            <p className={styles.trendHint}>Run more analyses to see your bias score trend.</p>
          )}
        </div>

        {/* Root cause */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Root Cause Analysis</p>
          <ExplanationPanel explanation={result.explanation} flaggedPhrases={result.flagged_phrases} />
        </div>

        {/* Rewrite */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Original vs. Unbiased Rewrite</p>
          <RewritePanel original={aiResponse} unbiased={result.unbiased_response} flaggedPhrases={result.flagged_phrases} />
        </div>

        {/* Original prompt */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Original Prompt</p>
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
