import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { decodeShareData, buildShareUrl } from '../api/share'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import { sendChatMessage } from '../api/audit'
import { exportAuditToPdf } from '../api/exportPdf'
import BiasGauge from '../components/BiasGauge'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import styles from './AuditResultsPage.module.css'

const COLORS = ['var(--primary)', 'var(--accent)', '#60a5fa', '#a78bfa', '#f472b6', '#34d399']
const tt = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 },
  labelStyle:   { color: 'var(--text)' },
}

/* ── Metric Card ─────────────────────────────────────────────────────────── */
function MetricCard({ metric }) {
  const isAbove  = metric.threshold_direction === 'above'
  const pct      = isAbove
    ? Math.min((metric.value / (metric.threshold || 1)) * 100, 100)
    : Math.min((metric.value / ((metric.threshold || 1) * 2)) * 100, 100)
  const barColor = metric.flagged ? 'var(--red)' : 'var(--green)'
  return (
    <div className={`${styles.metricCard} ${metric.flagged ? styles.metricFlagged : styles.metricOk}`}>
      <div className={styles.metricHeader}>
        <span className={styles.metricName}>{metric.name}</span>
        <span className={`${styles.badge} ${metric.flagged ? styles.badgeRed : styles.badgeGreen}`}>
          {metric.flagged ? 'Flagged' : 'OK'}
        </span>
      </div>
      <div className={styles.metricValue}>{metric.value.toFixed(4)}</div>
      <div className={styles.metricBarTrack}>
        <div className={styles.metricBarFill} style={{ width: `${pct}%`, background: barColor }} />
        {metric.threshold != null && (
          <div className={styles.metricThresholdLine} style={{ left: isAbove ? '80%' : '50%' }} />
        )}
      </div>
      {metric.threshold != null && (
        <div className={styles.metricThresholdLabel}>
          Threshold: {isAbove ? '≥' : '<'}{metric.threshold}
        </div>
      )}
      {metric.interpretation && <p className={styles.metricInterpret}>{metric.interpretation}</p>}
    </div>
  )
}

/* ── Simulation Card ──────────────────────────────────────────────────────── */
function SimulationCard({ simulation }) {
  const improvement = simulation.improvement || 0
  const before = simulation.before_score || 0
  const after  = simulation.after_score  || 0
  return (
    <div className={styles.simCard}>
      <div className={styles.simHeader}>
        <span className={styles.simTitle}><Icon name='simulation' size={15}/> Bias Fix Simulation</span>
        <span className={styles.simBadge}>↓ {improvement} pts</span>
      </div>
      {simulation.strategy && <p className={styles.simStrategy}>{simulation.strategy}</p>}
      <div className={styles.simScores}>
        <div className={styles.simScore}>
          <div className={styles.simScoreNum} style={{ color: 'var(--red)' }}>{before}</div>
          <div className={styles.simScoreLabel}>Before</div>
        </div>
        <div className={styles.simArrow}>→</div>
        <div className={styles.simScore}>
          <div className={styles.simScoreNum} style={{ color: 'var(--green)' }}>{after}</div>
          <div className={styles.simScoreLabel}>After</div>
        </div>
        <div className={styles.simDpd}>
          DPD: <strong>{simulation.before_dpd?.toFixed(4)}</strong>
          {' → '}
          <strong style={{ color: 'var(--green)' }}>{simulation.after_dpd?.toFixed(4)}</strong>
        </div>
      </div>
      {simulation.description && <p className={styles.simDesc}>{simulation.description}</p>}
    </div>
  )
}

