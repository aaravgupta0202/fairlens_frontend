import { useTheme } from '../hooks/useTheme'
import styles from './ThemeToggle.module.css'

const OPTIONS = [
  { value: 'system', icon: '💻', label: 'System' },
  { value: 'light',  icon: '☀️', label: 'Light'  },
  { value: 'dark',   icon: '🌙', label: 'Dark'   },
]

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className={styles.toggle}>
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          className={`${styles.btn} ${theme === opt.value ? styles.active : ''}`}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
        >
          <span className={styles.icon}>{opt.icon}</span>
          <span className={styles.label}>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
