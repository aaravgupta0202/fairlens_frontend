import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { decodeShareData, buildShareUrl } from '../api/share'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, LabelList, Legend,
} from 'recharts'
import { sendChatMessage } from '../api/audit'
import { exportAuditToPdf } from '../api/exportPdf'
import BiasGauge from '../components/BiasGauge'
import ThemeToggle from '../components/ThemeToggle'
import Icon from '../components/Icon'
import styles from './AuditResultsPage.module.css'

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ metric }) {
  const val = metric.value ?? 0
  const thr = metric.threshold ?? 1
  const pct = metric.threshold_direction === 'above'
    ? Math.min((val / thr) * 100, 100)
    : Math.min((val / (thr * 2)) * 100, 100)
  return (
    <div className={`${styles.metricCard} ${metric.flagged ? styles.metricFlagged : styles.metricOk}`}>
      <div className={styles.metricHeader}>
        <span className={styles.metricName}>{metric.name}</span>
        <span className={`${styles.badge} ${metric.flagged ? styles.badgeRed : styles.badgeGreen}`}>
          {metric.flagged ? 'Flagged' : 'OK'}
        </span>
      </div>
      <div className={styles.metricValue}>{val.toFixed(4)}</div>
      <div className={styles.metricTrack}>
        <div className={styles.metricFill} style={{ width: `${pct}%`, background: metric.flagged ? 'var(--red)' : 'var(--green)' }}/>
        {metric.threshold != null && (
          <div className={styles.metricThresh} style={{ left: metric.threshold_direction === 'above' ? '80%' : '50%' }}/>
        )}
      </div>
      {metric.threshold != null && (
        <div className={styles.metricThreshLabel}>
          Threshold: {metric.threshold_direction === 'above' ? '>=' : '<'}{metric.threshold}
        </div>
      )}
      {metric.interpretation && <p className={styles.metricInterp}>{metric.interpretation}</p>}
    </div>
  )
}

