import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Reads a File object and returns its base64-encoded content.
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // result is "data:text/csv;base64,XXXX" — send full string, backend strips prefix
      resolve(reader.result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Parses CSV headers from a File without uploading.
 * Used to populate the column selector dropdowns.
 */
export function parseCsvHeaders(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const firstLine = text.split('\n')[0]
      const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      resolve(headers)
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

/**
 * POST /audit-dataset
 */
export async function auditDataset(file, targetColumn, sensitiveColumn) {
  const base64 = await fileToBase64(file)
  const { data } = await api.post('/audit-dataset', {
    dataset: base64,
    target_column: targetColumn,
    sensitive_column: sensitiveColumn,
  })
  return data
}
