import styles from './ColumnSelector.module.css'

export default function ColumnSelector({
  columns, targetCol, sensitiveCol, sensitiveCol2,
  onTargetChange, onSensitiveChange, onSensitiveChange2,
  modelType, onModelTypeChange,
}) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.group}>
        <label className={styles.label}>
          <span className={styles.dot} style={{ background: '#4f8ef7' }} />
          Target Column
          <span className={styles.hint}>What the model predicts</span>
        </label>
        <select className={styles.select} value={targetCol}
          onChange={e => onTargetChange(e.target.value)}>
          <option value="">Select column...</option>
          {columns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>
          <span className={styles.dot} style={{ background: '#a78bfa' }} />
          Sensitive Attribute
          <span className={styles.hint}>Protected attribute to check</span>
        </label>
        <select className={styles.select} value={sensitiveCol}
          onChange={e => onSensitiveChange(e.target.value)}>
          <option value="">Select column...</option>
          {columns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>
          <span className={styles.dot} style={{ background: '#34d399' }} />
          2nd Sensitive (optional)
          <span className={styles.hint}>For intersectional bias</span>
        </label>
        <select className={styles.select} value={sensitiveCol2 || ''}
          onChange={e => onSensitiveChange2(e.target.value || null)}>
          <option value="">None (standard mode)</option>
          {columns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>
          <span className={styles.dot} style={{ background: '#fbbf24' }} />
          Model Type
          <span className={styles.hint}>Algorithm to train</span>
        </label>
        <select className={styles.select} value={modelType}
          onChange={e => onModelTypeChange(e.target.value)}>
          <option value="logistic_regression">Logistic Regression</option>
          <option value="decision_tree">Decision Tree</option>
          <option value="random_forest">Random Forest</option>
        </select>
      </div>
    </div>
  )
}
