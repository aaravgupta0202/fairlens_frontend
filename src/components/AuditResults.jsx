import { useState } from 'react'
import BiasGauge from './BiasGauge'
import FairnessComparisonChart from './FairnessComparisonChart'
import { downloadBase64File } from '../api/audit'
import { buildShareUrl } from '../api/share'
import { exportAuditToPdf } from '../api/exportPdf'
import styles from './AuditResults.module.css'

export default function AuditResults({ result, targetColumn, sensitiveColumn, onReset, standalone = false }) {
  const {
    accuracy_before, accuracy_after,
    fairness_before, fairness_after,
    dp_difference_before, dp_difference_after,
    eo_difference_before, eo_difference_after,
    bias_detected, bias_level,
    group_metrics_before, group_metrics_after,
    message, total_rows, feature_columns,
    debiased_dataset, debiased_model, intersectional,
  } = result

  const [shareState, setShareState] = useState('idle')
  const [exporting, setExporting] = useState(false)

  const fairnessLevel = fairness_after >= 85 ? 'Low' : fairness_after >= 65 ? 'Moderate' : 'High'
  const fairnessLevelBefore = fairness_before >= 85 ? 'Low' : fairness_before >= 65 ? 'Moderate' : 'High'
  const accuracyDiff = (accuracy_after - accuracy_before).toFixed(1)
  const fairnessDiff = (fairness_after - fairness_before).toFixed(1)

  function metricColor(val) {
    return val > 0 ? 'var(--green)' : val === 0 ? 'var(--text-muted)' : 'var(--amber)'
  }

  function handleDownloadDataset() {
    downloadBase64File(debiased_dataset, 'fairlens_debiased_dataset.csv', 'text/csv')
  }

  function handleDownloadModel() {
    downloadBase64File(debiased_model, 'fairlens_debiased_model.pkl', 'application/octet-stream')
  }

  async function handleShare() {
    // Build share URL pointing to /audit-results with full state encoded
    const shareData = {
      type: 'audit',
      result,
      targetColumn,
      sensitiveColumn,
    }
    const url = buildShareUrl(shareData)
    if (!url) { setShareState('error'); return }
    try {
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2500)
    } catch { setShareState('error') }
  }

  async function handleExportPdf() {
    setExporting(true)
    try {
      await exportAuditToPdf({ result, targetColumn, sensitiveColumn })
    } finally {
      setExporting(false)
    }
  }

  const shareLabel = { idle: '🔗 Share', copied: '✓ Copied!', error: 'Failed' }[shareState]

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>
            Dataset Audit Results
            {intersectional && <span className={styles.intersectionalBadge}>Intersectional</span>}
          </h3>
          <p className={styles.subtitle}>
            {total_rows} rows · {feature_columns.length} features analysed
            {targetColumn && ` · predicting "${targetColumn}"`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.actionBtn} ${shareState === 'copied' ? styles.actionSuccess : ''}`}
            onClick={handleShare}>{shareLabel}
          </button>
          <button className={styles.actionBtn} onClick={handleExportPdf} disabled={exporting}>
            {exporting ? '⏳ Exporting...' : '📄 Export PDF'}
          </button>
          <button className={styles.actionBtn} onClick={handleDownloadDataset}
            disabled={!debiased_dataset}>⬇ Dataset</button>
          <button className={styles.actionBtn} onClick={handleDownloadModel}
            disabled={!debiased_model}>⬇ Model</button>
          {!standalone && (
            <button className={styles.resetBtn} onClick={onReset}>← New Audit</button>
          )}
        </div>
      </div>

      {/* Bias banner */}
      <div className={`${styles.banner} ${styles[`banner${bias_level}`]}`}>
        {bias_detected
          ? `⚠ ${bias_level} bias detected before mitigation. Mitigation has been applied — see comparison below.`
          : '✓ Low bias detected. The model appears fair with respect to the selected sensitive attribute.'}
      </div>

      {/* Gauges */}
      <div className={styles.gaugesRow}>
        <div className={styles.card}>
          <p className={styles.cardLabel}>Fairness Score — Before</p>
          <BiasGauge score={fairness_before} level={fairnessLevelBefore} fairnessMode={true} />
          <p className={styles.gaugeNote}>DPD: {dp_difference_before}</p>
        </div>
        <div className={styles.arrowCol}>→</div>
        <div className={styles.card}>
          <p className={styles.cardLabel}>Fairness Score — After Mitigation</p>
          <BiasGauge score={fairness_after} level={fairnessLevel} fairnessMode={true} />
          <p className={styles.gaugeNote}>DPD: {dp_difference_after}</p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className={styles.metricsGrid}>
        {[
          { label: 'Model Accuracy', before: `${accuracy_before}%`, after: `${accuracy_after}%`,
            diff: `${accuracyDiff > 0 ? '+' : ''}${accuracyDiff}%`, diffVal: parseFloat(accuracyDiff) },
          { label: 'Fairness Score', before: `${fairness_before}%`, after: `${fairness_after}%`,
            diff: `${fairnessDiff > 0 ? '+' : ''}${fairnessDiff}%`, diffVal: parseFloat(fairnessDiff) },
          { label: 'Dem. Parity Diff.', before: dp_difference_before, after: dp_difference_after,
            diff: dp_difference_after < dp_difference_before ? '↓ Better' : '↑ Worse',
            diffVal: dp_difference_before - dp_difference_after },
          { label: 'Equal. Odds Diff.', before: eo_difference_before, after: eo_difference_after,
            diff: eo_difference_after < eo_difference_before ? '↓ Better' : '↑ Worse',
            diffVal: eo_difference_before - eo_difference_after },
        ].map(m => (
          <div key={m.label} className={styles.metricCard}>
            <p className={styles.metricLabel}>{m.label}</p>
            <div className={styles.metricRow}>
              <span className={styles.metricVal}>{m.before}</span>
              <span className={styles.metricArrow}>→</span>
              <span className={styles.metricVal}>{m.after}</span>
              <span className={styles.metricDiff} style={{ color: metricColor(m.diffVal) }}>
                {m.diff}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className={styles.card} style={{ alignItems: 'stretch' }}>
        <FairnessComparisonChart
          groupMetricsBefore={group_metrics_before}
          groupMetricsAfter={group_metrics_after}
        />
      </div>

      {/* Per-group table */}
      <div className={styles.card} style={{ alignItems: 'stretch' }}>
        <h4 className={styles.tableTitle}>Per-Group Metrics (After Mitigation)</h4>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr><th>Group</th><th>Sample Size</th><th>Accuracy</th><th>Positive Rate</th></tr>
            </thead>
            <tbody>
              {Object.entries(group_metrics_after).map(([group, m]) => (
                <tr key={group}>
                  <td>{group}</td><td>{m.sample_size}</td>
                  <td>{m.accuracy}%</td><td>{m.positive_prediction_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gemini message */}
      <div className={styles.messageCard}>
        <span className={styles.messageIcon}>🤖</span>
        <div>
          <p className={styles.messageLabel}>Gemini 2.5 Flash Analysis</p>
          <p className={styles.messageText}>{message}</p>
        </div>
      </div>
    </div>
  )
}
