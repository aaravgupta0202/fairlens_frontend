/**
 * exportPdf.js
 * Generates PDF reports for both text bias analysis and dataset audit results.
 */

// ── TEXT BIAS PDF ─────────────────────────────────────────────────────────────
export async function exportToPdf(prompt, aiResponse, result) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PAGE_W = 210, MARGIN = 18, CONTENT_W = PAGE_W - MARGIN * 2
  let y = 20

  const levelColor = {
    Low: [52, 211, 153], Moderate: [251, 191, 36], High: [248, 113, 113],
  }[result.bias_level] || [100, 100, 100]

  // Header
  doc.setFillColor(15, 17, 23)
  doc.rect(0, 0, PAGE_W, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20); doc.setFont('helvetica', 'bold')
  doc.text('FairLens — Text Bias Analysis Report', MARGIN, 15)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 200)
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Powered by Gemini 2.5 Flash`, MARGIN, 24)
  doc.text('Team Triple A — Solution Challenge 2026', MARGIN, 30)
  y = 46

  // Bias Score
  doc.setFillColor(...levelColor)
  doc.roundedRect(MARGIN, y, 60, 22, 4, 4, 'F')
  doc.setTextColor(15, 17, 23)
  doc.setFontSize(22); doc.setFont('helvetica', 'bold')
  doc.text(`${Math.round(result.bias_score)}`, MARGIN + 10, y + 13)
  doc.setFontSize(10); doc.text('/ 100', MARGIN + 24, y + 13)
  doc.setFontSize(14)
  doc.text(`${result.bias_level} Bias`, MARGIN + 36, y + 10)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 100)
  doc.text(`Confidence: ${Math.round(result.confidence || 80)}%`, MARGIN + 36, y + 17)
  y += 32

  // Categories
  doc.setTextColor(30, 30, 50); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('Bias by Dimension', MARGIN, y); y += 6
  result.categories.forEach(cat => {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 80)
    doc.text(cat.name, MARGIN, y + 4)
    doc.setFillColor(230, 230, 240)
    doc.roundedRect(MARGIN + 35, y, CONTENT_W - 45, 5, 1, 1, 'F')
    const barW = (cat.score / 100) * (CONTENT_W - 45)
    const bc = cat.score < 30 ? [52,211,153] : cat.score < 65 ? [251,191,36] : [248,113,113]
    doc.setFillColor(...bc)
    if (barW > 0) doc.roundedRect(MARGIN + 35, y, barW, 5, 1, 1, 'F')
    doc.setTextColor(60, 60, 80)
    doc.text(`${Math.round(cat.score)}`, MARGIN + 35 + CONTENT_W - 43, y + 4)
    y += 9
  })
  y += 6

  // Explanation
  doc.setFillColor(240, 242, 255)
  const expLines = doc.splitTextToSize(result.explanation, CONTENT_W - 6)
  const expH = expLines.length * 5 + 10
  doc.roundedRect(MARGIN, y, CONTENT_W, expH, 3, 3, 'F')
  doc.setFillColor(79, 142, 247); doc.rect(MARGIN, y, 3, expH, 'F')
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 80)
  doc.text('Root Cause Analysis', MARGIN + 6, y + 7)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 100)
  doc.text(expLines, MARGIN + 6, y + 13)
  y += expH + 8

  // Flagged phrases
  if (result.flagged_phrases?.length > 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50)
    doc.text('Flagged Phrases', MARGIN, y); y += 6
    result.flagged_phrases.forEach(phrase => {
      doc.setFillColor(255, 235, 235)
      const pLines = doc.splitTextToSize(`"${phrase}"`, CONTENT_W - 10)
      const ph = pLines.length * 5 + 6
      doc.roundedRect(MARGIN, y, CONTENT_W, ph, 2, 2, 'F')
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(180, 60, 60)
      doc.text(pLines, MARGIN + 4, y + 5); y += ph + 3
    })
    y += 4
  }

  if (y > 240) { doc.addPage(); y = 20 }

  // Original prompt
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50)
  doc.text('Original Prompt', MARGIN, y); y += 5
  doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 120)
  const pLines = doc.splitTextToSize(prompt, CONTENT_W)
  doc.text(pLines, MARGIN, y); y += pLines.length * 5 + 8

  // Unbiased rewrite
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50)
  doc.text('Unbiased Rewrite', MARGIN, y); y += 5
  doc.setFillColor(235, 255, 245)
  const rwLines = doc.splitTextToSize(result.unbiased_response, CONTENT_W - 6)
  const rwH = rwLines.length * 5 + 10
  doc.roundedRect(MARGIN, y, CONTENT_W, rwH, 3, 3, 'F')
  doc.setFillColor(52, 211, 153); doc.rect(MARGIN, y, 3, rwH, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 80, 50)
  doc.text(rwLines, MARGIN + 6, y + 7)

  _addFooter(doc)
  doc.save(`FairLens_TextBias_${Date.now()}.pdf`)
}

// ── AUDIT PDF ─────────────────────────────────────────────────────────────────
export async function exportAuditToPdf(result, targetColumn, sensitiveColumn) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const PAGE_W = 210, MARGIN = 18, CONTENT_W = PAGE_W - MARGIN * 2
  let y = 20

  const levelColors = {
    Low: [52, 211, 153], Moderate: [251, 191, 36], High: [248, 113, 113],
  }
  const biasLevelColor = levelColors[result.bias_level] || [100, 100, 100]
  const fairnessAfterLevel = result.fairness_after >= 85 ? 'Low' : result.fairness_after >= 65 ? 'Moderate' : 'High'
  const fairnessColor = levelColors[fairnessAfterLevel]

  // Header
  doc.setFillColor(15, 17, 23)
  doc.rect(0, 0, PAGE_W, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20); doc.setFont('helvetica', 'bold')
  doc.text('FairLens — Dataset Fairness Audit Report', MARGIN, 15)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 200)
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Powered by Gemini 2.5 Flash`, MARGIN, 24)
  doc.text(`Target: ${targetColumn}  |  Sensitive: ${sensitiveColumn}  |  Rows: ${result.total_rows}`, MARGIN, 30)
  doc.text('Team Triple A — Solution Challenge 2026', MARGIN, 36)
  y = 50

  // Bias banner
  doc.setFillColor(...biasLevelColor, 30)
  doc.roundedRect(MARGIN, y, CONTENT_W, 12, 3, 3, 'F')
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...biasLevelColor)
  const bannerText = result.bias_detected
    ? `${result.bias_level} bias detected before mitigation. Mitigation applied.`
    : 'Low bias detected. Model appears fair.'
  doc.text(bannerText, MARGIN + 4, y + 8)
  y += 20

  // Fairness scores side by side
  doc.setTextColor(30, 30, 50); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('Fairness Score Comparison', MARGIN, y); y += 8

  // Before box
  doc.setFillColor(248, 113, 113, 30)
  doc.roundedRect(MARGIN, y, (CONTENT_W / 2) - 4, 28, 4, 4, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 120)
  doc.text('BEFORE MITIGATION', MARGIN + 4, y + 6)
  doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor(248, 113, 113)
  doc.text(`${Math.round(result.fairness_before)}`, MARGIN + 4, y + 20)
  doc.setFontSize(10); doc.setTextColor(100, 100, 120)
  doc.text('/ 100', MARGIN + 20, y + 20)
  doc.setFontSize(8); doc.text(`DPD: ${result.dp_difference_before}`, MARGIN + 4, y + 26)

  // After box
  const x2 = MARGIN + (CONTENT_W / 2) + 4
  doc.setFillColor(...fairnessColor, 30)
  doc.roundedRect(x2, y, (CONTENT_W / 2) - 4, 28, 4, 4, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 120)
  doc.text('AFTER MITIGATION', x2 + 4, y + 6)
  doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor(...fairnessColor)
  doc.text(`${Math.round(result.fairness_after)}`, x2 + 4, y + 20)
  doc.setFontSize(10); doc.setTextColor(100, 100, 120)
  doc.text('/ 100', x2 + 20, y + 20)
  doc.setFontSize(8); doc.text(`DPD: ${result.dp_difference_after}`, x2 + 4, y + 26)
  y += 36

  // Metrics grid
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50)
  doc.text('Key Metrics', MARGIN, y); y += 6

  const metrics = [
    ['Model Accuracy', `${result.accuracy_before}%`, `${result.accuracy_after}%`],
    ['Fairness Score', `${result.fairness_before}%`, `${result.fairness_after}%`],
    ['Dem. Parity Diff.', `${result.dp_difference_before}`, `${result.dp_difference_after}`],
    ['Equal. Odds Diff.', `${result.eo_difference_before}`, `${result.eo_difference_after}`],
  ]

  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 130)
  doc.text('METRIC', MARGIN, y); doc.text('BEFORE', MARGIN + 70, y); doc.text('AFTER', MARGIN + 110, y)
  doc.setDrawColor(46, 51, 80); doc.line(MARGIN, y + 2, MARGIN + CONTENT_W, y + 2)
  y += 6

  metrics.forEach(([label, before, after]) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 80)
    doc.text(label, MARGIN, y)
    doc.setTextColor(248, 113, 113); doc.text(before, MARGIN + 70, y)
    doc.setTextColor(52, 211, 153); doc.text(after, MARGIN + 110, y)
    doc.setDrawColor(46, 51, 80, 50); doc.line(MARGIN, y + 2, MARGIN + CONTENT_W, y + 2)
    y += 7
  })
  y += 4

  // Per-group table
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50)
  doc.text('Per-Group Metrics (After Mitigation)', MARGIN, y); y += 6

  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 130)
  doc.text('GROUP', MARGIN, y); doc.text('SAMPLE SIZE', MARGIN + 50, y)
  doc.text('ACCURACY', MARGIN + 100, y); doc.text('POSITIVE RATE', MARGIN + 140, y)
  doc.line(MARGIN, y + 2, MARGIN + CONTENT_W, y + 2)
  y += 6

  Object.entries(result.group_metrics_after).forEach(([group, m]) => {
    if (y > 260) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 80)
    doc.text(String(group), MARGIN, y)
    doc.text(String(m.sample_size), MARGIN + 50, y)
    doc.text(`${m.accuracy}%`, MARGIN + 100, y)
    doc.text(`${m.positive_prediction_rate}%`, MARGIN + 140, y)
    doc.setDrawColor(46, 51, 80, 30); doc.line(MARGIN, y + 2, MARGIN + CONTENT_W, y + 2)
    y += 7
  })
  y += 6

  if (y > 220) { doc.addPage(); y = 20 }

  // Gemini explanation
  doc.setFillColor(240, 242, 255)
  const msgLines = doc.splitTextToSize(result.message, CONTENT_W - 6)
  const msgH = msgLines.length * 5 + 14
  doc.roundedRect(MARGIN, y, CONTENT_W, msgH, 3, 3, 'F')
  doc.setFillColor(79, 142, 247); doc.rect(MARGIN, y, 3, msgH, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 80)
  doc.text('Gemini 2.5 Flash Analysis', MARGIN + 6, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 100); doc.setFontSize(8)
  doc.text(msgLines, MARGIN + 6, y + 12)

  _addFooter(doc)
  doc.save(`FairLens_AuditReport_${Date.now()}.pdf`)
}

