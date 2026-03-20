/**
 * exportPdf.js
 * Generates a clean PDF report using jsPDF.
 * No external server needed — runs entirely in browser.
 */

export async function exportToPdf(prompt, aiResponse, result) {
  // Dynamically import jsPDF to keep bundle size small
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const PAGE_W = 210
  const MARGIN = 18
  const CONTENT_W = PAGE_W - MARGIN * 2
  let y = 20

  const levelColor = {
    Low: [52, 211, 153],
    Moderate: [251, 191, 36],
    High: [248, 113, 113],
  }[result.bias_level] || [100, 100, 100]

  // ── Header ──────────────────────────────────────────
  doc.setFillColor(15, 17, 23)
  doc.rect(0, 0, PAGE_W, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('FairLens Bias Analysis Report', MARGIN, 15)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 200)
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Powered by Gemini 2.5 Flash`, MARGIN, 24)
  doc.text('Team Triple A — Solution Challenge 2026', MARGIN, 30)
  y = 46

  // ── Bias Score ──────────────────────────────────────
  doc.setFillColor(...levelColor)
  doc.roundedRect(MARGIN, y, 60, 22, 4, 4, 'F')
  doc.setTextColor(15, 17, 23)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(`${Math.round(result.bias_score)}`, MARGIN + 10, y + 13)
  doc.setFontSize(10)
  doc.text('/ 100', MARGIN + 24, y + 13)

  doc.setTextColor(15, 17, 23)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${result.bias_level} Bias`, MARGIN + 36, y + 10)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 100)
  doc.text(`Confidence: ${Math.round(result.confidence)}%`, MARGIN + 36, y + 17)
  y += 32

  // ── Categories ──────────────────────────────────────
  doc.setTextColor(30, 30, 50)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Bias by Dimension', MARGIN, y)
  y += 6

  result.categories.forEach(cat => {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 80)
    doc.text(cat.name, MARGIN, y + 4)

    // Bar track
    doc.setFillColor(230, 230, 240)
    doc.roundedRect(MARGIN + 35, y, CONTENT_W - 45, 5, 1, 1, 'F')

    // Bar fill
    const barW = ((cat.score / 100) * (CONTENT_W - 45))
    const barColor = cat.score < 30 ? [52, 211, 153] : cat.score < 65 ? [251, 191, 36] : [248, 113, 113]
    doc.setFillColor(...barColor)
    if (barW > 0) doc.roundedRect(MARGIN + 35, y, barW, 5, 1, 1, 'F')

    doc.setTextColor(60, 60, 80)
    doc.text(`${Math.round(cat.score)}`, MARGIN + 35 + CONTENT_W - 43, y + 4)
    y += 9
  })
  y += 6

  // ── Explanation ─────────────────────────────────────
  doc.setFillColor(240, 242, 255)
  const explanationLines = doc.splitTextToSize(result.explanation, CONTENT_W - 6)
  const explH = explanationLines.length * 5 + 10
  doc.roundedRect(MARGIN, y, CONTENT_W, explH, 3, 3, 'F')
  doc.setFillColor(79, 142, 247)
  doc.rect(MARGIN, y, 3, explH, 'F')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 80)
  doc.text('Root Cause Analysis', MARGIN + 6, y + 7)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 100)
  doc.text(explanationLines, MARGIN + 6, y + 13)
  y += explH + 8

  // ── Flagged Phrases ──────────────────────────────────
  if (result.flagged_phrases?.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 50)
    doc.text('Flagged Phrases', MARGIN, y)
    y += 6
    result.flagged_phrases.forEach(phrase => {
      doc.setFillColor(255, 235, 235)
      const phraseLines = doc.splitTextToSize(`"${phrase}"`, CONTENT_W - 10)
      const ph = phraseLines.length * 5 + 6
      doc.roundedRect(MARGIN, y, CONTENT_W, ph, 2, 2, 'F')
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(180, 60, 60)
      doc.text(phraseLines, MARGIN + 4, y + 5)
      y += ph + 3
    })
    y += 4
  }

  // New page if needed
  if (y > 240) { doc.addPage(); y = 20 }

  // ── Original Prompt ──────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 50)
  doc.text('Original Prompt', MARGIN, y)
  y += 5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(80, 80, 120)
  const promptLines = doc.splitTextToSize(prompt, CONTENT_W)
  doc.text(promptLines, MARGIN, y)
  y += promptLines.length * 5 + 8

  // ── Unbiased Rewrite ─────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 50)
  doc.text('Unbiased Rewrite', MARGIN, y)
  y += 5
  doc.setFillColor(235, 255, 245)
  const rewriteLines = doc.splitTextToSize(result.unbiased_response, CONTENT_W - 6)
  const rwH = rewriteLines.length * 5 + 10
  doc.roundedRect(MARGIN, y, CONTENT_W, rwH, 3, 3, 'F')
  doc.setFillColor(52, 211, 153)
  doc.rect(MARGIN, y, 3, rwH, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(20, 80, 50)
  doc.text(rewriteLines, MARGIN + 6, y + 7)

  // ── Footer ───────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 180)
    doc.text('FairLens by Team Triple A — Solution Challenge 2026', MARGIN, 292)
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN - 15, 292)
  }

  doc.save(`FairLens_Report_${Date.now()}.pdf`)
}
