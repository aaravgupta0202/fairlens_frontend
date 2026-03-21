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


// ── AUDIT PDF ─────────────────────────────────────────────────────────────────
export async function exportAuditToPdf(result, targetColumn, sensitiveColumn) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const MARGIN = 18, CONTENT_W = 210 - MARGIN * 2

  const riskC = { Low: C.green, Medium: C.amber, High: C.red }
  const beforeC = riskC[result.risk_label] || C.red
  const afterC  = riskC[result.risk_label_after] || C.green

  let y = header(doc, 'Dataset Fairness Audit Report',
    `Target: ${targetColumn}  |  Sensitive: ${sensitiveColumn}  |  ${result.total_rows} rows  |  Model: ${result.model_type?.replace(/_/g,' ')}  |  Strategy: ${result.strategy?.replace(/_/g,' ')}`)

  // Risk score boxes
  doc.setFillColor(...C.surface)
  doc.roundedRect(MARGIN, y, (CONTENT_W / 2) - 4, 30, 4, 4, 'F')
  doc.setFillColor(...beforeC); doc.rect(MARGIN, y, 4, 30, 'F')
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted)
  doc.text('RISK BEFORE', MARGIN + 8, y + 7)
  doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(...beforeC)
  doc.text(`${Math.round(result.risk_score)}`, MARGIN + 8, y + 21)
  doc.setFontSize(9); doc.setTextColor(...C.muted); doc.text('/ 100', MARGIN + 26, y + 21)
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...beforeC)
  doc.text(result.risk_label + ' Risk', MARGIN + 40, y + 21)

  const x2 = MARGIN + (CONTENT_W / 2) + 4
  doc.setFillColor(...C.surface)
  doc.roundedRect(x2, y, (CONTENT_W / 2) - 4, 30, 4, 4, 'F')
  doc.setFillColor(...afterC); doc.rect(x2, y, 4, 30, 'F')
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted)
  doc.text('RISK AFTER', x2 + 8, y + 7)
  doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(...afterC)
  doc.text(`${Math.round(result.risk_score_after)}`, x2 + 8, y + 21)
  doc.setFontSize(9); doc.setTextColor(...C.muted); doc.text('/ 100', x2 + 26, y + 21)
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...afterC)
  doc.text(result.risk_label_after + ' Risk', x2 + 40, y + 21)
  y += 38

  // All 5 metrics as bar chart — before & after side by side
  y = section(doc, 'Fairness Metrics — Before vs After', y, MARGIN)

  const metricKeys = [
    { key: 'demographic_parity_difference', label: 'Dem. Parity Diff',    threshold: 0.10, lowerBetter: true  },
    { key: 'equalized_odds_difference',     label: 'Equalized Odds Diff', threshold: 0.10, lowerBetter: true  },
    { key: 'disparate_impact_ratio',        label: 'Disparate Impact',    threshold: 0.80, lowerBetter: false },
    { key: 'accuracy_parity_difference',    label: 'Accuracy Parity Diff',threshold: 0.05, lowerBetter: true  },
    { key: 'selection_rate_difference',     label: 'Selection Rate Diff', threshold: 0.10, lowerBetter: true  },
  ]

  const barH = 6, barGap = 3, labelW = 42, valueW = 14, barAreaW = CONTENT_W - labelW - valueW * 2 - 8

  // Header row
  doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted)
  doc.text('METRIC', MARGIN, y)
  doc.text('BEFORE', MARGIN + labelW + barAreaW * 0.25, y)
  doc.text('AFTER', MARGIN + labelW + barAreaW * 0.75, y)
  doc.text('THRESHOLD', MARGIN + labelW + barAreaW + valueW + 2, y)
  y += 4

  metricKeys.forEach(({ key, label, threshold, lowerBetter }) => {
    const before = result.fairness_metrics_before?.[key] ?? 0
    const after  = result.fairness_metrics_after?.[key]  ?? 0
    const flagB  = result.bias_flags_before?.[key]
    const flagA  = result.bias_flags_after?.[key]

    const maxVal = lowerBetter ? Math.max(before, after, threshold * 1.5, 0.01) : 1.0
    const beforeW = Math.max(0, (before / maxVal) * (barAreaW / 2 - 3))
    const afterW  = Math.max(0, (after  / maxVal) * (barAreaW / 2 - 3))

    const beforeColor = flagB ? C.red : C.green
    const afterColor  = flagA ? C.red : C.green

    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
    doc.text(label, MARGIN, y + barH / 2 + 1.5)

    // Before bar
    doc.setFillColor(...C.surface2)
    doc.roundedRect(MARGIN + labelW, y, barAreaW / 2 - 3, barH, 1, 1, 'F')
    doc.setFillColor(...beforeColor)
    if (beforeW > 0) doc.roundedRect(MARGIN + labelW, y, beforeW, barH, 1, 1, 'F')
    doc.setFontSize(6); doc.setTextColor(...beforeColor)
    doc.text(before.toFixed(3), MARGIN + labelW + barAreaW / 2 - 2, y + barH / 2 + 1.5)

    // After bar
    const afterX = MARGIN + labelW + barAreaW / 2 + 2
    doc.setFillColor(...C.surface2)
    doc.roundedRect(afterX, y, barAreaW / 2 - 3, barH, 1, 1, 'F')
    doc.setFillColor(...afterColor)
    if (afterW > 0) doc.roundedRect(afterX, y, afterW, barH, 1, 1, 'F')
    doc.setTextColor(...afterColor)
    doc.text(after.toFixed(3), afterX + barAreaW / 2 - 2, y + barH / 2 + 1.5)

    // Threshold
    doc.setTextColor(...C.muted)
    doc.text(`${lowerBetter ? '<' : '≥'} ${threshold}`, MARGIN + labelW + barAreaW + valueW + 2, y + barH / 2 + 1.5)

    doc.setDrawColor(...C.border); doc.setLineWidth(0.3)
    doc.line(MARGIN, y + barH + barGap, MARGIN + CONTENT_W, y + barH + barGap)
    y += barH + barGap + 2
  })
  y += 4

  // Accuracy comparison bar
  y = section(doc, 'Model Accuracy', y, MARGIN)
  y = drawBarChart(doc, [
    { label: 'Before', value: result.accuracy_before, maxValue: 100, valueLabel: `${result.accuracy_before}%`, color: C.red },
    { label: 'After',  value: result.accuracy_after,  maxValue: 100, valueLabel: `${result.accuracy_after}%`,  color: C.green },
  ], MARGIN, y, CONTENT_W - 40, 0, '', MARGIN)
  y += 4

  // Per-group charts
  if (y > 180) { doc.addPage(); y = 20 }
  y = section(doc, 'Per-Group Metrics — Before Mitigation', y, MARGIN)
  y = drawGroupedBars(doc, result.group_metrics_before || {}, MARGIN, y, CONTENT_W, '')
  y += 4

  if (y > 180) { doc.addPage(); y = 20 }
  y = section(doc, 'Per-Group Metrics — After Mitigation', y, MARGIN)
  y = drawGroupedBars(doc, result.group_metrics_after || {}, MARGIN, y, CONTENT_W, '')
  y += 6

  // Gemini analysis
  if (y > 210) { doc.addPage(); y = 20 }
  y = section(doc, 'Gemini 2.5 Flash Audit Analysis', y, MARGIN)
  doc.setFillColor(...C.surface)
  const msgLines = doc.splitTextToSize(result.message || '', CONTENT_W - 8)
  const msgH = Math.min(msgLines.length * 4.8 + 12, 100)
  doc.roundedRect(MARGIN, y, CONTENT_W, msgH, 3, 3, 'F')
  doc.setFillColor(...C.primary); doc.rect(MARGIN, y, 3, msgH, 'F')
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
  doc.text(msgLines.slice(0, Math.floor(msgH / 4.8)), MARGIN + 6, y + 8)
  y += msgH + 6

  // Key insights
  if (result.insights?.length > 0) {
    if (y > 220) { doc.addPage(); y = 20 }
    y = section(doc, 'Key Insights', y, MARGIN)

    result.insights.forEach((insight, i) => {
      if (y > 258) { doc.addPage(); y = 20 }
      const iLines = doc.splitTextToSize(`${i + 1}.  ${insight}`, CONTENT_W - 10)
      const iH = iLines.length * 4.5 + 8
      doc.setFillColor(...C.surface)
      doc.roundedRect(MARGIN, y, CONTENT_W, iH, 3, 3, 'F')
      doc.setFillColor(...(i % 2 === 0 ? C.primary : C.accent))
      doc.roundedRect(MARGIN, y, 3, iH, 1, 1, 'F')
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
      doc.text(iLines, MARGIN + 6, y + 6)
      y += iH + 4
    })
  }

  addFooter(doc)
  doc.save(`FairLens_AuditReport_${Date.now()}.pdf`)
}
