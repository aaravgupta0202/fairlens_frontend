import {
  RadarChart as ReRadar, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import styles from './RadarChart.module.css'

/**
 * Radar chart comparing per-group metrics.
 * groupMetrics: { groupName: { selection_rate, accuracy, tpr, fpr, precision } }
 */

const COLORS = ['#4f8ef7', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#fb923c']

const METRIC_KEYS = [
  { key: 'selection_rate', label: 'Selection Rate' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'tpr', label: 'True Positive Rate' },
  { key: 'precision', label: 'Precision' },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey}: {(p.value * 100).toFixed(1)}%
        </p>
      ))}
    </div>
  )
}

export default function RadarChart({ groupMetrics, title = 'Per-Group Metrics Radar' }) {
  const groups = Object.keys(groupMetrics)

  const data = METRIC_KEYS.map(({ key, label }) => {
    const entry = { metric: label }
    groups.forEach(g => {
      entry[g] = groupMetrics[g]?.[key] ?? 0
    })
    return entry
  })

  return (
    <div className={styles.wrapper}>
      <h4 className={styles.title}>{title}</h4>
      <ResponsiveContainer width="100%" height={300}>
        <ReRadar cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={30} domain={[0, 1]}
            tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
            tickFormatter={v => `${(v * 100).toFixed(0)}%`}
          />
          {groups.map((group, i) => (
            <Radar
              key={group}
              dataKey={group}
              data={data}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.2}
              name={group}
            />
          ))}
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '8px' }}
          />
        </ReRadar>
      </ResponsiveContainer>
    </div>
  )
}
