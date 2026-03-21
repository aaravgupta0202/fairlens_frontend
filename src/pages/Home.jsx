import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyseText } from '../api/fairlens'
import { auditDataset, parseCsvHeaders } from '../api/audit'
import { saveToHistory, saveToAuditHistory, generateId, getHistory, getAuditHistory } from '../api/history'
import DatasetUpload from '../components/DatasetUpload'
import ColumnSelector from '../components/ColumnSelector'
import HistoryPanel from '../components/HistoryPanel'
import AuditHistoryPanel from '../components/AuditHistoryPanel'
import TrendChart from '../components/TrendChart'
import ThemeToggle from '../components/ThemeToggle'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('dataset')

  // Text
  const [prompt, setPrompt] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [textLoading, setTextLoading] = useState(false)
  const [textError, setTextError] = useState('')

  // Audit
  const [csvFile, setCsvFile] = useState(null)
  const [columns, setColumns] = useState([])
  const [targetCol, setTargetCol] = useState('')
  const [sensitiveCol, setSensitiveCol] = useState('')
  const [sensitiveCol2, setSensitiveCol2] = useState(null)
  const [modelType, setModelType] = useState('logistic_regression')
  const [strategy, setStrategy] = useState('reweighing')
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')

  // Shared
  const [showTextHistory, setShowTextHistory] = useState(false)
  const [showAuditHistory, setShowAuditHistory] = useState(false)
  const textHistoryCount = getHistory().length
  const auditHistoryCount = getAuditHistory().length

  async function handleAnalyse() {
    if (!prompt.trim() || !aiResponse.trim()) { setTextError('Please fill in both fields.'); return }
    setTextError(''); setTextLoading(true)
    try {
      const result = await analyseText(prompt.trim(), aiResponse.trim())
      saveToHistory({ id: generateId(), timestamp: Date.now(), prompt: prompt.trim(), aiResponse: aiResponse.trim(), result })
      navigate('/results', { state: { result, prompt: prompt.trim(), aiResponse: aiResponse.trim() } })
    } catch (err) {
      setTextError(`Analysis failed: ${err?.response?.data?.detail || err.message}`)
    } finally { setTextLoading(false) }
  }

  function loadExample() {
    setPrompt("Who makes a better leader, a man or a woman?")
    setAiResponse("Men tend to make better leaders because they are more decisive, assertive, and less emotional in high-pressure situations. Women are naturally more suited to supportive roles and tend to struggle with the demands of executive leadership.")
    setTextError('')
  }

  async function handleFileSelected(file) {
    setCsvFile(file); setAuditError('')
    try {
      const headers = await parseCsvHeaders(file)
      setColumns(headers); setTargetCol(''); setSensitiveCol(''); setSensitiveCol2(null)
    } catch { setAuditError('Could not read CSV headers.') }
  }

  async function handleAudit() {
    if (!csvFile) { setAuditError('Please upload a CSV file.'); return }
    if (!targetCol) { setAuditError('Please select a target column.'); return }
    if (!sensitiveCol) { setAuditError('Please select a sensitive attribute.'); return }
    if (targetCol === sensitiveCol) { setAuditError('Target and sensitive columns must be different.'); return }
    setAuditError(''); setAuditLoading(true)
    try {
      const result = await auditDataset({ file: csvFile, targetColumn: targetCol,
        sensitiveColumn: sensitiveCol, sensitiveColumn2: sensitiveCol2, modelType, strategy })
      saveToAuditHistory({ id: generateId(), timestamp: Date.now(),
        targetColumn: targetCol, sensitiveColumn: sensitiveCol, result })
      navigate('/audit-results', { state: { result, targetColumn: targetCol, sensitiveColumn: sensitiveCol } })
    } catch (err) {
      setAuditError(`Audit failed: ${err?.response?.data?.detail || err.message}`)
    } finally { setAuditLoading(false) }
  }

  function handleAuditHistoryOpen(entry) {
    navigate('/audit-results', { state: { result: entry.result,
      targetColumn: entry.targetColumn, sensitiveColumn: entry.sensitiveColumn } })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <img src="/fairlens_logo.png" alt="FairLens" className={styles.logoImg} />
          <span className={styles.logoText}></span>
        </div>
        <div className={styles.headerRight}>
          <ThemeToggle />
          {mode === 'dataset' ? (
            <button className={styles.historyBtn} onClick={() => setShowAuditHistory(true)}>
              📊 History {auditHistoryCount > 0 && <span className={styles.historyBadge}>{auditHistoryCount}</span>}
            </button>
          ) : (
            <button className={styles.historyBtn} onClick={() => setShowTextHistory(true)}>
              📋 History {textHistoryCount > 0 && <span className={styles.historyBadge}>{textHistoryCount}</span>}
            </button>
          )}
        </div>
      </header>

      <p className={styles.tagline}>Detect hidden bias in any AI response or dataset — instantly.</p>

      <main className={styles.main}>
        <div className={styles.modeToggle}>
          <button className={`${styles.modeBtn} ${mode === 'dataset' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('dataset')}>
            <span>📊</span> Dataset Fairness Audit
          </button>
          <button className={`${styles.modeBtn} ${mode === 'text' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('text')}>
            <span>💬</span> Text Bias Analysis
          </button>
        </div>

        {/* ── DATASET MODE ── */}
        {mode === 'dataset' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Upload a dataset to audit for bias</h2>
            </div>
            <div className={styles.auditSteps}>
              <div className={styles.stepRow}>
                <div className={styles.stepNum}>1</div>
                <div className={styles.stepContent}>
                  <p className={styles.stepLabel}>Upload CSV Dataset</p>
                  <DatasetUpload onFileSelected={handleFileSelected} file={csvFile} />
                </div>
              </div>
              <div className={`${styles.stepRow} ${!csvFile ? styles.stepDisabled : ''}`}>
                <div className={styles.stepNum}>2</div>
                <div className={styles.stepContent}>
                  <p className={styles.stepLabel}>Configure Columns &amp; Model</p>
                  {columns.length > 0 ? (
                    <ColumnSelector
                      columns={columns}
                      targetCol={targetCol} sensitiveCol={sensitiveCol}
                      sensitiveCol2={sensitiveCol2} modelType={modelType}
                      strategy={strategy}
                      onTargetChange={setTargetCol} onSensitiveChange={setSensitiveCol}
                      onSensitiveChange2={setSensitiveCol2} onModelTypeChange={setModelType}
                      onStrategyChange={setStrategy}
                    />
                  ) : (
                    <p className={styles.stepHint}>Upload a CSV to see available columns.</p>
                  )}
                </div>
              </div>
              <div className={`${styles.stepRow} ${(!csvFile || !targetCol || !sensitiveCol) ? styles.stepDisabled : ''}`}>
                <div className={styles.stepNum}>3</div>
                <div className={styles.stepContent}>
                  <p className={styles.stepLabel}>Run Fairness Audit</p>
                  <p className={styles.stepHint}>
                    FairLens trains a model, measures bias across all 5 fairness metrics, applies your chosen mitigation strategy, and delivers a Gemini-powered explanation. Download the debiased dataset and model after.
                  </p>
                </div>
              </div>
            </div>
            {auditError && <p className={styles.error}>{auditError}</p>}
            <button className={styles.analyseBtn} onClick={handleAudit}
              disabled={auditLoading || !csvFile || !targetCol || !sensitiveCol}>
              {auditLoading ? <><span className={styles.spinner} />Training model &amp; auditing...</> : '📊 Run Fairness Audit'}
            </button>
          </div>
        )}

        {/* ── TEXT MODE ── */}
        {mode === 'text' && (
          <>
            <TrendChart />
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>Paste your AI prompt &amp; response</h2>
                <button className={styles.exampleBtn} onClick={loadExample}>Load example</button>
              </div>
              <div className={styles.inputGrid}>
                <div className={styles.inputGroup}>
                  <label htmlFor="prompt">
                    <span className={styles.labelDot} style={{ background: 'var(--primary)' }} />
                    Your Prompt
                  </label>
                  <textarea id="prompt" className={styles.textarea}
                    placeholder="e.g. Who makes a better leader?"
                    value={prompt} onChange={e => setPrompt(e.target.value)} rows={8} />
                  <span className={styles.charCount}>{prompt.length} chars</span>
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="aiResponse">
                    <span className={styles.labelDot} style={{ background: 'var(--red)' }} />
                    AI Response to Analyse
                  </label>
                  <textarea id="aiResponse" className={styles.textarea}
                    placeholder="Paste the AI's response here..."
                    value={aiResponse} onChange={e => setAiResponse(e.target.value)} rows={8} />
                  <span className={styles.charCount}>{aiResponse.length} chars</span>
                </div>
              </div>
              {textError && <p className={styles.error}>{textError}</p>}
              <button className={styles.analyseBtn} onClick={handleAnalyse} disabled={textLoading}>
                {textLoading ? <><span className={styles.spinner} />Analysing with Gemini 2.5 Flash...</> : '🔍 Analyse for Bias'}
              </button>
            </div>
          </>
        )}

        {/* How it works */}
        <div className={styles.howItWorks}>
          <h3>How FairLens works</h3>
          <div className={styles.steps}>
            {(mode === 'dataset' ? [
              { icon: '📁', title: 'Upload', desc: 'Upload any CSV dataset' },
              { icon: '⚙️', title: 'Configure', desc: 'Select columns, model & strategy' },
              { icon: '🧪', title: 'Train', desc: 'Model trained, 5 fairness metrics measured' },
              { icon: '⚖️', title: 'Mitigate', desc: 'Bias fixed, debiased files ready' },
            ] : [
              { icon: '📋', title: 'Paste', desc: 'Enter any AI prompt and response' },
              { icon: '🤖', title: 'Analyse', desc: 'Gemini 2.5 Flash scans for bias' },
              { icon: '📊', title: 'Score', desc: 'Bias score across 6 dimensions' },
              { icon: '✅', title: 'Fix', desc: 'Unbiased rewrite instantly' },
            ]).map(s => (
              <div key={s.title} className={styles.stepCard}>
                <div className={styles.stepCardIcon}>{s.icon}</div>
                <strong>{s.title}</strong>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        Built by Team Triple A · Solution Challenge 2026 · Powered by Gemini 2.5 Flash
      </footer>

      {showTextHistory && <HistoryPanel onClose={() => setShowTextHistory(false)} />}
      {showAuditHistory && <AuditHistoryPanel onClose={() => setShowAuditHistory(false)} onOpen={handleAuditHistoryOpen} />}
    </div>
  )
}
