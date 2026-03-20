import styles from './ColumnSelector.module.css'

/**
 * Two dropdowns for selecting target and sensitive columns from CSV headers.
 */
export default function ColumnSelector({ columns, targetCol, sensitiveCol, onTargetChange, onSensitiveChange }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.group}>
        <label className={styles.label}>
          <span className={styles.dot} style={{ background: '#4f8ef7' }} />
          Target Column
          <span className={styles.hint}>What the model predicts</span>
        </label>
        <select
          className={styles.select}
          value={targetCol}
          onChange={e => onTargetChange(e.target.value)}
        >
          <option value="">Select column...</option>
          {columns.map(col => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>
          <span className={styles.dot} style={{ background: '#a78bfa' }} />
          Sensitive Attribute
          <span className={styles.hint}>Protected attribute to check bias on</span>
        </label>
        <select
          className={styles.select}
          value={sensitiveCol}
          onChange={e => onSensitiveChange(e.target.value)}
        >
          <option value="">Select column...</option>
          {columns.map(col => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
