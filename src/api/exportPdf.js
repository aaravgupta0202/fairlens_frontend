/**
 * exportPdf.js — Branded PDF exports for FairLens
 * Orange + dark grey theme, FairLens branding, charts rendered as bar visuals
 */

// ── Brand colours (used in PDF) ───────────────────────────────────────────────
const C = {
  bg:       [26, 26, 26],
  surface:  [42, 42, 42],
  surface2: [51, 51, 51],
  border:   [64, 64, 64],
  text:     [245, 240, 232],
  muted:    [160, 144, 128],
  faint:    [112, 96, 80],
  primary:  [232, 114, 12],
  accent:   [212, 150, 10],
  green:    [74, 222, 128],
  amber:    [251, 191, 36],
  red:      [248, 113, 113],
  white:    [255, 255, 255],
}

function grad(doc, x, y, w, h) {
  // Simulate gradient with two rect halves
  doc.setFillColor(...C.primary)
  doc.rect(x, y, w / 2, h, 'F')
  doc.setFillColor(...C.accent)
  doc.rect(x + w / 2, y, w / 2, h, 'F')
}

function header(doc, title, subtitle) {
  const PAGE_W = 210, MARGIN = 18
  // Dark background header
  doc.setFillColor(...C.bg)
  doc.rect(0, 0, PAGE_W, 46, 'F')
  // Orange gradient accent bar
  grad(doc, 0, 0, PAGE_W, 4)

  // Logo text
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.primary)
  doc.text('FairLens', MARGIN, 16)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.accent)
  doc.text('AI FAIRNESS AUDITING PLATFORM', MARGIN + 46, 16)

  // Title
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white)
  doc.text(title, MARGIN, 28)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted)
  doc.text(subtitle, MARGIN, 36)
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Gemini 2.5 Flash  |  Team Triple A`, MARGIN, 42)

  return 54  // starting y
}

function section(doc, title, y, MARGIN) {
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.primary)
  doc.text(title, MARGIN, y)
  doc.setDrawColor(...C.primary); doc.setLineWidth(0.5)
  doc.line(MARGIN, y + 2, 210 - MARGIN, y + 2)
  return y + 8
}

function addFooter(doc) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFillColor(...C.bg)
    doc.rect(0, 285, 210, 12, 'F')
    grad(doc, 0, 285, 210, 2)
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted)
    doc.text('FairLens by Team Triple A — Solution Challenge 2026 — Powered by Gemini 2.5 Flash', 18, 292)
    doc.text(`${i} / ${n}`, 195, 292, { align: 'right' })
  }
}

// ── Bar chart helper ──────────────────────────────────────────────────────────
function drawBarChart(doc, data, x, y, w, h, title, MARGIN) {
  // data: [{ label, value, maxValue, color }]
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text)
  doc.text(title, x, y); y += 5

  const barH = 7
  const gap = 4
  data.forEach(item => {
    const barW = Math.max(0, (item.value / (item.maxValue || 100)) * w)
    // Track
    doc.setFillColor(...C.surface2)
    doc.roundedRect(x + 30, y, w, barH, 1, 1, 'F')
    // Fill
    doc.setFillColor(...item.color)
    if (barW > 0) doc.roundedRect(x + 30, y, barW, barH, 1, 1, 'F')
    // Label
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted)
    doc.text(item.label, x, y + 5.5)
    // Value
    doc.setTextColor(...C.text)
    doc.text(item.valueLabel || String(item.value), x + 30 + w + 3, y + 5.5)
    y += barH + gap
  })
  return y + 2
}

// ── Grouped bar chart ─────────────────────────────────────────────────────────
function drawGroupedBars(doc, groups, x, y, w, title) {
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text)
  doc.text(title, x, y); y += 5

  const names = Object.keys(groups)
  if (!names.length) return y

  const barH = 6, gap = 3
  const groupGap = 10
  const maxW = w - 50

  names.forEach(group => {
    const m = groups[group]
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.primary)
    doc.text(group, x, y + 5); y += 8

    const metrics = [
      { label: 'Selection Rate', val: m.selection_rate || 0, color: C.primary },
      { label: 'Accuracy',       val: m.accuracy || 0,       color: C.accent  },
      { label: 'TPR',            val: m.tpr || 0,            color: C.green   },
      { label: 'FPR',            val: m.fpr || 0,            color: C.red     },
    ]
    metrics.forEach(({ label, val, color }) => {
      const barW = Math.max(0, val * maxW)
      doc.setFillColor(...C.surface2)
      doc.roundedRect(x + 28, y, maxW, barH, 1, 1, 'F')
      doc.setFillColor(...color)
      if (barW > 0) doc.roundedRect(x + 28, y, barW, barH, 1, 1, 'F')
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted)
      doc.text(label, x, y + 4.5)
      doc.setTextColor(...C.text)
      doc.text(`${(val * 100).toFixed(1)}%`, x + 28 + maxW + 2, y + 4.5)
      y += barH + gap
    })
    y += 3
  })
  return y
}


// ── TEXT BIAS PDF ─────────────────────────────────────────────────────────────
export async function exportToPdf(prompt, aiResponse, result) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const MARGIN = 18, CONTENT_W = 210 - MARGIN * 2

  let y = header(doc, 'Text Bias Analysis Report',
    `Prompt bias audit  |  Bias Level: ${result.bias_level}  |  Score: ${Math.round(result.bias_score)}/100`)

  // Bias score box
  const scoreColor = result.bias_level === 'Low' ? C.green : result.bias_level === 'Moderate' ? C.amber : C.red
  doc.setFillColor(...C.surface)
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 4, 4, 'F')
  doc.setFillColor(...scoreColor)
  doc.roundedRect(MARGIN, y, 50, 28, 4, 4, 'F')
  doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.bg)
  doc.text(`${Math.round(result.bias_score)}`, MARGIN + 8, y + 17)
  doc.setFontSize(9); doc.text('/ 100', MARGIN + 25, y + 17)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...scoreColor)
  doc.text(`${result.bias_level} Bias`, MARGIN + 58, y + 13)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted)
  doc.text(`Confidence: ${Math.round(result.confidence || 80)}%`, MARGIN + 58, y + 21)
  y += 36

  // Categories bar chart
  y = section(doc, 'Bias by Dimension', y, MARGIN)
  const catData = (result.categories || []).map(cat => ({
    label: cat.name,
    value: cat.score,
    maxValue: 100,
    valueLabel: `${Math.round(cat.score)}`,
    color: cat.score < 30 ? C.green : cat.score < 65 ? C.amber : C.red,
  }))
  y = drawBarChart(doc, catData, MARGIN, y, CONTENT_W - 40, 0, '', MARGIN)
  y += 4

  // Explanation
  y = section(doc, 'Root Cause Analysis', y, MARGIN)
  doc.setFillColor(...C.surface)
  const expLines = doc.splitTextToSize(result.explanation || '', CONTENT_W - 8)
  const expH = expLines.length * 5 + 12
  doc.roundedRect(MARGIN, y, CONTENT_W, expH, 3, 3, 'F')
  doc.setFillColor(...C.primary); doc.rect(MARGIN, y, 3, expH, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
  doc.text(expLines, MARGIN + 6, y + 8)
  y += expH + 6

  if (result.flagged_phrases?.length > 0) {
    y = section(doc, 'Flagged Phrases', y, MARGIN)
    result.flagged_phrases.forEach(phrase => {
      if (y > 260) { doc.addPage(); y = 20 }
      doc.setFillColor(70, 20, 20)
      const pLines = doc.splitTextToSize(`"${phrase}"`, CONTENT_W - 8)
      const ph = pLines.length * 4.5 + 6
      doc.roundedRect(MARGIN, y, CONTENT_W, ph, 2, 2, 'F')
      doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.red)
      doc.text(pLines, MARGIN + 4, y + 5)
      y += ph + 3
    })
    y += 4
  }

  if (y > 220) { doc.addPage(); y = 20 }
  y = section(doc, 'Original Prompt', y, MARGIN)
  doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.muted)
  const pLines = doc.splitTextToSize(prompt, CONTENT_W)
  doc.text(pLines, MARGIN, y); y += pLines.length * 5 + 8

  y = section(doc, 'Unbiased Rewrite', y, MARGIN)
  doc.setFillColor(20, 50, 30)
  const rwLines = doc.splitTextToSize(result.unbiased_response || '', CONTENT_W - 8)
  const rwH = rwLines.length * 5 + 10
  if (y + rwH > 270) { doc.addPage(); y = 20 }
  doc.roundedRect(MARGIN, y, CONTENT_W, rwH, 3, 3, 'F')
  doc.setFillColor(...C.green); doc.rect(MARGIN, y, 3, rwH, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
  doc.text(rwLines, MARGIN + 6, y + 8)

  addFooter(doc)
  doc.save(`FairLens_TextBias_${Date.now()}.pdf`)
}


// ── AUDIT PDF (new schema) ─────────────────────────────────────────────────────
export async function exportAuditToPdf(result, targetColumn, sensitiveColumn) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const MARGIN = 18, CONTENT_W = 210 - MARGIN * 2

  const scoreColor = result.bias_score < 30 ? C.green : result.bias_score < 60 ? C.amber : result.bias_score < 80 ? [249, 115, 22] : C.red

  let y = header(doc, 'Dataset Fairness Audit Report',
    `${result.bias_level} Bias  |  Score: ${Math.round(result.bias_score)}/100  |  ${result.total_rows} rows  |  Sensitive: ${sensitiveColumn || 'auto'}  |  Target: ${targetColumn || 'auto'}`)

  // Bias score box
  doc.setFillColor(...C.surface)
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 4, 4, 'F')
  doc.setFillColor(...scoreColor)
  doc.roundedRect(MARGIN, y, 50, 28, 4, 4, 'F')
  doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.bg)
  doc.text(`${Math.round(result.bias_score)}`, MARGIN + 8, y + 17)
  doc.setFontSize(9); doc.text('/ 100', MARGIN + 26, y + 17)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...scoreColor)
  doc.text(`${result.bias_level} Bias`, MARGIN + 58, y + 13)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted)
  doc.text(result.risk_label, MARGIN + 58, y + 22)
  y += 36

  // Fairness metrics
  y = section(doc, 'Fairness Metrics', y, MARGIN)
  const metData = (result.metrics || []).map(m => ({
    label: m.name,
    value: m.value,
    maxValue: Math.max(m.value * 1.5, m.threshold ? m.threshold * 2 : 1, 0.01),
    valueLabel: m.value.toFixed(4),
    color: m.flagged ? C.red : C.green,
  }))
  y = drawBarChart(doc, metData, MARGIN, y, CONTENT_W - 44, 0, '', MARGIN)
  y += 4

  // Group stats table
  if (result.group_stats?.length > 0) {
    if (y > 200) { doc.addPage(); y = 20 }
    y = section(doc, 'Group Statistics', y, MARGIN)
    const cols = ['Group', 'Count', 'Avg Marks', 'Pass', 'Fail', 'Pass Rate']
    const colW = [35, 18, 22, 15, 15, 25]
    let cx = MARGIN
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted)
    cols.forEach((col, i) => { doc.text(col, cx, y); cx += colW[i] })
    y += 5
    doc.setDrawColor(...C.border); doc.setLineWidth(0.3)
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y); y += 3

    result.group_stats.forEach(g => {
      if (y > 265) { doc.addPage(); y = 20 }
      cx = MARGIN
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
      const row = [g.group, String(g.count), g.avg_marks ? g.avg_marks.toFixed(1) : '—',
        String(g.pass_count), String(g.fail_count), `${(g.pass_rate * 100).toFixed(1)}%`]
      row.forEach((val, i) => {
        if (i === 5) doc.setTextColor(...(g.pass_rate > 0.7 ? C.green : g.pass_rate > 0.4 ? C.amber : C.red))
        else doc.setTextColor(...C.text)
        doc.text(val, cx, y)
        cx += colW[i]
      })
      y += 6
      doc.setDrawColor(...C.border); doc.setLineWidth(0.2)
      doc.line(MARGIN, y, MARGIN + CONTENT_W, y); y += 2
    })
    y += 4
  }

  // Subject analysis
  if (result.subject_analysis?.length > 0) {
    if (y > 200) { doc.addPage(); y = 20 }
    y = section(doc, 'Subject Analysis', y, MARGIN)
    result.subject_analysis.forEach(s => {
      if (y > 265) { doc.addPage(); y = 20 }
      doc.setFillColor(...(s.flagged ? [60,20,20] : C.surface))
      doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F')
      doc.setFillColor(...(s.flagged ? C.red : C.green)); doc.rect(MARGIN, y, 3, 10, 'F')
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...(s.flagged ? C.red : C.green))
      doc.text(s.subject, MARGIN + 6, y + 6.5)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted)
      const note = `${s.teacher ? 'Teacher '+s.teacher+' · ' : ''}Avg: ${s.avg_marks.toFixed(1)} · Pass: ${(s.pass_rate*100).toFixed(1)}%${s.bias_note ? ' · ' + s.bias_note : ''}`
      const noteLines = doc.splitTextToSize(note, CONTENT_W - 60)
      doc.text(noteLines[0] || note, MARGIN + 40, y + 6.5)
      y += 14
    })
    y += 2
  }

  // Summary
  if (y > 200) { doc.addPage(); y = 20 }
  y = section(doc, 'AI Analysis Summary', y, MARGIN)
  doc.setFillColor(...C.surface)
  const sumLines = doc.splitTextToSize(result.summary || '', CONTENT_W - 8)
  const sumH = Math.min(sumLines.length * 4.8 + 12, 80)
  doc.roundedRect(MARGIN, y, CONTENT_W, sumH, 3, 3, 'F')
  doc.setFillColor(...C.primary); doc.rect(MARGIN, y, 3, sumH, 'F')
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
  const maxSumLines = Math.floor((sumH - 8) / 4.8)
  doc.text(sumLines.slice(0, maxSumLines), MARGIN + 6, y + 8)
  y += sumH + 6

  // Key findings
  if (result.key_findings?.length > 0) {
    if (y > 210) { doc.addPage(); y = 20 }
    y = section(doc, 'Key Findings', y, MARGIN)
    result.key_findings.forEach((finding, i) => {
      if (y > 262) { doc.addPage(); y = 20 }
      const fLines = doc.splitTextToSize(`${i + 1}.  ${finding}`, CONTENT_W - 10)
      const fH = fLines.length * 4.5 + 8
      doc.setFillColor(...C.surface)
      doc.roundedRect(MARGIN, y, CONTENT_W, fH, 3, 3, 'F')
      doc.setFillColor(...(i % 2 === 0 ? C.primary : C.accent))
      doc.roundedRect(MARGIN, y, 3, fH, 1, 1, 'F')
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
      doc.text(fLines, MARGIN + 6, y + 6)
      y += fH + 4
    })
    y += 2
  }

  // Recommendations
  if (result.recommendations?.length > 0) {
    if (y > 210) { doc.addPage(); y = 20 }
    y = section(doc, 'Recommendations', y, MARGIN)
    result.recommendations.forEach((rec, i) => {
      if (y > 262) { doc.addPage(); y = 20 }
      const rLines = doc.splitTextToSize(`→  ${rec}`, CONTENT_W - 10)
      const rH = rLines.length * 4.5 + 8
      doc.setFillColor(...C.surface)
      doc.roundedRect(MARGIN, y, CONTENT_W, rH, 3, 3, 'F')
      doc.setFillColor(...C.green); doc.roundedRect(MARGIN, y, 3, rH, 1, 1, 'F')
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
      doc.text(rLines, MARGIN + 6, y + 6)
      y += rH + 4
    })
  }

  addFooter(doc)
  doc.save(`FairLens_AuditReport_${Date.now()}.pdf`)
}