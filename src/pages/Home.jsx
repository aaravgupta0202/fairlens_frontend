import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyseText } from '../api/fairlens'
import { auditDataset, parseCsvHeaders } from '../api/audit'
import { saveToHistory, saveToAuditHistory, generateId, getHistory, getAuditHistory } from '../api/history'
import DatasetUpload from '../components/DatasetUpload'
import ColumnSelector from '../components/ColumnSelector'
import AuditResults from '../components/AuditResults'
import HistoryPanel from '../components/HistoryPanel'
import AuditHistoryPanel from '../components/AuditHistoryPanel'
import TrendChart from '../components/TrendChart'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('dataset') // dataset is PRIMARY

  // ── Text mode ────────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [textLoading, setTextLoading] = useState(false)
  const [textError, setTextError] = useState('')

  // ── Dataset mode ─────────────────────────────────────────────────────────
  const [csvFile, setCsvFile] = useState(null)
  const [columns, setColumns] = useState([])
  const [targetCol, setTargetCol] = useState('')
  const [sensitiveCol, setSensitiveCol] = useState('')
  const [sensitiveCol2, setSensitiveCol2] = useState(null)
  const [modelType, setModelType] = useState('logistic_regression')
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [auditResult, setAuditResult] = useState(null)

  // ── Shared ────────────────────────────────────────────────────────────────
  const [showTextHistory, setShowTextHistory] = useState(false)
  const [showAuditHistory, setShowAuditHistory] = useState(false)
  const textHistoryCount = getHistory().length
  const auditHistoryCount = getAuditHistory().length

  // ── Text analysis ─────────────────────────────────────────────────────────
  async function handleAnalyse() {
    if (!prompt.trim() || !aiResponse.trim()) {
      setTextError('Please fill in both fields.'); return
    }
    setTextError('')
    setTextLoading(true)
    try {
      const result = await analyseText(prompt.trim(), aiResponse.trim())
      saveToHistory({ id: generateId(), timestamp: Date.now(),
        prompt: prompt.trim(), aiResponse: aiResponse.trim(), result })
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

  // ── Dataset audit ─────────────────────────────────────────────────────────
  async function handleFileSelected(file) {
    setCsvFile(file); setAuditResult(null); setAuditError('')
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
        sensitiveColumn: sensitiveCol, sensitiveColumn2: sensitiveCol2, modelType })
      saveToAuditHistory({ id: generateId(), timestamp: Date.now(),
        targetColumn: targetCol, sensitiveColumn: sensitiveCol, result })
      navigate('/audit-results', { state: { result, targetColumn: targetCol, sensitiveColumn: sensitiveCol } })
    } catch (err) {
      setAuditError(`Audit failed: ${err?.response?.data?.detail || err.message}`)
    } finally { setAuditLoading(false) }
  }

  function handleAuditHistoryOpen(entry) {
    setAuditResult(entry.result)
    setTargetCol(entry.targetColumn)
    setSensitiveCol(entry.sensitiveColumn)
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚖</span>
          <span className={styles.logoText}>FairLens</span>
        </div>
        <div className={styles.headerRight}>
          {mode === 'dataset' ? (
            <button className={styles.historyBtn} onClick={() => setShowAuditHistory(true)}>
              📊 Audit History
              {auditHistoryCount > 0 && <span className={styles.historyBadge}>{auditHistoryCount}</span>}
            </button>
          ) : (
            <button className={styles.historyBtn} onClick={() => setShowTextHistory(true)}>
              📋 History
              {textHistoryCount > 0 && <span className={styles.historyBadge}>{textHistoryCount}</span>}
            </button>
          )}
        </div>
      </header>

      <p className={styles.tagline}>Detect hidden bias in any AI response or dataset — instantly.</p>

      <main className={styles.main}>
        {/* Mode Toggle — Dataset is first/primary */}
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${mode === 'dataset' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('dataset')}>
            <span>📊</span> Dataset Fairness Audit
          </button>
          <button
            className={`${styles.modeBtn} ${mode === 'text' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('text')}>
            <span>💬</span> Text Bias Analysis
          </button>
        </div>

        {/* ── DATASET MODE ── */}
        {mode === 'dataset' && (
          <>
            {auditResult ? (
              <AuditResults
                result={auditResult}
                targetColumn={targetCol}
                sensitiveColumn={sensitiveCol}
                onReset={() => { setAuditResult(null); setCsvFile(null); setColumns([]) }}
              />
            ) : (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>Upload a dataset to audit for model bias</h2>
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
                          onTargetChange={setTargetCol} onSensitiveChange={setSensitiveCol}
                          onSensitiveChange2={setSensitiveCol2} onModelTypeChange={setModelType}
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
                        FairLens trains a model, measures bias, applies mitigation, and delivers
                        a Gemini-powered explanation with before/after comparison.
                        You can also download the debiased dataset and model after the audit.
                      </p>
                    </div>
                  </div>
                </div>
                {auditError && <p className={styles.error}>{auditError}</p>}
                <button
                  className={styles.analyseBtn}
                  onClick={handleAudit}
                  disabled={auditLoading || !csvFile || !targetCol || !sensitiveCol}>
                  {auditLoading
                    ? <><span className={styles.spinner} />Training model &amp; auditing fairness...</>
                    : '📊 Run Fairness Audit'}
                </button>
              </div>
            )}
          </>
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
                    <span className={styles.labelDot} style={{ background: '#4f8ef7' }} />
                    Your Prompt
                  </label>
                  <textarea id="prompt" className={styles.textarea}
                    placeholder="e.g. Who makes a better leader?"
                    value={prompt} onChange={e => setPrompt(e.target.value)} rows={8} />
                  <span className={styles.charCount}>{prompt.length} chars</span>
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="aiResponse">
                    <span className={styles.labelDot} style={{ background: '#f87171' }} />
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
                {textLoading
                  ? <><span className={styles.spinner} />Analysing with Gemini 2.5 Flash...</>
                  : '🔍 Analyse for Bias'}
              </button>
            </div>
          </>
        )}

        {/* How it works */}
        {!auditResult && (
          <div className={styles.howItWorks}>
            <h3>How FairLens works</h3>
            <div className={styles.steps}>
              {(mode === 'dataset' ? [
                { icon: '📁', title: 'Upload', desc: 'Upload any CSV dataset' },
                { icon: '⚙️', title: 'Configure', desc: 'Select target, sensitive columns & model' },
                { icon: '🧪', title: 'Train', desc: 'Model trained, fairness measured' },
                { icon: '⚖️', title: 'Mitigate', desc: 'Bias fixed, debiased files ready to download' },
              ] : [
                { icon: '📋', title: 'Paste', desc: 'Enter any AI prompt and its response' },
                { icon: '🤖', title: 'Analyse', desc: 'Gemini 2.5 Flash scans for hidden bias' },
                { icon: '📊', title: 'Score', desc: 'Get a bias score across 6 dimensions' },
                { icon: '✅', title: 'Fix', desc: 'Receive an unbiased rewrite instantly' },
              ]).map(s => (
                <div key={s.title} className={styles.stepCard}>
                  <div className={styles.stepCardIcon}>{s.icon}</div>
                  <strong>{s.title}</strong>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        Built by Team Triple A · Solution Challenge 2026 · Powered by Gemini 2.5 Flash
      </footer>

      {showTextHistory && <HistoryPanel onClose={() => setShowTextHistory(false)} />}
      {showAuditHistory && (
        <AuditHistoryPanel
          onClose={() => setShowAuditHistory(false)}
          onOpen={handleAuditHistoryOpen}
        />
      )}
    </div>
  )
}
