import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHistory, clearHistory, deleteHistoryItem } from '../api/history'
import styles from './HistoryPanel.module.css'

export default function HistoryPanel({ onClose }) {
  const navigate = useNavigate()
  const [history, setHistory] = useState(getHistory)

  function handleOpen(entry) {
    navigate('/results', {
      state: {
        result: entry.result,
        prompt: entry.prompt,
        aiResponse: entry.aiResponse,
      },
    })
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

  const levelColor = {
    Low: '#34d399',
    Moderate: '#fbbf24',
    High: '#f87171',
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

        {history.length === 0 ? (
          <div className={styles.empty}>
            <span>📋</span>
            <p>No analyses yet. Run your first one!</p>
          </div>
        ) : (
          <div className={styles.list}>
            {history.map(entry => (
              <div
                key={entry.id}
                className={styles.item}
                onClick={() => handleOpen(entry)}
              >
                <div className={styles.itemLeft}>
                  <div
                    className={styles.scoreBadge}
                    style={{
                      background: `${levelColor[entry.result.bias_level]}22`,
                      color: levelColor[entry.result.bias_level],
                      borderColor: `${levelColor[entry.result.bias_level]}44`,
                    }}
                  >
                    {Math.round(entry.result.bias_score)}
                  </div>
                  <div className={styles.itemInfo}>
                    <p className={styles.itemPrompt}>{entry.prompt}</p>
                    <span className={styles.itemMeta}>
                      {entry.result.bias_level} Bias · {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
