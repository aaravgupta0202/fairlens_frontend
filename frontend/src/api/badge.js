/**
 * badge.js — FairScore Badge system
 * Issues public badges stored in localStorage (same-device demo).
 * Each badge links to /badge/:id with a public audit summary.
 */

const KEY = 'fairlens_badges'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export function issueBadge(result, description) {
  const badges = load()
  const id = Math.random().toString(36).slice(2, 10)
  const badge = {
    id,
    issuedAt: Date.now(),
    description,
    score: result.bias_score,
    level: result.bias_level,
    risk_label: result.risk_label,
    sensitive_column: result.sensitive_column,
    target_column: result.target_column,
    total_rows: result.total_rows,
    metrics_flagged: (result.metrics || []).filter(m => m.flagged).length,
    metrics_total: (result.metrics || []).length,
    key_findings: (result.key_findings || []).slice(0, 3),
    cramers_v: result.statistical_test?.cramers_v,
    effect_size: result.statistical_test?.effect_size,
  }
  badges[id] = badge
  try { localStorage.setItem(KEY, JSON.stringify(badges)) } catch {}
  return badge
}

export function getBadge(id) {
  const badges = load()
  return badges[id] || null
}

export function getBadgeUrl(id) {
  return `${window.location.origin}/badge/${id}`
}
