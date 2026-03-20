import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyseText } from '../api/fairlens'
import { saveToHistory, generateId, getHistory } from '../api/history'
import HistoryPanel from '../components/HistoryPanel'
import TrendChart from '../components/TrendChart'
import styles from './Home.module.css'

export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const navigate = useNavigate()

  const historyCount = getHistory().length

  async function handleAnalyse() {
    if (!prompt.trim() || !aiResponse.trim()) {
      setError('Please fill in both fields before analysing.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await analyseText(prompt.trim(), aiResponse.trim())
      // Save to localStorage history
      saveToHistory({
        id: generateId(),
        timestamp: Date.now(),
        prompt: prompt.trim(),
        aiResponse: aiResponse.trim(),
        result,
      })
      navigate('/results', { state: { result, prompt: prompt.trim(), aiResponse: aiResponse.trim() } })
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Something went wrong.'
      setError(`Analysis failed: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  function loadExample() {
    setPrompt("Who makes a better leader, a man or a woman?")
    setAiResponse("Men tend to make better leaders because they are more decisive, assertive, and less emotional in high-pressure situations. Women are naturally more suited to supportive roles and tend to struggle with the demands of executive leadership.")
    setError('')
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚖</span>
          <span className={styles.logoText}>FairLens</span>
        </div>
        <button
          className={styles.historyBtn}
          onClick={() => setShowHistory(true)}
        >
          📋 History {historyCount > 0 && <span className={styles.historyBadge}>{historyCount}</span>}
        </button>
      </header>

      <p className={styles.tagline}>Detect hidden bias in any AI response — instantly.</p>

      <main className={styles.main}>
        {/* Trend chart — only shows if 2+ history items */}
        <TrendChart />

        {/* Input card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Paste your AI prompt &amp; response</h2>
            <button className={styles.exampleBtn} onClick={loadExample}>
              Load example
            </button>
          </div>

          <div className={styles.inputGrid}>
            <div className={styles.inputGroup}>
              <label htmlFor="prompt">
                <span className={styles.labelDot} style={{ background: '#4f8ef7' }} />
                Your Prompt
              </label>
              <textarea
                id="prompt"
                className={styles.textarea}
                placeholder="e.g. Who makes a better leader?"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={8}
              />
              <span className={styles.charCount}>{prompt.length} chars</span>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="aiResponse">
                <span className={styles.labelDot} style={{ background: '#f87171' }} />
                AI Response to Analyse
              </label>
              <textarea
                id="aiResponse"
                className={styles.textarea}
                placeholder="Paste the AI's response here..."
                value={aiResponse}
                onChange={e => setAiResponse(e.target.value)}
                rows={8}
              />
              <span className={styles.charCount}>{aiResponse.length} chars</span>
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.analyseBtn}
            onClick={handleAnalyse}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                Analysing with Gemini 2.5 Flash...
              </>
            ) : (
              <>🔍 Analyse for Bias</>
            )}
          </button>
        </div>

        {/* How it works */}
        <div className={styles.howItWorks}>
          <h3>How FairLens works</h3>
          <div className={styles.steps}>
            {[
              { icon: '📋', title: 'Paste', desc: 'Enter any AI prompt and its response' },
              { icon: '🤖', title: 'Analyse', desc: 'Gemini 2.5 Flash scans for hidden bias' },
              { icon: '📊', title: 'Score', desc: 'Get a bias score across 6 dimensions' },
              { icon: '✅', title: 'Fix', desc: 'Receive an unbiased rewrite instantly' },
            ].map(step => (
              <div key={step.title} className={styles.step}>
                <div className={styles.stepIcon}>{step.icon}</div>
                <strong>{step.title}</strong>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        Built by Team Triple A · Solution Challenge 2026 · Powered by Gemini 2.5 Flash
      </footer>

      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
    </div>
  )
}