// ── Chat Panel ────────────────────────────────────────────────────────────────
function ChatPanel({ datasetDescription, auditSummary }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Audit complete. Ask me anything — why bias exists, what metrics mean, or how to reduce it."
  }])
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
      const reply = await sendChatMessage({
        datasetDescription, auditSummary,
        conversation: newMessages.slice(1, -1),
        message: msg,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderLeft}>
          <div className={styles.chatDot}/>
          <span>Ask FairLens AI</span>
        </div>
      </div>
      <div className={styles.chatMessages}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.chatBubble} ${m.role === 'user' ? styles.chatUser : styles.chatBot}`}>
            {m.role === 'assistant' && <div className={styles.chatAvatar}>FL</div>}
            <div className={styles.chatText}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className={`${styles.chatBubble} ${styles.chatBot}`}>
            <div className={styles.chatAvatar}>FL</div>
            <div className={styles.chatTyping}><span/><span/><span/></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div className={styles.chatSuggestions}>
        {['Why does bias exist?', 'What is DPD?', 'How to fix this?', 'Which group is most affected?'].map(s => (
          <button key={s} className={styles.chatSugg} onClick={() => setInput(s)}>{s}</button>
        ))}
      </div>
      <div className={styles.chatInputRow}>
        <input className={styles.chatInput} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about these results..." disabled={loading}/>
        <button className={styles.chatSend} onClick={handleSend} disabled={loading || !input.trim()}>
          <Icon name="send" size={14}/>
        </button>
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'summary',      label: 'Summary',       icon: 'overview'  },
  { id: 'diagnosis',    label: 'Why Bias',       icon: 'findings'  },
  { id: 'evidence',     label: 'Evidence',       icon: 'chart'     },
  { id: 'fix',          label: 'Fix Bias',       icon: 'simulation'},
  { id: 'insights',     label: 'AI Insights',    icon: 'insights'  },
  { id: 'transparency', label: 'Transparency',   icon: 'target'    },
  { id: 'ask',          label: 'Ask AI',         icon: 'chat'      },
]

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AuditResultsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('summary')
  const [shareState, setShareState] = useState('idle')
  const [exporting, setExporting] = useState(false)
  const [searchParams] = useSearchParams()

  let result, datasetDescription
  if (location.state?.result) {
    result = location.state.result; datasetDescription = location.state.description || ''
  } else if (searchParams.get('shared')) {
    const decoded = decodeShareData(searchParams.get('shared'))
    if (decoded?.result) { result = decoded.result; datasetDescription = decoded.description || '' }
  } else {
    try {
      const saved = sessionStorage.getItem('auditResult')
      if (saved) { const p = JSON.parse(saved); result = p.result; datasetDescription = p.description || '' }
    } catch {}
  }

  useEffect(() => {
    if (result) {
      try { sessionStorage.setItem('auditResult', JSON.stringify({ result, description: datasetDescription })) } catch {}
    }
  }, [])

  if (!result) return (
    <div className={styles.noResult}>
      <p>No audit data found.</p>
      <button className={styles.backBtn} onClick={() => navigate('/')}>← Back to Home</button>
    </div>
  )

  const {
    bias_score, bias_level, risk_label,
    total_rows, columns, sensitive_column, target_column, prediction_column, has_predictions,
    metrics = [], group_stats = [],
    bias_origin, root_causes = [],
    mitigation, statistical_test,
    reliability,
    summary, key_findings = [], recommendations = [],
    audit_summary_json,
  } = result

  const scoreColor = bias_score < 20 ? 'var(--green)' : bias_score < 45 ? 'var(--amber)' : bias_score < 70 ? '#f97316' : 'var(--red)'
  const flaggedMetrics = metrics.filter(m => m.flagged)
  const reliabilityData = reliability || { reliability: 'Unknown', confidence_score: null, warnings: [] }
  const reliabilityColor = reliabilityData.reliability === 'High' ? 'var(--green)' : reliabilityData.reliability === 'Medium' ? 'var(--amber)' : reliabilityData.reliability === 'Unknown' ? 'var(--text-muted)' : 'var(--red)'

  const maxRate = group_stats.length > 0 ? Math.max(...group_stats.map(g => g.pass_rate)) : 1
  const minRate = group_stats.length > 0 ? Math.min(...group_stats.map(g => g.pass_rate)) : 0

  const groupChartData = group_stats.map(g => ({
    name: g.group,
    'Pass Rate (%)': Math.round(g.pass_rate * 100),
    fill: g.pass_rate === maxRate ? 'var(--green)' : g.pass_rate === minRate ? 'var(--red)' : 'var(--primary)',
  }))

  const hasEO = has_predictions && group_stats.some(g => g.tpr != null)
  const eoChartData = hasEO ? group_stats.map(g => ({
    name: g.group,
    'TPR (%)': g.tpr != null ? Math.round(g.tpr * 100) : null,
    'FPR (%)': g.fpr != null ? Math.round(g.fpr * 100) : null,
  })).filter(d => d['TPR (%)'] !== null) : []

  const mitigationChartData = mitigation ? [
    { name: 'Before', score: mitigation.bias_before, fill: 'var(--red)' },
    ...(mitigation.results || []).map(r => ({
      name: r.method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      score: r.bias_score,
      fill: r.method === mitigation.best_method ? 'var(--green)' : 'var(--primary)',
      accuracy: r.accuracy,
      improvement: r.improvement,
      isBest: r.method === mitigation.best_method,
    }))
  ] : []

  const tt = {
    contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 },
    labelStyle: { color: 'var(--text)' },
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(buildShareUrl({ result, description: datasetDescription }))
      setShareState('copied'); setTimeout(() => setShareState('idle'), 2000)
    } catch { setShareState('idle') }
  }

  async function handleExport() {
    setExporting(true)
    try { await exportAuditToPdf(result, datasetDescription) } finally { setExporting(false) }
  }

  const tabBadges = {
    diagnosis: root_causes.filter(c => !c.includes('No significant')).length,
    evidence: flaggedMetrics.length,
  }

  return (
    <div className={styles.page}>

      {/* ── Header — frosted glass, same as Results ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>
            <Icon name="back" size={13}/> Back
          </button>
          <img src="/fairlens_logo.png" alt="FairLens" className={styles.logoImg}/>
        </div>
        <div className={styles.headerRight}>
          <ThemeToggle/>
          <button className={styles.actionBtn} onClick={handleShare}>
            {shareState === 'copied'
              ? <><Icon name="check" size={13}/> Copied!</>
              : <><Icon name="share" size={13}/> Share</>}
          </button>
          <button className={styles.actionBtn} onClick={handleExport} disabled={exporting}>
            <Icon name="pdf" size={13}/> {exporting ? 'Exporting...' : 'PDF'}
          </button>
        </div>
      </header>

      {/* ── Score Strip ── */}
      <div className={styles.scoreStrip}>
        <div className={styles.scoreStripLeft}>
          <div className={styles.gaugeSmall}>
            <BiasGauge score={bias_score} level={bias_level}/>
          </div>
          <div className={styles.scoreStripInfo}>
            <span className={styles.scoreLevel} style={{ color: scoreColor }}>{bias_level} Bias</span>
            <span className={styles.scoreMeta}>
              {risk_label} · {total_rows?.toLocaleString()} rows
              {sensitive_column && ` · ${sensitive_column}`}
            </span>
          </div>
        </div>
        <div className={styles.scoreStripRight}>
          {bias_origin && (
            <div className={styles.stripPill} style={{ borderColor: 'var(--red)' + '44' }}>
              <span className={styles.stripPillLabel}>Most Affected</span>
              <span className={styles.stripPillValue} style={{ color: 'var(--red)' }}>{bias_origin.group}</span>
            </div>
          )}
          {reliabilityData.reliability !== 'Unknown' && (
            <div className={styles.stripPill} style={{ borderColor: reliabilityColor + '44' }}>
              <span className={styles.stripPillLabel}>Reliability</span>
              <span className={styles.stripPillValue} style={{ color: reliabilityColor }}>
                {reliabilityData.reliability} · {reliabilityData.confidence_score ?? '—'}/100
              </span>
            </div>
          )}
          {flaggedMetrics.length > 0 && (
            <div className={styles.flaggedChip}>
              <span className={styles.flaggedChipDot}/>
              {flaggedMetrics.length} flagged
            </div>
          )}
        </div>
      </div>

      {/* ── Warnings Strip ── */}
      {reliabilityData.warnings?.length > 0 && (
        <div className={styles.warningsStrip}>
          {reliabilityData.warnings.map((w, i) => (
            <span key={i} className={styles.warningChip}><Icon name="warning" size={11}/> {w}</span>
          ))}
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''} ${t.id === 'ask' ? styles.tabAsk : ''}`}
            onClick={() => setActiveTab(t.id)}>
            <Icon name={t.icon} size={13}/>
            <span className={styles.tabLabel}>{t.label}</span>
            {tabBadges[t.id] > 0 && <span className={styles.tabBadge}>{tabBadges[t.id]}</span>}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className={styles.main}>

        {/* ══ SUMMARY ══ */}
        {activeTab === 'summary' && (
          <div className={styles.tabContent}>
            <div className={styles.summaryHero}>
              <div className={styles.gaugeWrap}>
                <BiasGauge score={bias_score} level={bias_level}/>
              </div>
              <div className={styles.summaryHeroInfo}>
                <div className={styles.riskBadge} style={{ background: scoreColor + '22', color: scoreColor, borderColor: scoreColor + '55' }}>
                  {risk_label}
                </div>
                <h1 className={styles.summaryTitle}>{bias_level} Bias Detected</h1>
                <p className={styles.summaryMeta}>
                  {total_rows?.toLocaleString()} rows · {columns?.length} columns ·
                  Sensitive: <strong>{sensitive_column || 'auto-detected'}</strong> ·
                  Target: <strong>{target_column || 'auto-detected'}</strong>
                  {has_predictions && <> · Prediction: <strong>{prediction_column}</strong></>}
                </p>
                <div className={styles.summaryParas}>
                  {summary.split('\n\n').map((p, i) => <p key={i} className={styles.summaryPara}>{p}</p>)}
                </div>
              </div>
            </div>

            <div className={styles.quickStats}>
              {bias_origin && (
                <div className={styles.statCard} style={{ borderColor: 'var(--red)' + '44' }}>
                  <Icon name="origin" size={20}/>
                  <div>
                    <p className={styles.statLabel}>Most Affected Group</p>
                    <p className={styles.statValue} style={{ color: 'var(--red)' }}>{bias_origin.group}</p>
                    <p className={styles.statMeta}>via {bias_origin.metric}</p>
                  </div>
                </div>
              )}
              {reliabilityData.reliability !== 'Unknown' && (
                <div className={styles.statCard} style={{ borderColor: reliabilityColor + '44' }}>
                  <Icon name="target" size={20}/>
                  <div>
                    <p className={styles.statLabel}>Data Reliability</p>
                    <p className={styles.statValue} style={{ color: reliabilityColor }}>{reliabilityData.reliability}</p>
                    <p className={styles.statMeta}>{reliabilityData.confidence_score ?? '—'}/100 confidence</p>
                  </div>
                </div>
              )}
              <div className={styles.statCard} style={{ borderColor: (flaggedMetrics.length > 0 ? 'var(--red)' : 'var(--green)') + '44' }}>
                <Icon name="metrics" size={20}/>
                <div>
                  <p className={styles.statLabel}>Metrics Flagged</p>
                  <p className={styles.statValue} style={{ color: flaggedMetrics.length > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {flaggedMetrics.length} / {metrics.length}
                  </p>
                  <p className={styles.statMeta}>{flaggedMetrics.length === 0 ? 'All passing' : 'Need attention'}</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <Icon name="groups" size={20}/>
                <div>
                  <p className={styles.statLabel}>Groups Analyzed</p>
                  <p className={styles.statValue}>{group_stats.length}</p>
                  <p className={styles.statMeta}>{group_stats.map(g => g.group).join(', ')}</p>
                </div>
              </div>
            </div>

            <div className={styles.nextStepRow}>
              <button className={styles.nextStepBtn} onClick={() => setActiveTab('diagnosis')}>
                <Icon name="findings" size={14}/> See why bias exists
              </button>
              <button className={styles.nextStepBtnSecondary} onClick={() => setActiveTab('fix')}>
                <Icon name="simulation" size={14}/> Simulate a fix
              </button>
            </div>
          </div>
        )}

        {/* ══ WHY BIAS ══ */}
        {activeTab === 'diagnosis' && (
          <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>Why Bias Exists</h2>
            <p className={styles.tabSubtitle}>Computed entirely in Python — no AI guessing.</p>

            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Root Causes</h3>
              {root_causes.length > 0 ? (
                <ul className={styles.causeList}>
                  {root_causes.map((c, i) => (
                    <li key={i} className={styles.causeItem}><span className={styles.causeDot}/>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>No significant root causes detected.</p>
              )}
            </div>

            {statistical_test && (
              <div className={`${styles.statSigCard} ${statistical_test.is_significant ? styles.statSigFlagged : styles.statSigOk}`}>
                <Icon name={statistical_test.is_significant ? 'warning' : 'check'} size={16}/>
                <div>
                  <p className={styles.statSigTitle}>
                    {statistical_test.is_significant ? 'Statistically Significant Bias' : 'Not Statistically Significant'}
                  </p>
                  <p className={styles.statSigText}>{statistical_test.interpretation}</p>
                </div>
              </div>
            )}

            <h3 className={styles.subTitle}>Key Metrics</h3>
            <div className={styles.metricsGrid}>
              {metrics.filter(m => ['demographic_parity_difference', 'disparate_impact_ratio'].includes(m.key)).map(m => (
                <MetricCard key={m.key} metric={m}/>
              ))}
            </div>

            <div className={styles.nextStepRow}>
              <button className={styles.nextStepBtn} onClick={() => setActiveTab('evidence')}>
                <Icon name="chart" size={14}/> See the evidence
              </button>
            </div>
          </div>
        )}

        {/* ══ EVIDENCE ══ */}
        {activeTab === 'evidence' && (
          <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>Evidence</h2>
            {has_predictions
              ? <span className={styles.modeBadgeFull}>Model-based — TPR/FPR from confusion matrix</span>
              : <span className={styles.modeBadgeLabel}>Label-only — add prediction column for true Equalized Odds</span>
            }
            <p className={styles.tabSubtitle}>Charts and tables showing exactly where disparity exists.</p>

            {groupChartData.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Pass Rate by Group</h3>
                <p className={styles.cardHint}>Green = highest · Red = lowest (most affected)</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={groupChartData} barCategoryGap="40%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 13 }}/>
                    <YAxis unit="%" domain={[0, 110]} tick={{ fill: 'var(--text-muted)', fontSize: 12 }}/>
                    <Tooltip formatter={v => [`${v}%`, 'Pass Rate']} {...tt}/>
                    <Bar dataKey="Pass Rate (%)" radius={[6, 6, 0, 0]} maxBarSize={80}>
                      <LabelList dataKey="Pass Rate (%)" position="top" formatter={v => `${v}%`}
                        style={{ fill: 'var(--text)', fontSize: 12, fontWeight: 700 }}/>
                      {groupChartData.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.88}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {!has_predictions && (
              <div className={styles.labelOnlyNotice}>
                <Icon name="insights" size={15}/>
                <p>Equalized Odds (TPR & FPR) requires a prediction column. In label-only mode these are not computed.</p>
              </div>
            )}
            {has_predictions && eoChartData.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Equalized Odds — TPR & FPR per Group</h3>
                <p className={styles.cardHint}>Ideally both are equal across groups — gaps reveal unequal outcomes.</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={eoChartData} barCategoryGap="30%" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 13 }}/>
                    <YAxis unit="%" domain={[0, 110]} tick={{ fill: 'var(--text-muted)', fontSize: 12 }}/>
                    <Tooltip formatter={(v, n) => [`${v}%`, n]} {...tt}/>
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }}/>
                    <Bar dataKey="TPR (%)" fill="var(--primary)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={60}>
                      <LabelList dataKey="TPR (%)" position="top" formatter={v => `${v}%`}
                        style={{ fill: 'var(--text)', fontSize: 11, fontWeight: 600 }}/>
                    </Bar>
                    <Bar dataKey="FPR (%)" fill="var(--red)" fillOpacity={0.75} radius={[4, 4, 0, 0]} maxBarSize={60}>
                      <LabelList dataKey="FPR (%)" position="top" formatter={v => `${v}%`}
                        style={{ fill: 'var(--text)', fontSize: 11, fontWeight: 600 }}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <h3 className={styles.subTitle}>All Fairness Metrics</h3>
            <div className={styles.metricsGrid}>
              {metrics.map(m => <MetricCard key={m.key} metric={m}/>)}
            </div>

            {group_stats.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Group Statistics Table</h3>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Group</th><th>Count</th>
                        {group_stats[0]?.avg_value != null && <th>Avg Value</th>}
                        <th>Pass</th><th>Fail</th><th>Pass Rate</th>
                        {group_stats[0]?.tpr != null && <th>TPR</th>}
                        {group_stats[0]?.fpr != null && <th>FPR</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {group_stats.map(g => (
                        <tr key={g.group} className={g.pass_rate === minRate ? styles.rowLowest : ''}>
                          <td>
                            <strong>{g.group}</strong>
                            {g.pass_rate === minRate && <span className={styles.lowestTag}>most affected</span>}
                          </td>
                          <td>{g.count}</td>
                          {group_stats[0]?.avg_value != null && <td>{g.avg_value?.toFixed(1) ?? '—'}</td>}
                          <td style={{ color: 'var(--green)' }}>{g.pass_count}</td>
                          <td style={{ color: 'var(--red)' }}>{g.fail_count}</td>
                          <td>
                            <span className={`${styles.ratePill} ${g.pass_rate === maxRate ? styles.rateHigh : g.pass_rate === minRate ? styles.rateLow : styles.rateMid}`}>
                              {(g.pass_rate * 100).toFixed(1)}%
                            </span>
                          </td>
                          {group_stats[0]?.tpr != null && <td>{g.tpr != null ? `${(g.tpr*100).toFixed(1)}%` : '—'}</td>}
                          {group_stats[0]?.fpr != null && <td>{g.fpr != null ? `${(g.fpr*100).toFixed(1)}%` : '—'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ FIX BIAS ══ */}
        {activeTab === 'fix' && (
          <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>Fix Bias</h2>
            <p className={styles.tabSubtitle}>
              Three mitigation strategies evaluated automatically.
              Best selected by: <strong>0.6 × bias_reduction + 0.3 × accuracy + 0.1 × stability</strong>
            </p>

            {!mitigation ? (
              <div className={styles.emptyState}><p>Run an audit to see mitigation results.</p></div>
            ) : (
              <>
                <div className={styles.simResultBanner}>
                  <div className={styles.simBannerScore}>
                    <span className={styles.simBannerNum} style={{ color: 'var(--red)' }}>{mitigation.bias_before}</span>
                    <span className={styles.simBannerArrow}>→</span>
                    <span className={styles.simBannerNum} style={{ color: 'var(--green)' }}>{mitigation.bias_after}</span>
                  </div>
                  <div className={styles.simBannerImprovement}>
                    <span className={styles.simBannerImpLabel}>Best result</span>
                    <span className={styles.simBannerImpVal}>{mitigation.trade_off_summary}</span>
                  </div>
                </div>

                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Method Comparison — Bias Score</h3>
                  <p className={styles.cardHint}>Green = best method ({mitigation.best_method.replace(/_/g, ' ')})</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={mitigationChartData} barCategoryGap="20%" barSize={60}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }}/>
                      <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 12 }}/>
                      <Tooltip
                        formatter={(v, n, p) => [
                          `${v} bias score${p.payload.accuracy != null ? ` | Acc: ${(p.payload.accuracy*100).toFixed(1)}%` : ''}`,
                          p.payload.isBest ? 'Best Method' : p.payload.name
                        ]}
                        {...tt}/>
                      <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="score" position="top" style={{ fill: 'var(--text)', fontSize: 13, fontWeight: 700 }}/>
                        {mitigationChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} fillOpacity={entry.isBest ? 1.0 : 0.75}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={styles.mitigationGrid}>
                  {(mitigation.results || []).map(r => (
                    <div key={r.method}
                      className={`${styles.mitigationCard} ${r.method === mitigation.best_method ? styles.mitigationCardBest : ''}`}>
                      {r.method === mitigation.best_method && (
                        <div className={styles.bestBadge}>Best Method</div>
                      )}
                      <h4 className={styles.mitigationMethod}>
                        {r.method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </h4>
                      <p className={styles.mitigationDesc}>{r.description}</p>
                      <div className={styles.mitigationStats}>
                        <div className={styles.mitigationStat}>
                          <span className={styles.mitigationStatLabel}>Bias Score</span>
                          <span className={styles.mitigationStatVal} style={{ color: r.bias_score < 30 ? 'var(--green)' : r.bias_score < 60 ? 'var(--amber)' : 'var(--red)' }}>
                            {r.bias_score}
                          </span>
                        </div>
                        <div className={styles.mitigationStat}>
                          <span className={styles.mitigationStatLabel}>Improvement</span>
                          <span className={styles.mitigationStatVal} style={{ color: 'var(--green)' }}>-{r.improvement} pts</span>
                        </div>
                        <div className={styles.mitigationStat}>
                          <span className={styles.mitigationStatLabel}>DPD After</span>
                          <span className={styles.mitigationStatVal}>{r.dpd.toFixed(4)}</span>
                        </div>
                        <div className={styles.mitigationStat}>
                          <span className={styles.mitigationStatLabel}>TPR Gap</span>
                          <span className={styles.mitigationStatVal}>{r.tpr_gap.toFixed(4)}</span>
                        </div>
                        {r.accuracy != null && (
                          <div className={styles.mitigationStat}>
                            <span className={styles.mitigationStatLabel}>Accuracy</span>
                            <span className={styles.mitigationStatVal}>{(r.accuracy * 100).toFixed(1)}%</span>
                          </div>
                        )}
                        <div className={styles.mitigationStat}>
                          <span className={styles.mitigationStatLabel}>Selection Score</span>
                          <span className={styles.mitigationStatVal}>{r.final_score >= 0 ? r.final_score.toFixed(3) : 'Invalid'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.bestReasonCard}>
                  <Icon name="check" size={16}/>
                  <p className={styles.bestReasonText}>{mitigation.best_reason}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ AI INSIGHTS ══ */}
        {activeTab === 'insights' && (
          <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>AI Insights</h2>
            <p className={styles.tabSubtitle}>Generated by Gemini 2.5 Flash, grounded in computed statistics.</p>

            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Bias Narrative</h3>
              <div className={styles.summaryParas}>
                {summary.split('\n\n').map((p, i) => <p key={i} className={styles.summaryPara}>{p}</p>)}
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Key Findings</h3>
                <ol className={styles.findingList}>
                  {key_findings.map((f, i) => <li key={i} className={styles.findingItem}>{f}</li>)}
                </ol>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Recommendations</h3>
                <ul className={styles.recList}>
                  {recommendations.map((r, i) => (
                    <li key={i} className={styles.recItem}><span className={styles.recArrow}>→</span>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ══ TRANSPARENCY ══ */}
        {activeTab === 'transparency' && (
          <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>Transparency</h2>
            <p className={styles.tabSubtitle}>Everything FairLens used — no black boxes.</p>

            <div className={styles.transpGrid}>
              {[
                { label: 'Dataset size',       value: `${total_rows?.toLocaleString()} rows` },
                { label: 'Total columns',      value: columns?.length },
                { label: 'Sensitive attribute',value: sensitive_column || 'auto-detected' },
                { label: 'Target column',      value: target_column || 'auto-detected' },
                { label: 'Prediction column',  value: prediction_column || 'none (label-only)' },
                { label: 'Mode',               value: has_predictions ? 'Model-based' : 'Label-only' },
                { label: 'Groups analyzed',    value: group_stats.length },
                { label: 'Metrics flagged',    value: `${flaggedMetrics.length} / ${metrics.length}`, color: flaggedMetrics.length > 0 ? 'var(--red)' : 'var(--green)' },
                { label: 'Data reliability',   value: `${reliabilityData.reliability ?? '—'} (${reliabilityData.confidence_score ?? '—'}/100)`, color: reliabilityColor },
              ].map((item, i) => (
                <div key={i} className={styles.transpCard}>
                  <span className={styles.transpLabel}>{item.label}</span>
                  <span className={styles.transpValue} style={item.color ? { color: item.color } : {}}>{item.value}</span>
                </div>
              ))}
            </div>

            {reliabilityData.warnings?.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Data Warnings</h3>
                <ul className={styles.causeList}>
                  {reliabilityData.warnings.map((w, i) => (
                    <li key={i} className={styles.causeItem}><span className={styles.warnDot}/>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Bias Score Formula</h3>
              <div className={styles.formulaBox}>
                <p>{`bias_score = mean(violations) × 100
violations = [dpd_v, dir_v${has_predictions ? ', tpr_v, fpr_v' : ' (TPR/FPR excluded — no prediction column)'}]
dpd_v = min(DPD/0.10, 1)   dir_v = 0 if DIR>=0.80 else min((0.80-DIR)/0.80, 1)
tpr_v = min(TPR_gap/0.10, 1)   fpr_v = min(FPR_gap/0.10, 1)`}</p>
                <p className={styles.formulaNote}>All metrics computed in Python. Gemini writes text only.</p>
              </div>
            </div>

            <div className={styles.card}>
              <h3 className={styles.cardTitle}>All Columns</h3>
              <div className={styles.columnPills}>
                {columns?.map(c => (
                  <span key={c} className={`${styles.colPill} ${c === sensitive_column ? styles.colPillSensitive : c === target_column ? styles.colPillTarget : c === prediction_column ? styles.colPillPred : ''}`}>
                    {c}
                    {c === sensitive_column && <span className={styles.colTag}>sensitive</span>}
                    {c === target_column && <span className={styles.colTag}>target</span>}
                    {c === prediction_column && <span className={styles.colTag}>prediction</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ ASK AI ══ */}
        {activeTab === 'ask' && (
          <div className={styles.tabContentAsk}>
            <ChatPanel datasetDescription={datasetDescription} auditSummary={audit_summary_json}/>
          </div>
        )}

      </div>
    </div>
  )
}
