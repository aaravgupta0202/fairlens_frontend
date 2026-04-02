/**
 * share.js
 * Encodes/decodes result data as a URL parameter for sharing.
 */

export function encodeShareData(data) {
  try {
    const json = JSON.stringify(data)
    return btoa(encodeURIComponent(json))
  } catch { return null }
}

export function decodeShareData(encoded) {
  try {
    return { data: JSON.parse(decodeURIComponent(atob(encoded))), error: null }
  } catch {
    return { data: null, error: 'Invalid or corrupted shared link.' }
  }
}

export function buildShareUrl(dataOrAuditId, options = {}) {
  // Server-side audit ID — short link
  if (typeof dataOrAuditId === 'string' && dataOrAuditId.trim()) {
    return `${window.location.origin}/audit-results?id=${encodeURIComponent(dataOrAuditId.trim())}`
  }
  if (options.forceAuditId) return null

  const encoded = encodeShareData(dataOrAuditId)
  if (!encoded) return null

  // Detect audit vs text: audit results always have bias_level + metrics (not just bias_score)
  // The type field may not be set, so check result shape
  const isAudit = dataOrAuditId?.result?.metrics !== undefined
    || dataOrAuditId?.metrics !== undefined
    || dataOrAuditId?.type === 'audit'

  const route = isAudit ? '/audit-results' : '/results'
  return `${window.location.origin}${route}?shared=${encoded}`
}