/* ── Bias Origin Card ─────────────────────────────────────────────────────── */
function BiasOriginCard({ biasOrigin, rootCauses }) {
  return (
    <div className={styles.originCard}>
      <h3 className={styles.cardTitle}><Icon name='origin' size={15}/> Bias Origin</h3>
      <div className={styles.originGrid}>
        <div className={styles.originItem}>
          <span className={styles.originLabel}>Most Affected</span>
          <span className={styles.originValue} style={{ color: 'var(--red)' }}>
            {biasOrigin.most_affected_group}
          </span>
        </div>
        <div className={styles.originItem}>
          <span className={styles.originLabel}>Worst Metric</span>
          <span className={styles.originValue}>{biasOrigin.worst_metric}</span>
        </div>
        {biasOrigin.most_biased_category && (
          <div className={styles.originItem} style={{ gridColumn: '1 / -1' }}>
            <span className={styles.originLabel}>Most Biased Sub-Category</span>
            <span className={styles.originValue}>{biasOrigin.most_biased_category}</span>
          </div>
        )}
      </div>
      {rootCauses?.length > 0 && (
        <div className={styles.rootCauses}>
          <p className={styles.rcTitle}>Root Causes</p>
          {rootCauses.map((rc, i) => (
            <div key={i} className={styles.rcItem}>
              <span className={styles.rcDot} />
              <p>{rc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Chat Panel ───────────────────────────────────────────────────────────── */
function ChatPanel({ datasetDescription, auditSummary }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "I've completed the fairness audit. Ask me anything — how to reduce bias, what a metric means, who is most affected, or what to do next.",
  }])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const suggestions = ['How to reduce bias?', 'What does DPD mean?', 'Who is most affected?', 'What should I fix first?']

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend() {
    const msg = input.trim()
    if (!msg || loading) return
    setInput('')
    const newMsgs = [...messages, { role: 'user', content: msg }]
    setMessages(newMsgs)
    setLoading(true)
    try {
      const reply = await sendChatMessage({
        datasetDescription, auditSummary,
        conversation: newMsgs.slice(1, -1),
        message: msg,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderLeft}>
          <div className={styles.chatDot} />
          <span>Ask FairLens AI</span>
        </div>
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
            <div className={styles.chatTyping}><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className={styles.chatSuggestions}>
        {suggestions.map(s => (
          <button key={s} className={styles.chatSugg} onClick={() => setInput(s)}>{s}</button>
        ))}
      </div>
      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about the audit findings…"
          disabled={loading}
        />
        <button className={styles.chatSend} onClick={handleSend} disabled={loading || !input.trim()}>
          {loading ? '…' : '↑'}
        </button>
      </div>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function AuditResultsPage() {
  const location       = useLocation()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab]   = useState('overview')
  const [shareState, setShareState] = useState('idle')
  const [exporting, setExporting]   = useState(false)

  let result, datasetDescription
  if (location.state?.result) {
    result             = location.state.result
    datasetDescription = location.state.description || ''
  } else if (searchParams.get('shared')) {
    const decoded = decodeShareData(searchParams.get('shared'))
    if (decoded?.result) { result = decoded.result; datasetDescription = decoded.description || '' }
  } else {
    try {
      const saved = JSON.parse(sessionStorage.getItem('auditResult') || 'null')
      if (saved) { result = saved.result; datasetDescription = saved.description || '' }
    } catch {}
  }

  useEffect(() => {
    if (result) sessionStorage.setItem('auditResult', JSON.stringify({ result, description: datasetDescription }))
  }, [])

  if (!result) return (
    <div className={styles.noResult}>
      <h2>No audit result found</h2>
      <button className={styles.backBtnStandalone} onClick={() => navigate('/')}>← Back to Home</button>
    </div>
  )

  const {
    bias_score, bias_level,
    total_rows, columns, target_column, sensitive_column,
    positive_class, primary_numeric_column, category_column,
    metrics, group_stats, category_analysis, root_causes,
    bias_origin, simulation,
    summary, key_findings, recommendations, audit_summary_json,
  } = result

  const flaggedCount  = metrics.filter(m => m.flagged).length
  const biasColor     = bias_score < 20 ? 'var(--green)' : bias_score < 45 ? 'var(--amber)' : bias_score < 70 ? '#f97316' : 'var(--red)'
  const positiveLabel = positive_class || 'Positive'

  const groupChartData = group_stats.map(g => ({
    name: g.group,
    [positiveLabel + ' Rate']: Math.round(g.selection_rate * 100),
    ...(g.avg_numeric != null ? { [`Avg ${primary_numeric_column || 'Score'}`]: g.avg_numeric } : {}),
  }))

  const radarData = group_stats[0]?.avg_by_category
    ? Object.keys(group_stats[0].avg_by_category).map(cat => {
        const entry = { category: cat }
        group_stats.forEach(g => { entry[g.group] = g.avg_by_category?.[cat] || 0 })
        return entry
      })
    : []

  const eqOddsData = group_stats.filter(g => g.tpr != null).map(g => ({
    name: g.group,
    TPR: Math.round((g.tpr || 0) * 100),
    FPR: Math.round((g.fpr || 0) * 100),
  }))

  async function handleShare() {
    const url = buildShareUrl({ type: 'audit', result, description: datasetDescription })
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

  const tabs      = ['overview', 'metrics', 'groups', 'categories', 'insights', 'ask']
  const tabLabels = {
    overview:   'Overview',
    metrics:    'Metrics',
    groups:     'Groups',
    categories: category_column || 'Categories',
    insights:   'Insights',
    ask:        'Ask AI',
  }

  return (
    <div className={styles.page}>

      <PageHeader
        onBack={() => navigate('/')}
        actions={[
          { label: shareState === 'copied' ? 'Copied!' : 'Share', onClick: handleShare, success: shareState === 'copied' },
          { label: exporting ? 'Exporting…' : 'PDF', onClick: handleExportPdf, disabled: exporting },
        ]}
      />

      <div className={styles.mainContent}>

        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.heroGauge}>
            <BiasGauge score={bias_score} level={bias_level} />
          </div>
          <div className={styles.heroRight}>
            <div className={styles.riskBadge}
              style={{ background: `${biasColor}1e`, color: biasColor, borderColor: `${biasColor}44` }}>
              {bias_level} Bias
            </div>
            <h1 className={styles.heroTitle}>Fairness Audit Report</h1>
            <p className={styles.heroMeta}>
              {total_rows} rows · {columns.length} columns
              {sensitive_column && <> · Sensitive: <strong>{sensitive_column}</strong></>}
              {target_column    && <> · Target: <strong>{target_column}</strong></>}
              {positive_class   && <> · Positive: <strong>{positive_class}</strong></>}
            </p>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum} style={{ color: flaggedCount > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {flaggedCount}
                </span>
                <span className={styles.heroStatLabel}>Flagged</span>
              </div>
              <div className={styles.heroStatDiv} />
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum}>{group_stats.length}</span>
                <span className={styles.heroStatLabel}>Groups</span>
              </div>
              {simulation && <>
                <div className={styles.heroStatDiv} />
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNum} style={{ color: 'var(--green)' }}>−{simulation.improvement}</span>
                  <span className={styles.heroStatLabel}>Fix Potential</span>
                </div>
              </>}
              {category_analysis?.length > 0 && <>
                <div className={styles.heroStatDiv} />
                <div className={styles.heroStat}>
                  <span className={styles.heroStatNum}>{category_analysis.filter(c => c.flagged).length}</span>
                  <span className={styles.heroStatLabel}>{category_column ? `${category_column} Flagged` : 'Sub-cats'}</span>
                </div>
              </>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {tabs.map(t => (
            <button key={t}
              className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''} ${t === 'ask' ? styles.tabAsk : ''}`}
              onClick={() => setActiveTab(t)}>
              <>{t === 'overview' && <Icon name='overview' size={13}/>}{t === 'metrics' && <Icon name='metrics' size={13}/>}{t === 'groups' && <Icon name='groups' size={13}/>}{t === 'categories' && <Icon name='categories' size={13}/>}{t === 'insights' && <Icon name='insights' size={13}/>}{t === 'ask' && <Icon name='chat' size={13}/>} {tabLabels[t]}</>
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className={styles.tabContent}>
            {summary && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}><Icon name='summary' size={15}/> Summary</h3>
                <div className={styles.summaryText}>
                  {summary.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            )}
            <div className={styles.quickMetrics}>
              {metrics.slice(0, 4).map(m => (
                <div key={m.key} className={`${styles.quickMetric} ${m.flagged ? styles.qmFlagged : ''}`}>
                  <div className={styles.qmName}>{m.name}</div>
                  <div className={styles.qmVal} style={{ color: m.flagged ? 'var(--red)' : 'var(--green)' }}>
                    {m.value.toFixed(3)}
                  </div>
                  <div className={styles.qmStatus}>{m.flagged ? 'Flagged' : 'OK'}</div>
                </div>
              ))}
            </div>
            <div className={styles.twoCol}>
              {bias_origin && <BiasOriginCard biasOrigin={bias_origin} rootCauses={root_causes} />}
              {simulation  && <SimulationCard simulation={simulation} />}
            </div>
            {groupChartData.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}><Icon name='chart' size={15}/> {positiveLabel} Rate by {sensitive_column || 'Group'}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={groupChartData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} unit="%" domain={[0, 100]} />
                    <Tooltip {...tt} />
                    <Bar dataKey={positiveLabel + ' Rate'} radius={[6, 6, 0, 0]}>
                      {groupChartData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Metrics */}
        {activeTab === 'metrics' && (
          <div className={styles.tabContent}>
            <div className={styles.metricsGrid}>
              {metrics.map(m => <MetricCard key={m.key} metric={m} />)}
            </div>
          </div>
        )}

        {/* Groups */}
        {activeTab === 'groups' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}><Icon name='chart' size={15}/> Group Statistics — {sensitive_column}</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Group</th><th>Count</th><th>{positiveLabel}</th><th>Negative</th>
                      <th>{positiveLabel} Rate</th>
                      {group_stats[0]?.avg_numeric != null && <th>Avg {primary_numeric_column}</th>}
                      {group_stats[0]?.tpr != null && <th>TPR</th>}
                      {group_stats[0]?.fpr != null && <th>FPR</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group_stats.map(g => {
                      const mx = Math.max(...group_stats.map(x => x.selection_rate))
                      const mn = Math.min(...group_stats.map(x => x.selection_rate))
                      return (
                        <tr key={g.group}>
                          <td><strong>{g.group}</strong></td>
                          <td>{g.count}</td>
                          <td style={{ color: 'var(--green)' }}>{g.positive_count}</td>
                          <td style={{ color: 'var(--red)' }}>{g.negative_count}</td>
                          <td>
                            <span className={`${styles.ratePill} ${g.selection_rate === mx ? styles.rateHigh : g.selection_rate === mn ? styles.rateLow : styles.rateMid}`}>
                              {(g.selection_rate * 100).toFixed(1)}%
                            </span>
                          </td>
                          {g.avg_numeric != null && <td>{g.avg_numeric.toFixed(1)}</td>}
                          {g.tpr != null && <td>{(g.tpr * 100).toFixed(1)}%</td>}
                          {g.fpr != null && <td>{(g.fpr * 100).toFixed(1)}%</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {eqOddsData.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}><Icon name='equalizer' size={15}/> Equalized Odds — TPR vs FPR</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={eqOddsData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <Tooltip {...tt} /><Legend />
                    <Bar dataKey="TPR" fill="var(--green)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="FPR" fill="var(--red)"   radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {radarData.length > 0 && (
              <>
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}><Icon name='target' size={15}/> Avg {primary_numeric_column} by Group × {category_column}</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="category" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      {group_stats.map((g, i) => (
                        <Radar key={g.group} name={g.group} dataKey={g.group}
                          stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
                      ))}
                      <Tooltip {...tt} /><Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}><Icon name='chartLine' size={15}/> Avg {primary_numeric_column} by {category_column} & Group</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={radarData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="category" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                      <Tooltip {...tt} /><Legend />
                      {group_stats.map((g, i) => (
                        <Bar key={g.group} dataKey={g.group} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {/* Categories */}
        {activeTab === 'categories' && (
          <div className={styles.tabContent}>
            {category_analysis && category_analysis.length > 0 ? (
              <>
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}><Icon name='categories' size={15}/> {category_column} Analysis</h3>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{category_column}</th>
                          {category_analysis[0]?.avg_numeric != null && <th>Avg {primary_numeric_column}</th>}
                          <th>{positiveLabel} Rate</th><th>Group Gap</th><th>Status</th><th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {category_analysis.map(ca => (
                          <tr key={ca.category_value} className={ca.flagged ? styles.rowFlagged : ''}>
                            <td><strong>{ca.category_value}</strong></td>
                            {ca.avg_numeric != null && <td>{ca.avg_numeric.toFixed(1)}</td>}
                            <td>{(ca.selection_rate * 100).toFixed(1)}%</td>
                            <td style={{ color: ca.flagged ? 'var(--red)' : 'var(--text-muted)' }}>
                              {(ca.group_gap * 100).toFixed(1)}%
                            </td>
                            <td>
                              <span className={`${styles.badge} ${ca.flagged ? styles.badgeRed : styles.badgeGreen}`}>
                                {ca.flagged ? 'Biased' : 'Fair'}
                              </span>
                            </td>
                            <td className={styles.biasNote}>{ca.bias_note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}><Icon name='chart' size={15}/> {positiveLabel} Rate by {category_column}</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={category_analysis.map(ca => ({
                      name: ca.category_value,
                      Rate: Math.round(ca.selection_rate * 100),
                    }))} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                      <YAxis unit="%" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                      <Tooltip {...tt} />
                      <Bar dataKey="Rate" radius={[6, 6, 0, 0]}>
                        {category_analysis.map((ca, i) => (
                          <Cell key={i} fill={ca.flagged ? 'var(--red)' : COLORS[i % COLORS.length]} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <p>No sub-category column detected in this dataset.</p>
                <p>This applies when a column like Subject, Department, or Location exists.</p>
              </div>
            )}
          </div>
        )}

        {/* Insights */}
        {activeTab === 'insights' && (
          <div className={styles.tabContent}>
            {key_findings?.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}><Icon name='findings' size={15}/> Key Findings</h3>
                <div className={styles.findingsList}>
                  {key_findings.map((f, i) => (
                    <div key={i} className={styles.findingItem}>
                      <div className={styles.findingNum}>{i + 1}</div>
                      <p>{f}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {recommendations?.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}><Icon name='recommendations' size={15}/> Recommendations</h3>
                <div className={styles.recsList}>
                  {recommendations.map((r, i) => (
                    <div key={i} className={styles.recItem}>
                      <span className={styles.recIcon}>→</span>
                      <p>{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {simulation && <SimulationCard simulation={simulation} />}
          </div>
        )}

        {/* Ask AI */}
        {activeTab === 'ask' && (
          <div className={styles.tabContent}>
            <ChatPanel datasetDescription={datasetDescription} auditSummary={audit_summary_json} />
          </div>
        )}

      </div>
    </div>
  )
}
