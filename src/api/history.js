/**
 * history.js
 * localStorage-based history store for past analyses.
 * Saves up to MAX_HISTORY items, most recent first.
 */

const KEY = 'fairlens_history'
const MAX_HISTORY = 20

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveToHistory(entry) {
  // entry: { id, timestamp, prompt, aiResponse, result }
  const history = getHistory()
  history.unshift(entry)
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY)
  localStorage.setItem(KEY, JSON.stringify(history))
}

export function clearHistory() {
  localStorage.removeItem(KEY)
}

export function deleteHistoryItem(id) {
  const history = getHistory().filter(h => h.id !== id)
  localStorage.setItem(KEY, JSON.stringify(history))
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
