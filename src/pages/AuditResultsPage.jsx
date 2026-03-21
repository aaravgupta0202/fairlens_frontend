import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { decodeShareData } from '../api/share'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, Legend,
} from 'recharts'
import { sendChatMessage } from '../api/audit'
import { buildShareUrl } from '../api/share'
import { exportAuditToPdf } from '../api/exportPdf'
import ThemeToggle from '../components/ThemeToggle'
import styles from './AuditResultsPage.module.css'

// ── Gauge ────────────────────────────────────────────────────────────────────
function BiasGauge({ score }) {
  const clamp = Math.max(0, Math.min(100, score))
  const angle = -135 + (clamp / 100) * 270
  const color = clamp < 30 ? '#4ade80' : clamp < 60 ? '#fbbf24' : clamp < 80 ? '#f97316' : '#f87171'

  return (
    <div className={styles.gaugeWrap}>
      <svg viewBox="0 0 200 120" className={styles.gaugeSvg}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="33%" stopColor="#fbbf24" />
            <stop offset="66%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
        </defs>
        <path d="M 20 110 A 80 80 0 1 1 180 110" fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round" />
        <path d="M 20 110 A 80 80 0 1 1 180 110" fill="none" stroke="url(#gaugeGrad)"
          strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${clamp * 2.51} 251`} />
        <g transform={`rotate(${angle}, 100, 110)`}>
          <line x1="100" y1="110" x2="100" y2="40" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="110" r="6" fill={color} />
        </g>
        <text x="100" y="98" textAnchor="middle" fill={color} fontSize="24" fontWeight="700">{clamp}</text>
        <text x="100" y="115" textAnchor="middle" fill="var(--text-muted)" fontSize="9">BIAS SCORE</text>
      </svg>
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ metric }) {
  const pct = metric.threshold_direction === 'above'
    ? Math.min((metric.value / metric.threshold) * 100, 100)
    : Math.min((metric.value / (metric.threshold * 2)) * 100, 100)
  const barColor = metric.flagged ? 'var(--red)' : 'var(--green)'

  return (
    <div className={`${styles.metricCard} ${metric.flagged ? styles.metricFlagged : styles.metricOk}`}>
      <div className={styles.metricHeader}>
        <span className={styles.metricName}>{metric.name}</span>
        <span className={`${styles.metricBadge} ${metric.flagged ? styles.badgeRed : styles.badgeGreen}`}>
          {metric.flagged ? '⚠ Flagged' : '✓ OK'}
        </span>
      </div>
      <div className={styles.metricValue}>{metric.value.toFixed(4)}</div>
      <div className={styles.metricBar}>
        <div className={styles.metricBarTrack}>
          <div className={styles.metricBarFill} style={{ width: `${pct}%`, background: barColor }} />
          {metric.threshold && (
            <div className={styles.metricThresholdLine}
              style={{ left: metric.threshold_direction === 'above' ? '80%' : `${(metric.threshold / (metric.threshold * 2)) * 100}%` }} />
          )}
        </div>
      </div>
      {metric.threshold && (
        <div className={styles.metricThresholdLabel}>
          Threshold: {metric.threshold_direction === 'above' ? '≥' : '<'} {metric.threshold}
        </div>
      )}
      <p className={styles.metricInterpret}>{metric.interpretation}</p>
    </div>
  )
}

// ── Chat panel ────────────────────────────────────────────────────────────────
function ChatPanel({ datasetDescription, auditSummary }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "I've completed the fairness audit. Ask me anything about the findings — how to lower bias, what specific metrics mean, what to fix first, or how this affects your students/employees."
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend() {
    const msg = input.trim()
    if (!msg || loading) return
    setInput('')
    const newMessages = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const conversationHistory = newMessages.slice(1) // exclude initial assistant greeting
      const reply = await sendChatMessage({
        datasetDescription,
        auditSummary,
        conversation: conversationHistory.slice(0, -1), // exclude current message
        message: msg,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderLeft}>
          <div className={styles.chatDot} />
          <span>Ask FairLens AI</span>
        </div>
        <span className={styles.chatSubtitle}>Follow-up questions about your audit</span>
      </div>
      <div className={styles.chatMessages}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.chatBubble} ${m.role === 'user' ? styles.chatUser : styles.chatAssistant}`}>
            {m.role === 'assistant' && <div className={styles.chatAvatar}>FL</div>}
            <div className={styles.chatText}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className={`${styles.chatBubble} ${styles.chatAssistant}`}>
            <div className={styles.chatAvatar}>FL</div>
            <div className={styles.chatTyping}>
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="e.g. How do I reduce bias in Maths grades?"
          disabled={loading}
        />
        <button className={styles.chatSend} onClick={handleSend} disabled={loading || !input.trim()}>
          {loading ? '...' : '↑'}
        </button>
      </div>
      <div className={styles.chatSuggestions}>
        {['How to lower bias?', 'Which teacher is most biased?', 'What do these metrics mean?'].map(s => (
          <button key={s} className={styles.chatSugg} onClick={() => { setInput(s) }}>{s}</button>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuditResultsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [shareState, setShareState] = useState('idle')
  const [exporting, setExporting] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const [searchParams] = useSearchParams()
  const stateData = location.state
  let result, datasetDescription

  if (stateData?.result) {
    result = stateData.result
    datasetDescription = stateData.description || ''
  } else if (searchParams.get('shared')) {
    // Shared URL
    const decoded = decodeShareData(searchParams.get('shared'))
    if (decoded?.result) { result = decoded.result; datasetDescription = decoded.description || '' }
  } else {
    // Try sessionStorage recovery
    try {
      const saved = sessionStorage.getItem('auditResult')
      if (saved) {
        const parsed = JSON.parse(saved)
        result = parsed.result
        datasetDescription = parsed.description || ''
      }
    } catch {}
  }

  // Save to sessionStorage on load
  useEffect(() => {
    if (result) {
      sessionStorage.setItem('auditResult', JSON.stringify({ result, description: datasetDescription }))
    }
  }, [])

  if (!result) {
    return (
      <div className={styles.noResult}>
        <h2>No audit result found</h2>
        <button onClick={() => navigate('/')} className={styles.backBtn}>← Back to Home</button>
      </div>
    )
  }

  const {
    bias_score, bias_level, risk_label, bias_detected,
    total_rows, total_students, columns,
    sensitive_column, target_column,
    metrics, group_stats, subject_analysis,
    summary, key_findings, recommendations,
    audit_summary_json,
  } = result

  const flaggedCount = metrics.filter(m => m.flagged).length
  const biasColor = bias_score < 30 ? 'var(--green)' : bias_score < 60 ? 'var(--amber)' : bias_score < 80 ? '#f97316' : 'var(--red)'

  // Chart data
  const groupChartData = group_stats.map(g => ({
    name: g.group,
    'Pass Rate': Math.round(g.pass_rate * 100),
    'Avg Marks': g.avg_marks || 0,
  }))

  const subjectChartData = (subject_analysis || []).map(s => ({
    name: s.subject,
    'Pass Rate': Math.round(s.pass_rate * 100),
    'Avg Marks': s.avg_marks,
    flagged: s.flagged,
  }))

  const radarData = (group_stats[0]?.avg_by_subject)
    ? Object.keys(group_stats[0].avg_by_subject).map(sub => {
        const entry = { subject: sub }
        group_stats.forEach(g => {
          entry[g.group] = g.avg_by_subject[sub] || 0
        })
        return entry
      })
    : []

  const COLORS = ['var(--primary)', 'var(--accent)', '#60a5fa', '#a78bfa', '#f472b6']

  async function handleShare() {
    const url = buildShareUrl({ type: 'audit', result, targetColumn: target_column, sensitiveColumn: sensitive_column, description: datasetDescription })
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2500)
    } catch { setShareState('error') }
  }

  async function handleExportPdf() {
    setExporting(true)
    try { await exportAuditToPdf(result, target_column, sensitive_column) }
    finally { setExporting(false) }
  }

  const tabs = ['overview', 'metrics', 'groups', 'subjects', 'insights']
  const tabLabels = { overview: '🔍 Overview', metrics: '📐 Metrics', groups: '👥 Groups', subjects: '📚 Subjects', insights: '💡 Insights' }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>← Back</button>
          <div className={styles.logoArea}>
            <img src="/fairlens_logo.png" alt="FairLens" className={styles.logoImg} />
          </div>
        </div>
        <div className={styles.headerRight}>
          <ThemeToggle />
          <button className={styles.actionBtn} onClick={handleShare}>
            {shareState === 'copied' ? '✓ Copied!' : '🔗 Share'}
          </button>
          <button className={styles.actionBtn} onClick={handleExportPdf} disabled={exporting}>
            {exporting ? 'Exporting...' : '📄 Export PDF'}
          </button>
          <button className={`${styles.chatToggleBtn} ${showChat ? styles.chatToggleActive : ''}`}
            onClick={() => setShowChat(p => !p)}>
            💬 Ask AI
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* ── Main content ── */}
        <div className={`${styles.mainContent} ${showChat ? styles.mainContentNarrow : ''}`}>

          {/* ── Hero section ── */}
          <div className={styles.heroSection}>
            <div className={styles.heroLeft}>
              <div className={styles.riskBadge} style={{ background: `${biasColor}20`, color: biasColor, borderColor: `${biasColor}40` }}>
                {risk_label}
              </div>
              <h1 className={styles.heroTitle}>Fairness Audit Report</h1>
              <p className={styles.heroMeta}>
                {total_rows} rows · {columns.length} columns
                {sensitive_column && <> · Sensitive: <strong>{sensitive_column}</strong></>}
                {target_column && <> · Target: <strong>{target_column}</strong></>}
              </p>
              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNum} style={{ color: biasColor }}>{bias_score}</span>
                  <span className={styles.heroStatLabel}>Bias Score</span>
                </div>
                <div className={styles.heroStatDivider} />
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNum} style={{ color: flaggedCount > 0 ? 'var(--red)' : 'var(--green)' }}>{flaggedCount}</span>
                  <span className={styles.heroStatLabel}>Metrics Flagged</span>
                </div>
                <div className={styles.heroStatDivider} />
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNum}>{group_stats.length}</span>
                  <span className={styles.heroStatLabel}>Groups Compared</span>
                </div>
              </div>
            </div>
            <BiasGauge score={bias_score} />
          </div>

          {/* ── Tabs ── */}
          <div className={styles.tabs}>
            {tabs.map(t => (
              <button key={t} className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(t)}>
                {tabLabels[t]}
              </button>
            ))}
          </div>

          {/* ── Overview tab ── */}
          {activeTab === 'overview' && (
            <div className={styles.tabContent}>
              {/* Summary */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>📋 Summary</h3>
                <div className={styles.summaryText}>
                  {summary.split('\n').filter(Boolean).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>

              {/* Quick metrics row */}
              <div className={styles.quickMetrics}>
                {metrics.slice(0, 3).map(m => (
                  <div key={m.key} className={`${styles.quickMetric} ${m.flagged ? styles.quickMetricFlagged : ''}`}>
                    <div className={styles.quickMetricName}>{m.name}</div>
                    <div className={styles.quickMetricVal} style={{ color: m.flagged ? 'var(--red)' : 'var(--green)' }}>
                      {m.value.toFixed(3)}
                    </div>
                    <div className={styles.quickMetricStatus}>{m.flagged ? '⚠ Flagged' : '✓ OK'}</div>
                  </div>
                ))}
              </div>

              {/* Group pass rate chart */}
              {groupChartData.length > 0 && (
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>👥 Pass Rate by Group</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={groupChartData} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 13 }} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} unit="%" domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                        labelStyle={{ color: 'var(--text)' }} itemStyle={{ color: 'var(--text-muted)' }} />
                      <Bar dataKey="Pass Rate" radius={[6, 6, 0, 0]}>
                        {groupChartData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── Metrics tab ── */}
          {activeTab === 'metrics' && (
            <div className={styles.tabContent}>
              <div className={styles.metricsGrid}>
                {metrics.map(m => <MetricCard key={m.key} metric={m} />)}
              </div>
            </div>
          )}

          {/* ── Groups tab ── */}
          {activeTab === 'groups' && (
            <div className={styles.tabContent}>
              {/* Group stats table */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>📊 Group Statistics</h3>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Group</th>
                        <th>Count</th>
                        {group_stats[0]?.avg_marks != null && <th>Avg Marks</th>}
                        <th>Pass</th>
                        <th>Fail</th>
                        <th>Pass Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group_stats.map(g => {
                        const maxRate = Math.max(...group_stats.map(x => x.pass_rate))
                        const isMax = g.pass_rate === maxRate
                        const isMin = g.pass_rate === Math.min(...group_stats.map(x => x.pass_rate))
                        return (
                          <tr key={g.group}>
                            <td><strong>{g.group}</strong></td>
                            <td>{g.count}</td>
                            {group_stats[0]?.avg_marks != null && <td>{g.avg_marks?.toFixed(1)}</td>}
                            <td style={{ color: 'var(--green)' }}>{g.pass_count}</td>
                            <td style={{ color: 'var(--red)' }}>{g.fail_count}</td>
                            <td>
                              <span className={`${styles.ratePill} ${isMax ? styles.rateHigh : isMin ? styles.rateLow : styles.rateMid}`}>
                                {(g.pass_rate * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Radar chart if per-subject data */}
              {radarData.length > 0 && (
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>🎯 Subject Performance by Group</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                      {group_stats.map((g, i) => (
                        <Radar key={g.group} name={g.group} dataKey={g.group}
                          stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
                      ))}
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Avg marks by group bar chart */}
              {group_stats[0]?.avg_by_subject && (
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>📈 Average Marks by Subject & Group</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={radarData} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                      <Legend />
                      {group_stats.map((g, i) => (
                        <Bar key={g.group} dataKey={g.group} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── Subjects tab ── */}
          {activeTab === 'subjects' && (
            <div className={styles.tabContent}>
              {subject_analysis && subject_analysis.length > 0 ? (
                <>
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>📚 Subject-Level Analysis</h3>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th>Teacher</th>
                            <th>Avg Marks</th>
                            <th>Pass Rate</th>
                            <th>Status</th>
                            <th>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subject_analysis.map(s => (
                            <tr key={s.subject} className={s.flagged ? styles.rowFlagged : ''}>
                              <td><strong>{s.subject}</strong></td>
                              <td>{s.teacher || '—'}</td>
                              <td>{s.avg_marks.toFixed(1)}</td>
                              <td>{(s.pass_rate * 100).toFixed(1)}%</td>
                              <td>
                                <span className={`${styles.statusPill} ${s.flagged ? styles.statusFlagged : styles.statusOk}`}>
                                  {s.flagged ? '⚠ Biased' : '✓ Fair'}
                                </span>
                              </td>
                              <td className={styles.biasNote}>{s.bias_note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {subjectChartData.length > 0 && (
                    <div className={styles.card}>
                      <h3 className={styles.cardTitle}>📊 Pass Rate by Subject</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={subjectChartData} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 13 }} />
                          <YAxis unit="%" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                          <Bar dataKey="Pass Rate" radius={[6, 6, 0, 0]}>
                            {subjectChartData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.flagged ? 'var(--red)' : 'var(--green)'} fillOpacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyState}>
                  <p>No subject-level data found in this dataset.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Insights tab ── */}
          {activeTab === 'insights' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>🔑 Key Findings</h3>
                <div className={styles.findingsList}>
                  {key_findings.map((f, i) => (
                    <div key={i} className={styles.findingItem}>
                      <div className={styles.findingNum}>{i + 1}</div>
                      <p>{f}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>✅ Recommendations</h3>
                <div className={styles.recsList}>
                  {recommendations.map((r, i) => (
                    <div key={i} className={styles.recItem}>
                      <span className={styles.recIcon}>→</span>
                      <p>{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Chat panel ── */}
        {showChat && (
          <div className={styles.chatSidebar}>
            <ChatPanel datasetDescription={datasetDescription} auditSummary={audit_summary_json} />
          </div>
        )}
      </div>
    </div>
  )
}
