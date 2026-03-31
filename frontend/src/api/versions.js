/**
 * versions.js — Bias Version Control ("git for fairness")
 * Stores named audit versions in localStorage. Computes diffs between versions.
 */

const KEY = 'fairlens_versions'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function persist(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr)) } catch {}
}

export function getVersions() { return load() }

export function saveVersion({ name, description, result }) {
  const versions = load()
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: name || `Audit v${versions.length + 1}`,
    description,
    timestamp: Date.now(),
    snapshot: {
      bias_score: result.bias_score,
      bias_level: result.bias_level,
      sensitive_column: result.sensitive_column,
      target_column: result.target_column,
      total_rows: result.total_rows,
      metrics: result.metrics,
      group_stats: result.group_stats,
      statistical_test: result.statistical_test,
      key_findings: result.key_findings,
      recommendations: result.recommendations,
    }
  }
  versions.unshift(entry)
  if (versions.length > 20) versions.splice(20)
  persist(versions)
  return entry
}

export function deleteVersion(id) {
  persist(load().filter(v => v.id !== id))
}

export function computeDiff(older, newer) {
  const scoreDelta = newer.snapshot.bias_score - older.snapshot.bias_score
  const metricDiffs = (newer.snapshot.metrics || []).map(nm => {
    const om = (older.snapshot.metrics || []).find(m => m.key === nm.key)
    if (!om) return null
    return {
      key: nm.key,
      name: nm.name,
      oldVal: om.value,
      newVal: nm.value,
      delta: nm.value - om.value,
      oldFlagged: om.flagged,
      newFlagged: nm.flagged,
    }
  }).filter(Boolean)

  const groupDiffs = (newer.snapshot.group_stats || []).map(ng => {
    const og = (older.snapshot.group_stats || []).find(g => g.group === ng.group)
    if (!og) return null
    return {
      group: ng.group,
      oldRate: og.pass_rate,
      newRate: ng.pass_rate,
      delta: ng.pass_rate - og.pass_rate,
    }
  }).filter(Boolean)

  return { scoreDelta, metricDiffs, groupDiffs }
}
