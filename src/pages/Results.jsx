import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import BiasGauge from '../components/BiasGauge'
import CategoryChart from '../components/CategoryChart'
import ExplanationPanel from '../components/ExplanationPanel'
import RewritePanel from '../components/RewritePanel'
import styles from './Results.module.css'

export default function Results() {
  const location = useLocation()
  const navigate = useNavigate()

  const { result, prompt, aiResponse } = location.state || {}

  // If someone navigates here directly without state, send them home
  useEffect(() => {
    if (!result) navigate('/', { replace: true })
  }, [result, navigate])

  if (!result) return null

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← Analyse another
        </button>
        <div className={styles.logo}>
          <span>⚖</span> FairLens
        </div>
      </header>

      <main className={styles.main}>
        {/* Top row: Gauge + Category chart */}
        <div className={styles.topRow}>

          {/* Gauge card */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Overall Bias Score</h3>
            <div className={styles.gaugeWrapper}>
              <BiasGauge score={result.bias_score} level={result.bias_level} />
            </div>
            <p className={styles.gaugeHint}>
              {result.bias_level === 'Low' && 'This response shows minimal bias. Minor improvements may still apply.'}
              {result.bias_level === 'Moderate' && 'This response contains notable bias that could affect some groups.'}
              {result.bias_level === 'High' && 'This response contains significant bias. Review the unbiased rewrite below.'}
            </p>
          </div>

          {/* Category chart card */}
          <div className={`${styles.card} ${styles.chartCard}`}>
            <h3 className={styles.cardTitle}>Bias by Dimension</h3>
            <CategoryChart categories={result.categories} />
          </div>
        </div>

        {/* Explanation card */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Root Cause Analysis</h3>
          <ExplanationPanel
            explanation={result.explanation}
            flaggedPhrases={result.flagged_phrases}
          />
        </div>

        {/* Rewrite card */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Original vs. Unbiased Rewrite</h3>
          <RewritePanel
            original={aiResponse}
            unbiased={result.unbiased_response}
          />
        </div>

        {/* Original prompt for context */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Original Prompt</h3>
          <p className={styles.promptText}>{prompt}</p>
        </div>
      </main>

      <footer className={styles.footer}>
        Built by Team Triple A · Solution Challenge 2026 · Powered by Gemini 1.5 Pro
      </footer>
    </div>
  )
}
