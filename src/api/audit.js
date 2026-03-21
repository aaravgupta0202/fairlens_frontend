import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function parseCsvHeaders(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const firstLine = e.target.result.split('\n')[0]
      const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      resolve(headers)
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export async function auditDataset({
  file, targetColumn, sensitiveColumn,
  sensitiveColumn2 = null,
  modelType = 'logistic_regression',
  strategy = 'reweighing',
}) {
  const base64 = await fileToBase64(file)
  const { data } = await api.post('/audit-dataset', {
    dataset: base64,
    target_column: targetColumn,
    sensitive_column: sensitiveColumn,
    sensitive_column_2: sensitiveColumn2 || null,
    model_type: modelType,
    strategy,
  })
  return data
}

export function downloadBase64File(b64string, filename, mimeType) {
  const byteChars = atob(b64string)
  const byteNums = Array.from(byteChars, c => c.charCodeAt(0))
  const blob = new Blob([new Uint8Array(byteNums)], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
