import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHistory, clearHistory, deleteHistoryItem } from '../api/history'
import styles from './HistoryPanel.module.css'

export default function HistoryPanel({ onClose }) {
  const navigate = useNavigate()
  const [history, setHistory] = useState(getHistory)
  const [filter, setFilter] = useState('all') // 'all' | 'text' | 'audit'

  const levelColor = {
    Low: '#34d399',
    Moderate: '#fbbf24',
    High: '#f87171',
  }

  function handleOpen(entry) {
    if (entry.type === 'audit') {
      // Navigate home and restore audit result via state
      navigate('/', {
        state: {
          restoreAudit: true,
          auditResult: entry.result,
          filename: entry.filename,
          targetCol: entry.targetCol,
          sensitiveCol: entry.sensitiveCol,
        },
      })
    } else {
      navigate('/results', {
        state: {
          result: entry.result,
          prompt: entry.prompt,
          aiResponse: entry.aiResponse,
        },
      })
    }
    onClose?.()
  }

  function handleDelete(id, e) {
    e.stopPropagation()
    deleteHistoryItem(id)
    setHistory(getHistory())
  }

  function handleClear() {
    clearHistory()
    setHistory([])
  }

  const filtered = history.filter(h => {
    if (filter === 'all') return true
    if (filter === 'text') return h.type === 'text' || !h.type
    if (filter === 'audit') return h.type === 'audit'
    return true
  })

  function getScore(entry) {
    if (entry.type === 'audit') return Math.round(entry.result.fairness_after)
    return Math.round(entry.result.bias_score)
  }

  function getLevel(entry) {
    if (entry.type === 'audit') {
      const s = entry.result.fairness_after
      return s >= 85 ? 'Low' : s >= 65 ? 'Moderate' : 'High'
    }
    return entry.result.bias_level
  }

  function getLabel(entry) {
    if (entry.type === 'audit') {
      return `${entry.sensitiveCol} → ${entry.targetCol}`
    }
    return entry.prompt
  }

  function getMeta(entry) {
    const date = new Date(entry.timestamp)
    const dateStr = date.toLocaleDateString()
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (entry.type === 'audit') {
      return `Dataset Audit · ${entry.result.bias_level} Bias · ${dateStr} ${timeStr}`
    }
    return `${entry.result.bias_level} Bias · ${dateStr} ${timeStr}`
  }

  function getIcon(entry) {
    return entry.type === 'audit' ? '📊' : '💬'
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Analysis History</h3>
          <div className={styles.headerActions}>
            {history.length > 0 && (
              <button className={styles.clearBtn} onClick={handleClear}>
                Clear all
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className={styles.tabs}>
          {['all', 'text', 'audit'].map(f => (
            <button
              key={f}
              className={`${styles.tab} ${filter === f ? styles.tabActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'text' ? '💬 Text' : '📊 Dataset'}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <span>{filter === 'audit' ? '📊' : filter === 'text' ? '💬' : '📋'}</span>
            <p>No {filter === 'all' ? '' : filter} analyses yet.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(entry => {
              const level = getLevel(entry)
              const color = levelColor[level] || '#8b90b8'
              return (
                <div
                  key={entry.id}
                  className={styles.item}
                  onClick={() => handleOpen(entry)}
                >
                  <div className={styles.itemLeft}>
                    <div
                      className={styles.scoreBadge}
                      style={{
                        background: `${color}22`,
                        color,
                        borderColor: `${color}44`,
                      }}
                    >
                      <span className={styles.scoreIcon}>{getIcon(entry)}</span>
                      <span>{getScore(entry)}</span>
                    </div>
                    <div className={styles.itemInfo}>
                      <p className={styles.itemPrompt}>{getLabel(entry)}</p>
                      <span className={styles.itemMeta}>{getMeta(entry)}</span>
                    </div>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={e => handleDelete(entry.id, e)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
