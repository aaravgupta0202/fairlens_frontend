/**
 * CounterfactualEditor — Feature A
 * Shows dataset rows. User picks a row, flips one value,
 * sees how the predicted outcome changes statistically.
 */
import { useState, useEffect } from 'react'
import styles from './CounterfactualEditor.module.css'
import Icon from './Icon'

function parseCsv(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const lines = e.target.result.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1, 201).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        return headers.reduce((obj, h, i) => { obj[h] = vals[i] ?? ''; return obj }, {})
      })
      resolve({ headers, rows })
    }
    reader.readAsText(file)
  })
}

function predictOutcome(row, sensitiveCol, targetCol, groupStats, positiveClass) {
  if (!sensitiveCol || !targetCol || !groupStats?.length) return null
  const group = row[sensitiveCol]
  const stat = groupStats.find(g => g.group === group)
  if (!stat) return null
  return {
    group,
    passRate: stat.pass_rate,
    likely: stat.pass_rate >= 0.5 ? positiveClass || 'Pass' : 'Fail',
    confidence: Math.abs(stat.pass_rate - 0.5) * 2,
  }
}

export default function CounterfactualEditor({ csvFile, sensitiveCol, targetCol, groupStats, result }) {
  const [data, setData] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [editedRow, setEditedRow] = useState(null)
  const [changedCol, setChangedCol] = useState(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  const positiveClass = result?.group_stats?.[0] ? 'Pass' : 'Pass'
  const uniqueGroups = [...new Set((groupStats || []).map(g => g.group))]

  useEffect(() => {
    if (!csvFile) return
    parseCsv(csvFile).then(setData)
  }, [csvFile])

  function handleSelectRow(row, idx) {
    setSelectedRow({ ...row, _idx: idx })
    setEditedRow({ ...row })
    setChangedCol(null)
  }

  function handleFieldChange(col, val) {
    setEditedRow(prev => ({ ...prev, [col]: val }))
    setChangedCol(col)
  }

  const originalPred = selectedRow ? predictOutcome(selectedRow, sensitiveCol, targetCol, groupStats, positiveClass) : null
  const newPred = editedRow ? predictOutcome(editedRow, sensitiveCol, targetCol, groupStats, positiveClass) : null
  const outcomeChanged = originalPred && newPred && originalPred.likely !== newPred.likely

  if (!csvFile) return (
    <div className={styles.empty}>
      <Icon name="upload" size={24}/>
      <p>Upload a CSV on the home page to use the Counterfactual Editor.</p>
    </div>
  )

  if (!data) return <div className={styles.loading}>Loading dataset...</div>

  const paged = data.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(data.rows.length / PAGE_SIZE)

  return (
    <div className={styles.wrap}>
      <div className={styles.intro}>
        <div className={styles.introIcon}>🔄</div>
        <div>
          <strong>Counterfactual Analysis</strong>
          <p>Click any row to select it. Change a value (e.g. flip Gender from Male → Female). See how the predicted outcome changes — making bias immediately visible.</p>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Table */}
        <div className={styles.tableWrap}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  {data.headers.map(h => (
                    <th key={h} className={h === sensitiveCol ? styles.sensitiveHeader : h === targetCol ? styles.targetHeader : ''}>
                      {h}
                      {h === sensitiveCol && <span className={styles.colTag}>sensitive</span>}
                      {h === targetCol && <span className={styles.colTag}>target</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => {
                  const absIdx = page * PAGE_SIZE + i
                  const isSelected = selectedRow?._idx === absIdx
                  return (
                    <tr key={absIdx}
                      className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
                      onClick={() => handleSelectRow(row, absIdx)}>
                      <td className={styles.rowNum}>{absIdx + 1}</td>
                      {data.headers.map(h => (
                        <td key={h} className={h === sensitiveCol ? styles.sensitiveCell : h === targetCol ? styles.targetCell : ''}>
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.pagination}>
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span>Page {page + 1} of {totalPages} · {data.rows.length} rows</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>

        {/* Editor panel */}
        {selectedRow ? (
          <div className={styles.editor}>
            <div className={styles.editorTitle}>
              <Icon name="simulation" size={15}/>
              Edit Row {selectedRow._idx + 1}
            </div>
            <p className={styles.editorHint}>Change any value below to see how the predicted outcome shifts.</p>

            <div className={styles.fields}>
              {data.headers.map(col => {
                const isSensitive = col === sensitiveCol
                const isTarget = col === targetCol
                const isChanged = changedCol === col
                const uniqueVals = [...new Set(data.rows.map(r => r[col]).filter(Boolean))].slice(0, 20)
                const isDropdown = uniqueVals.length <= 10

                return (
                  <div key={col} className={`${styles.field} ${isSensitive ? styles.fieldSensitive : ''} ${isTarget ? styles.fieldTarget : ''} ${isChanged ? styles.fieldChanged : ''}`}>
                    <label className={styles.fieldLabel}>
                      {col}
                      {isSensitive && <span className={styles.fieldTag} style={{background:'var(--red)22',color:'var(--red)'}}>sensitive</span>}
                      {isTarget && <span className={styles.fieldTag} style={{background:'var(--primary)22',color:'var(--primary)'}}>target</span>}
                      {isChanged && <span className={styles.fieldTag} style={{background:'var(--amber)22',color:'var(--amber)'}}>changed</span>}
                    </label>
                    {isDropdown ? (
                      <select className={styles.fieldInput}
                        value={editedRow[col] || ''}
                        onChange={e => handleFieldChange(col, e.target.value)}>
                        {uniqueVals.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (
                      <input className={styles.fieldInput}
                        value={editedRow[col] || ''}
                        onChange={e => handleFieldChange(col, e.target.value)}/>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Prediction comparison */}
            {originalPred && newPred && (
              <div className={`${styles.predBox} ${outcomeChanged ? styles.predChanged : styles.predSame}`}>
                <div className={styles.predTitle}>
                  {outcomeChanged
                    ? <><Icon name="warning" size={14}/> Outcome Changed!</>
                    : <><Icon name="check" size={14}/> Outcome Unchanged</>}
                </div>
                <div className={styles.predCompare}>
                  <div className={styles.predSide}>
                    <span className={styles.predLabel}>Original ({originalPred.group})</span>
                    <span className={styles.predValue} style={{color: originalPred.likely === (positiveClass||'Pass') ? 'var(--green)' : 'var(--red)'}}>
                      {originalPred.likely}
                    </span>
                    <span className={styles.predRate}>{(originalPred.passRate*100).toFixed(1)}% pass rate in group</span>
                  </div>
                  <div className={styles.predArrow}>→</div>
                  <div className={styles.predSide}>
                    <span className={styles.predLabel}>Modified ({newPred.group})</span>
                    <span className={styles.predValue} style={{color: newPred.likely === (positiveClass||'Pass') ? 'var(--green)' : 'var(--red)'}}>
                      {newPred.likely}
                    </span>
                    <span className={styles.predRate}>{(newPred.passRate*100).toFixed(1)}% pass rate in group</span>
                  </div>
                </div>
                {outcomeChanged && changedCol && (
                  <p className={styles.predExplain}>
                    Changing <strong>{changedCol}</strong> from <strong>{selectedRow[changedCol]}</strong> → <strong>{editedRow[changedCol]}</strong> moves this record from the <strong>{originalPred.group}</strong> group (pass rate {(originalPred.passRate*100).toFixed(0)}%) to the <strong>{newPred.group}</strong> group (pass rate {(newPred.passRate*100).toFixed(0)}%), flipping the predicted outcome. This reveals direct attribute-driven bias.
                  </p>
                )}
              </div>
            )}

            <button className={styles.resetBtn} onClick={() => { setSelectedRow(null); setEditedRow(null); setChangedCol(null) }}>
              Clear Selection
            </button>
          </div>
        ) : (
          <div className={styles.editorEmpty}>
            <div style={{fontSize:32}}>👆</div>
            <p>Click any row in the table to start a counterfactual analysis</p>
          </div>
        )}
      </div>
    </div>
  )
}
