/**
 * VersionControl — "git for fairness"
 * 
 * WORKFLOW (matching the original spec):
 * 1. User uploads CSV v1 → runs audit → clicks "Save This Version" here
 * 2. They go back to Home, upload CSV v2 (e.g. 6 months later) → run audit → save again
 * 3. On the Versions tab they see a timeline, select any two, get a full diff report
 * 
 * The diff report says things like:
 * "DPD: 0.34 → 0.21 (↓ 38%). Gender gap narrowed. Race gap unchanged."
 */
import { useState } from 'react'
import { getVersions, saveVersion, deleteVersion, computeDiff } from '../api/versions'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import styles from './VersionControl.module.css'
import Icon from './Icon'

// ── Diff Report ───────────────────────────────────────────────────────────────
function DiffReport({ vA, vB, onClose }) {
  const older = vA.timestamp < vB.timestamp ? vA : vB
  const newer = vA.timestamp < vB.timestamp ? vB : vA
  const diff  = computeDiff(older, newer)

  const scoreColor = diff.scoreDelta < 0 ? '#4ade80' : diff.scoreDelta > 0 ? '#f87171' : '#a09080'
  const improved   = diff.scoreDelta < 0
  const daysBetween = Math.round(Math.abs(newer.timestamp - older.timestamp) / (1000*60*60*24))

  // Build narrative
  const narrativeParts = []
  if (Math.abs(diff.scoreDelta) > 0.5) {
    narrativeParts.push(improved
      ? `Bias score improved by ${Math.abs(diff.scoreDelta).toFixed(1)} points (${older.snapshot.bias_score.toFixed(1)} → ${newer.snapshot.bias_score.toFixed(1)}) over ${daysBetween} days.`
      : `Bias score worsened by ${Math.abs(diff.scoreDelta).toFixed(1)} points over ${daysBetween} days.`)
  }
  const bigWins   = diff.metricDiffs.filter(m => m.delta < -0.02 && m.oldFlagged && !m.newFlagged)
  const bigLosses = diff.metricDiffs.filter(m => m.delta > 0.02 && !m.oldFlagged && m.newFlagged)
  if (bigWins.length)   narrativeParts.push(`${bigWins.map(m=>m.name).join(', ')} moved from flagged to passing.`)
  if (bigLosses.length) narrativeParts.push(`${bigLosses.map(m=>m.name).join(', ')} became newly flagged.`)
  const groupChanges = diff.groupDiffs.filter(g => Math.abs(g.delta) > 0.03)
  if (groupChanges.length) {
    const improved2 = groupChanges.filter(g => g.delta > 0).map(g => `${g.group} (+${(g.delta*100).toFixed(0)}pp)`)
    const worsened  = groupChanges.filter(g => g.delta < 0).map(g => `${g.group} (${(g.delta*100).toFixed(0)}pp)`)
    if (improved2.length) narrativeParts.push(`Groups improved: ${improved2.join(', ')}.`)
    if (worsened.length)  narrativeParts.push(`Groups worsened: ${worsened.join(', ')}.`)
    const unchanged = diff.groupDiffs.filter(g => Math.abs(g.delta) <= 0.03).map(g => g.group)
    if (unchanged.length) narrativeParts.push(`Unchanged groups: ${unchanged.join(', ')}.`)
  }

  return (
    <div className={styles.diffOverlay} onClick={onClose}>
      <div className={styles.diffModal} onClick={e => e.stopPropagation()}>
        <div className={styles.diffModalHeader}>
          <div>
            <p className={styles.diffModalTitle}>Bias Drift Report</p>
            <p className={styles.diffModalSub}>{older.name} <span>({new Date(older.timestamp).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})})</span> → {newer.name} <span>({new Date(newer.timestamp).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})})</span> · {daysBetween} days apart</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Narrative */}
        {narrativeParts.length > 0 && (
          <div className={`${styles.narrative} ${improved ? styles.narrativeGood : styles.narrativeBad}`}>
            <div className={styles.narrativeIcon}>{improved ? '📉' : '📈'}</div>
            <div>
              {narrativeParts.map((p, i) => <p key={i} className={styles.narrativePara}>{p}</p>)}
            </div>
          </div>
        )}

        {/* Score delta big display */}
        <div className={styles.scoreDeltaRow}>
          <div className={styles.scoreDeltaBox}>
            <span className={styles.scoreDeltaLabel}>Before</span>
            <span className={styles.scoreDeltaNum} style={{color:'var(--text-muted)'}}>{older.snapshot.bias_score.toFixed(1)}</span>
            <span className={styles.scoreDeltaLevel}>{older.snapshot.bias_level} Bias</span>
          </div>
          <div className={styles.scoreDeltaArrow}>
            <span className={styles.scoreDeltaChange} style={{color: scoreColor}}>
              {diff.scoreDelta > 0 ? '+' : ''}{diff.scoreDelta.toFixed(1)}
            </span>
            <span className={styles.scoreDeltaChangeSub}>{improved ? 'improved' : 'worsened'}</span>
          </div>
          <div className={styles.scoreDeltaBox}>
            <span className={styles.scoreDeltaLabel}>After</span>
            <span className={styles.scoreDeltaNum} style={{color: scoreColor}}>{newer.snapshot.bias_score.toFixed(1)}</span>
            <span className={styles.scoreDeltaLevel}>{newer.snapshot.bias_level} Bias</span>
          </div>
        </div>

        {/* Metrics diff table */}
        {diff.metricDiffs.length > 0 && (
          <div className={styles.diffSection}>
            <p className={styles.diffSectionTitle}>Metric-by-Metric Changes</p>
            <div className={styles.diffTable}>
              <div className={styles.diffTableHeader}>
                <span>Metric</span><span>Before</span><span>After</span><span>Change</span><span>Status</span>
              </div>
              {diff.metricDiffs.map(m => {
                const dColor = m.delta < 0 ? '#4ade80' : m.delta > 0 ? '#f87171' : '#a09080'
                return (
                  <div key={m.key} className={styles.diffTableRow}>
                    <span className={styles.diffMetricName}>{m.name}</span>
                    <span className={styles.diffVal}>{m.oldVal?.toFixed(4)}</span>
                    <span className={styles.diffVal}>{m.newVal?.toFixed(4)}</span>
                    <span className={styles.diffDelta} style={{color: dColor}}>
                      {m.delta > 0 ? '+' : ''}{m.delta.toFixed(4)}
                    </span>
                    <span className={styles.diffStatus}>
                      {m.oldFlagged !== m.newFlagged
                        ? <span style={{color: m.newFlagged ? '#f87171' : '#4ade80', fontWeight:700}}>{m.newFlagged ? '⚠ Now Flagged' : '✓ Now Passing'}</span>
                        : <span style={{color:'var(--text-muted)'}}>{m.oldFlagged ? 'Still Flagged' : 'Still Passing'}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Group diff table */}
        {diff.groupDiffs.length > 0 && (
          <div className={styles.diffSection}>
            <p className={styles.diffSectionTitle}>Group Pass Rate Changes</p>
            <div className={styles.diffTable}>
              <div className={styles.diffTableHeader}>
                <span>Group</span><span>Before</span><span>After</span><span>Change</span><span>Trend</span>
              </div>
              {diff.groupDiffs.map(g => {
                const gColor = g.delta > 0.01 ? '#4ade80' : g.delta < -0.01 ? '#f87171' : '#a09080'
                return (
                  <div key={g.group} className={styles.diffTableRow}>
                    <span className={styles.diffMetricName}>{g.group}</span>
                    <span className={styles.diffVal}>{(g.oldRate*100).toFixed(1)}%</span>
                    <span className={styles.diffVal}>{(g.newRate*100).toFixed(1)}%</span>
                    <span className={styles.diffDelta} style={{color: gColor}}>
                      {g.delta > 0 ? '+' : ''}{(g.delta*100).toFixed(1)}pp
                    </span>
                    <span className={styles.diffStatus}>
                      {Math.abs(g.delta) < 0.01 ? '→ Unchanged' : g.delta > 0 ? '↑ Improved' : '↓ Worsened'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Download diff as CSV */}
        <button className={styles.downloadDiffBtn} onClick={() => {
          const rows = [
            ['Type','Name','Before','After','Delta','Status'],
            ['Score','Bias Score',older.snapshot.bias_score.toFixed(1),newer.snapshot.bias_score.toFixed(1),diff.scoreDelta.toFixed(1),improved?'Improved':'Worsened'],
            ...diff.metricDiffs.map(m => ['Metric',m.name,m.oldVal?.toFixed(4),m.newVal?.toFixed(4),(m.delta>0?'+':'')+m.delta.toFixed(4),m.oldFlagged!==m.newFlagged?(m.newFlagged?'Now Flagged':'Now Passing'):(m.oldFlagged?'Still Flagged':'Still Passing')]),
            ...diff.groupDiffs.map(g => ['Group',g.group,(g.oldRate*100).toFixed(1)+'%',(g.newRate*100).toFixed(1)+'%',(g.delta>0?'+':'')+(g.delta*100).toFixed(1)+'pp',Math.abs(g.delta)<0.01?'Unchanged':g.delta>0?'Improved':'Worsened']),
          ]
          const csv = rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
          const a = document.createElement('a')
          a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
          a.download = `FairLens_DriftReport_${older.name.replace(/\s/g,'_')}_vs_${newer.name.replace(/\s/g,'_')}.csv`
          a.click()
        }}>
          <Icon name="download" size={13}/> Download Drift Report CSV
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VersionControl({ currentResult, currentDescription }) {
  const [versions, setVersions] = useState(getVersions)
  const [saveName, setSaveName]  = useState('')
  const [selected, setSelected]  = useState([])   // up to 2 selected version IDs
  const [showDiff, setShowDiff]  = useState(false)

  function handleSave() {
    if (!currentResult) return
    saveVersion({ name: saveName.trim() || null, description: currentDescription, result: currentResult })
    setVersions(getVersions())
    setSaveName('')
  }

  function handleDelete(id) {
    deleteVersion(id)
    setVersions(getVersions())
    setSelected(s => s.filter(x => x !== id))
  }

  function toggleSelect(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2)  return [prev[1], id]
      return [...prev, id]
    })
  }

  // Timeline chart data — show bias score over time
  const chartData = [...versions].reverse().map(v => ({
    name: v.name.length > 12 ? v.name.slice(0,10)+'…' : v.name,
    score: v.snapshot.bias_score,
    date: new Date(v.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}),
  }))

  const vA = selected[0] ? versions.find(v => v.id === selected[0]) : null
  const vB = selected[1] ? versions.find(v => v.id === selected[1]) : null

  return (
    <div className={styles.wrap}>
      {/* Explanation */}
      <div className={styles.explainer}>
        <div className={styles.explainerSteps}>
          {[
            { n:'1', t:'Upload CSV v1', d:'Run your first audit, then save it here as a named version.' },
            { n:'2', t:'Upload CSV v2 later', d:'Go back to Home, upload a new or corrected dataset, run audit again.' },
            { n:'3', t:'Compare versions', d:'Select two versions below and click Compare to see a full drift report.' },
          ].map(s => (
            <div key={s.n} className={styles.explainerStep}>
              <div className={styles.explainerNum}>{s.n}</div>
              <div><strong>{s.t}</strong><p>{s.d}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* Save current audit */}
      <div className={styles.saveCard}>
        <p className={styles.saveCardTitle}>Save Current Audit as a Version</p>
        <p className={styles.saveCardHint}>Give it a meaningful name so you can identify it later (e.g. "Q1 2025 Hiring Model" or "Post-rebalancing v2")</p>
        <div className={styles.saveRow}>
          <input className={styles.nameInput}
            placeholder="e.g. Q1 2025 Hiring Model"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}/>
          <button className={styles.saveBtn} onClick={handleSave} disabled={!currentResult}>
            <Icon name="check" size={13}/> Save Version
          </button>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className={styles.empty}>
          <div style={{fontSize:32}}>📂</div>
          <p>No saved versions yet.</p>
          <p>Save this audit above, then run another audit with a different CSV to start tracking bias over time.</p>
        </div>
      ) : (
        <>
          {/* Timeline chart */}
          {versions.length >= 2 && (
            <div className={styles.timelineCard}>
              <p className={styles.timelineTitle}>Bias Score Timeline</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData} margin={{top:8,right:16,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="date" tick={{fill:'var(--text-muted)',fontSize:10}}/>
                  <YAxis domain={[0,100]} tick={{fill:'var(--text-muted)',fontSize:10}}/>
                  <Tooltip
                    contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8}}
                    labelStyle={{color:'var(--text-muted)'}}
                    formatter={(v, n) => [`${v.toFixed(1)}/100`, 'Bias Score']}/>
                  <ReferenceLine y={45} stroke="var(--amber)" strokeDasharray="4 2" strokeWidth={1}/>
                  <ReferenceLine y={70} stroke="var(--red)"   strokeDasharray="4 2" strokeWidth={1}/>
                  <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2.5} dot={{fill:'var(--primary)',r:4}} activeDot={{r:6}}/>
                </LineChart>
              </ResponsiveContainer>
              <div className={styles.timelineLegend}>
                <span style={{color:'var(--amber)'}}>— Moderate threshold (45)</span>
                <span style={{color:'var(--red)'}}>— High threshold (70)</span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className={styles.selectHint}>
            <Icon name="insights" size={13}/>
            Select <strong>two versions</strong> to generate a drift report showing exactly what changed and why.
            {selected.length === 1 && ' · Select one more.'}
          </div>

          {/* Version list */}
          <div className={styles.versionList}>
            {versions.map(v => {
              const isSelected = selected.includes(v.id)
              const sc = v.snapshot.bias_score
              const scoreColor = sc < 20 ? '#4ade80' : sc < 45 ? '#fbbf24' : sc < 70 ? '#f97316' : '#f87171'
              const selIdx = selected.indexOf(v.id)
              return (
                <div key={v.id} className={`${styles.versionCard} ${isSelected ? styles.versionCardSelected : ''}`}
                  onClick={() => toggleSelect(v.id)}>
                  <div className={styles.versionLeft}>
                    {isSelected && <div className={styles.selBadge}>{selIdx === 0 ? 'A' : 'B'}</div>}
                    <div className={styles.versionScore} style={{color: scoreColor}}>{sc.toFixed(1)}</div>
                    <div className={styles.versionMeta}>
                      <span className={styles.versionName}>{v.name}</span>
                      <span className={styles.versionDate}>
                        {new Date(v.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </span>
                      <span className={styles.versionDetail} style={{color: scoreColor}}>
                        {v.snapshot.bias_level} Bias · {v.snapshot.total_rows?.toLocaleString()} rows
                        {v.snapshot.sensitive_column ? ` · Protected: ${v.snapshot.sensitive_column}` : ''}
                      </span>
                    </div>
                  </div>
                  <button className={styles.deleteBtn}
                    onClick={e => { e.stopPropagation(); handleDelete(v.id) }}
                    title="Delete this version">
                    <Icon name="delete" size={12}/>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Compare button */}
          {selected.length === 2 && (
            <button className={styles.compareBtn} onClick={() => setShowDiff(true)}>
              <Icon name="chart" size={14}/>
              Compare: {vA?.name} vs {vB?.name}
            </button>
          )}
        </>
      )}

      {showDiff && vA && vB && (
        <DiffReport vA={vA} vB={vB} onClose={() => setShowDiff(false)}/>
      )}
    </div>
  )
}
