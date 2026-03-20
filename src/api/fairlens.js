import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

/**
 * POST /analyse
 * @param {string} prompt - the original user prompt
 * @param {string} aiResponse - the AI response to analyse
 * @returns {Promise<AnalyseResponse>}
 */
export async function analyseText(prompt, aiResponse) {
  const { data } = await api.post('/analyse', {
    prompt,
    ai_response: aiResponse,
  })
  return data
}
