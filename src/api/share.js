/**
 * share.js
 * Encodes/decodes result data as a compressed URL parameter
 * so analyses can be shared as a link with no backend needed.
 */

export function encodeShareData(data) {
  try {
    const json = JSON.stringify(data)
    const encoded = btoa(encodeURIComponent(json))
    return encoded
  } catch {
    return null
  }
}

export function decodeShareData(encoded) {
  try {
    const json = decodeURIComponent(atob(encoded))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function buildShareUrl(data) {
  const encoded = encodeShareData(data)
  if (!encoded) return null
  const base = window.location.origin + '/results'
  return `${base}?shared=${encoded}`
}