function _addFooter(doc) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(160, 160, 180)
    doc.text('FairLens by Team Triple A — Solution Challenge 2026', 18, 292)
    doc.text(`Page ${i} of ${pageCount}`, 210 - 18 - 15, 292)
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// AUDIT PDF EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function exportAuditToPdf({ result, targetColumn, sensitiveColumn }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const PAGE_W = 210
  const MARGIN = 18
  const CONTENT_W = PAGE_W - MARGIN * 2
  let y = 20

  const levelColor = {
    Low:      [52, 211, 153],
    Moderate: [251, 191, 36],
    High:     [248, 113, 113],
  }[result.bias_level] || [100, 100, 100]

  const fairColor = result.fairness_after >= 85
    ? [52, 211, 153] : result.fairness_after >= 65
    ? [251, 191, 36] : [248, 113, 113]

  // ── Header ──
  doc.setFillColor(15, 17, 23)
  doc.rect(0, 0, PAGE_W, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('FairLens Dataset Fairness Audit Report', MARGIN, 15)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 200)
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Powered by Gemini 2.5 Flash`, MARGIN, 24)
  doc.text('Team Triple A — Solution Challenge 2026', MARGIN, 30)
  y = 46

  // ── Dataset info ──
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 50)
  doc.text('Dataset Overview', MARGIN, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 90)
  doc.text(`Target Column: ${targetColumn}`, MARGIN, y); y += 5
  doc.text(`Sensitive Attribute: ${sensitiveColumn}`, MARGIN, y); y += 5
  doc.text(`Total Rows: ${result.total_rows}  |  Features: ${result.feature_columns?.length ?? '-'}`, MARGIN, y)
  y += 10

  // ── Bias level badge ──
  doc.setFillColor(...levelColor)
  doc.roundedRect(MARGIN, y, 60, 14, 3, 3, 'F')
  doc.setTextColor(15, 17, 23)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`${result.bias_level} Bias Detected`, MARGIN + 4, y + 9)
  y += 22

  // ── Fairness scores side by side ──
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 50)
  doc.text('Fairness Score Comparison', MARGIN, y); y += 6

  // Before box
  doc.setFillColor(248, 113, 113)
  doc.roundedRect(MARGIN, y, (CONTENT_W / 2) - 4, 20, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(`${Math.round(result.fairness_before)}`, MARGIN + 8, y + 13)
  doc.setFontSize(9)
  doc.text('/ 100  Before', MARGIN + 22, y + 13)

  // After box
  const afterX = MARGIN + (CONTENT_W / 2) + 4
  doc.setFillColor(...fairColor)
  doc.roundedRect(afterX, y, (CONTENT_W / 2) - 4, 20, 3, 3, 'F')
  doc.setTextColor(15, 17, 23)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(`${Math.round(result.fairness_after)}`, afterX + 8, y + 13)
  doc.setFontSize(9)
  doc.text('/ 100  After Mitigation', afterX + 22, y + 13)
  y += 28

  // ── Metrics table ──
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 50)
  doc.text('Key Metrics', MARGIN, y); y += 6

  const metrics = [
    ['Model Accuracy', `${result.accuracy_before}%`, `${result.accuracy_after}%`],
    ['Fairness Score', `${result.fairness_before}%`, `${result.fairness_after}%`],
    ['Demographic Parity Diff.', `${result.dp_difference_before}`, `${result.dp_difference_after}`],
    ['Equalized Odds Diff.', `${result.eo_difference_before}`, `${result.eo_difference_after}`],
  ]

  const col1 = MARGIN, col2 = MARGIN + 90, col3 = MARGIN + 130
  doc.setFillColor(26, 29, 39)
  doc.rect(MARGIN, y, CONTENT_W, 7, 'F')
  doc.setTextColor(79, 142, 247)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Metric', col1 + 2, y + 5)
  doc.text('Before', col2, y + 5)
  doc.text('After', col3, y + 5)
  y += 7

  metrics.forEach((row, i) => {
    doc.setFillColor(i % 2 === 0 ? 15 : 19, 17, 23)
    doc.rect(MARGIN, y, CONTENT_W, 7, 'F')
    doc.setTextColor(200, 200, 220)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(row[0], col1 + 2, y + 5)
    doc.text(row[1], col2, y + 5)
    doc.text(row[2], col3, y + 5)
    y += 7
  })
  y += 8

  // ── Per-group table ──
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 50)
  doc.text('Per-Group Metrics (After Mitigation)', MARGIN, y); y += 6

  const groups = Object.entries(result.group_metrics_after)
  doc.setFillColor(26, 29, 39)
  doc.rect(MARGIN, y, CONTENT_W, 7, 'F')
  doc.setTextColor(79, 142, 247)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Group', MARGIN + 2, y + 5)
  doc.text('Sample Size', MARGIN + 50, y + 5)
  doc.text('Accuracy', MARGIN + 95, y + 5)
  doc.text('Positive Rate', MARGIN + 135, y + 5)
  y += 7

  groups.forEach(([group, m], i) => {
    if (y > 260) { doc.addPage(); y = 20 }
    doc.setFillColor(i % 2 === 0 ? 15 : 19, 17, 23)
    doc.rect(MARGIN, y, CONTENT_W, 7, 'F')
    doc.setTextColor(200, 200, 220)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(String(group), MARGIN + 2, y + 5)
    doc.text(String(m.sample_size), MARGIN + 50, y + 5)
    doc.text(`${m.accuracy}%`, MARGIN + 95, y + 5)
    doc.text(`${m.positive_prediction_rate}%`, MARGIN + 135, y + 5)
    y += 7
  })
  y += 8

  // ── Gemini explanation ──
  if (y > 220) { doc.addPage(); y = 20 }
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 50)
  doc.text('Gemini 2.5 Flash Analysis', MARGIN, y); y += 5

  doc.setFillColor(240, 242, 255)
  const msgLines = doc.splitTextToSize(result.message, CONTENT_W - 8)
  const msgH = msgLines.length * 5 + 10
  doc.roundedRect(MARGIN, y, CONTENT_W, msgH, 3, 3, 'F')
  doc.setFillColor(79, 142, 247)
  doc.rect(MARGIN, y, 3, msgH, 'F')
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 80)
  doc.text(msgLines, MARGIN + 6, y + 7)
  y += msgH + 8

  // ── Footer ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 180)
    doc.text('FairLens by Team Triple A — Solution Challenge 2026', MARGIN, 292)
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN - 15, 292)
  }

  doc.save(`FairLens_Audit_Report_${Date.now()}.pdf`)
}
