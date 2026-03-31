/**
 * translate.js — Plain-language metric translations (Feature D)
 * Converts raw fairness numbers into human sentences for executives/HR.
 */

export function translateMetric(metric, groupStats) {
  const v = metric.value
  const groups = groupStats || []
  const maxG = groups.reduce((a, b) => a.pass_rate > b.pass_rate ? a : b, groups[0] || {})
  const minG = groups.reduce((a, b) => a.pass_rate < b.pass_rate ? a : b, groups[0] || {})

  switch (metric.key) {
    case 'demographic_parity_difference': {
      const pct = (v * 100).toFixed(1)
      if (v < 0.05) return `✓ All groups are selected at nearly the same rate — difference is just ${pct} percentage points.`
      if (minG && maxG && minG.group !== maxG.group) {
        const ratio = maxG.pass_rate > 0 ? (minG.pass_rate / maxG.pass_rate) : 0
        return `⚠ ${minG.group} is selected at ${(ratio * 100).toFixed(0)}% the rate of ${maxG.group} — a ${pct} percentage point gap.`
      }
      return `⚠ There is a ${pct} percentage point gap in selection rates between groups.`
    }
    case 'disparate_impact_ratio': {
      const pct = (v * 100).toFixed(0)
      if (v >= 0.80) return `✓ The minority group is selected at ${pct}% the rate of the majority group — above the legal 80% threshold.`
      return `⚠ The minority group is selected at only ${pct}% the rate of the majority — below the legal 4/5 rule (80% threshold). This may constitute adverse impact under employment law.`
    }
    case 'performance_gap': {
      const pct = v.toFixed(1)
      return `⚠ There is a ${pct}% average performance gap between groups, suggesting the outcome measure itself may be biased.`
    }
    case 'equalized_odds_difference': {
      const pct = (v * 100).toFixed(1)
      if (v < 0.05) return `✓ The model's true positive rate is nearly equal across groups (${pct}pp gap) — equal opportunity holds.`
      return `⚠ The model is ${pct} percentage points more likely to correctly identify positives in one group vs another — unequal opportunity.`
    }
    case 'theil_index': {
      if (v < 0.01) return `✓ Outcome inequality between groups is negligible (Theil index: ${v.toFixed(4)}).`
      if (v < 0.05) return `⚠ Moderate inequality in outcomes between groups (Theil index: ${v.toFixed(4)}).`
      return `⚠ High inequality in outcomes between groups (Theil index: ${v.toFixed(4)}) — strong redistributive intervention needed.`
    }
    default:
      return null
  }
}

export function translateScore(score, level) {
  if (score < 20) return `This system shows minimal bias — outcomes are distributed fairly across demographic groups. Suitable for deployment with standard monitoring.`
  if (score < 45) return `This system shows moderate bias that should be addressed before deployment. Some groups receive meaningfully different outcomes without a clear justification.`
  if (score < 70) return `This system shows high bias — significant disparities exist between groups. Deployment without remediation may expose your organisation to legal and reputational risk.`
  return `This system shows critical bias — outcomes are severely skewed across groups. Immediate remediation is required before any deployment. Legal liability is very high.`
}

export function translateCramersV(v, effectSize) {
  if (!v && v !== 0) return null
  if (v < 0.10) return `The relationship between the protected attribute and outcome is negligible — bias may be incidental.`
  if (v < 0.20) return `There is a small but real statistical association between the protected attribute and outcome.`
  if (v < 0.40) return `There is a medium-strength association — the protected attribute meaningfully predicts the outcome, which is a concern.`
  return `There is a strong association (V = ${v.toFixed(3)}) — the protected attribute is a powerful predictor of the outcome. This is a serious bias red flag.`
}
