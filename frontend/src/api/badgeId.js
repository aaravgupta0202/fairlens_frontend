/**
 * badgeId.js — deterministic badge/report ID generator
 * Same audit result always produces the same ID.
 * Used by BadgeModal (badge link) AND exportPdf (EU report hash).
 */
export function generateBadgeId(result) {
  const seed = [
    result?.bias_score ?? 0,
    result?.bias_level ?? '',
    result?.sensitive_column ?? '',
    result?.target_column ?? '',
    result?.total_rows ?? 0,
  ].join('|')
  let hash = 5381
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i)
    hash = hash >>> 0  // keep unsigned 32-bit
  }
  return 'FL-' + hash.toString(36).toUpperCase().padStart(7, '0')
}
