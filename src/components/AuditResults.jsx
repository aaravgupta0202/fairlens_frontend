import BiasGauge from './BiasGauge'
import FairnessComparisonChart from './FairnessComparisonChart'
import styles from './AuditResults.module.css'

/**
 * Full audit results dashboard.
 * Shows before/after accuracy, fairness scores, group breakdown, and chart.
 */
export default function AuditResults({ result, onReset }) {
  const {
    accuracy_before, accuracy_after,
    fairness_before, fairness_after,
    dp_difference_before, dp_difference_after,
    eo_difference_before, eo_difference_after,
    bias_detected, bias_level,
    group_metrics_before, group_metrics_after,
    message, total_rows, feature_columns,
  } = result

  const fairnessLevel = fairness_after >= 85 ? 'Low' : fairness_after >= 65 ? 'Moderate' : 'High'
  const fairnessLevelBefore = fairness_before >= 85 ? 'Low' : fairness_before >= 65 ? 'Moderate' : 'High'

  const accuracyDiff = (accuracy_after - accuracy_before).toFixed(1)
  const fairnessDiff = (fairness_after - fairness_before).toFixed(1)

  function metricColor(val, higherBetter = true) {
    const positive = higherBetter ? val > 0 : val < 0
    return positive ? 'var(--green)' : val === 0 ? 'var(--text-muted)' : 'var(--amber)'
  }

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Dataset Audit Results</h3>
          <p className={styles.subtitle}>{total_rows} rows · {feature_columns.length} features analysed</p>
        </div>
        <button className={styles.resetBtn} onClick={onReset}>← New Audit</button>
      </div>

      {/* Bias detected banner */}
      {bias_detected && (
        <div className={`${styles.banner} ${styles[`banner${bias_level}`]}`}>
          ⚠ {bias_level} bias detected before mitigation. Mitigation has been applied — see comparison below.
        </div>
      )}
      {!bias_detected && (
        <div className={`${styles.banner} ${styles.bannerLow}`}>
          ✓ Low bias detected. The model appears fair with respect to the selected sensitive attribute.
        </div>
      )}

      {/* Gauges row */}
      <div className={styles.gaugesRow}>
        <div className={styles.card}>
          <p className={styles.cardLabel}>Fairness Score — Before</p>
          <BiasGauge score={fairness_before} level={fairnessLevelBefore} />
          <p className={styles.gaugeNote}>DPD: {dp_difference_before}</p>
        </div>
        <div className={styles.arrowCol}>→</div>
        <div className={styles.card}>
          <p className={styles.cardLabel}>Fairness Score — After Mitigation</p>
          <BiasGauge score={fairness_after} level={fairnessLevel} />
          <p className={styles.gaugeNote}>DPD: {dp_difference_after}</p>
        </div>
      </div>

      {/* Metrics comparison */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Model Accuracy</p>
          <div className={styles.metricRow}>
            <span className={styles.metricVal}>{accuracy_before}%</span>
            <span className={styles.metricArrow}>→</span>
            <span className={styles.metricVal}>{accuracy_after}%</span>
            <span className={styles.metricDiff} style={{ color: metricColor(parseFloat(accuracyDiff)) }}>
              {accuracyDiff > 0 ? '+' : ''}{accuracyDiff}%
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Fairness Score</p>
          <div className={styles.metricRow}>
            <span className={styles.metricVal}>{fairness_before}%</span>
            <span className={styles.metricArrow}>→</span>
            <span className={styles.metricVal}>{fairness_after}%</span>
            <span className={styles.metricDiff} style={{ color: metricColor(parseFloat(fairnessDiff)) }}>
              {fairnessDiff > 0 ? '+' : ''}{fairnessDiff}%
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Dem. Parity Diff.</p>
          <div className={styles.metricRow}>
            <span className={styles.metricVal}>{dp_difference_before}</span>
            <span className={styles.metricArrow}>→</span>
            <span className={styles.metricVal}>{dp_difference_after}</span>
            <span className={styles.metricDiff} style={{ color: metricColor(dp_difference_before - dp_difference_after) }}>
              {dp_difference_after < dp_difference_before ? '↓ Better' : '↑ Worse'}
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Equal. Odds Diff.</p>
          <div className={styles.metricRow}>
            <span className={styles.metricVal}>{eo_difference_before}</span>
            <span className={styles.metricArrow}>→</span>
            <span className={styles.metricVal}>{eo_difference_after}</span>
            <span className={styles.metricDiff} style={{ color: metricColor(eo_difference_before - eo_difference_after) }}>
              {eo_difference_after < eo_difference_before ? '↓ Better' : '↑ Worse'}
            </span>
          </div>
        </div>
      </div>

      {/* Group comparison chart */}
      <div className={styles.card}>
        <FairnessComparisonChart
          groupMetricsBefore={group_metrics_before}
          groupMetricsAfter={group_metrics_after}
        />
      </div>

      {/* Group breakdown table */}
      <div className={styles.card}>
        <h4 className={styles.tableTitle}>Per-Group Metrics (After Mitigation)</h4>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Group</th>
                <th>Sample Size</th>
                <th>Accuracy</th>
                <th>Positive Rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(group_metrics_after).map(([group, metrics]) => (
                <tr key={group}>
                  <td>{group}</td>
                  <td>{metrics.sample_size}</td>
                  <td>{metrics.accuracy}%</td>
                  <td>{metrics.positive_prediction_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary message */}
      <div className={styles.messageCard}>
        <span className={styles.messageIcon}>📋</span>
        <p className={styles.messageText}>{message}</p>
      </div>
    </div>
  )
}
