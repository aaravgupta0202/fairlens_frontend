/**
 * ChatMarkdown
 * Renders **bold** markdown in chat messages.
 * Also handles bullet points and numbered lists.
 */
export default function ChatMarkdown({ text }) {
  if (!text) return null

  // Split into lines
  const lines = text.split('\n')

  return (
    <>
      {lines.map((line, i) => {
        // Render line with inline bold (**text**)
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        const rendered = parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>
          }
          return part
        })

        // Check if bullet
        const isBullet = /^[\s]*[-•*]\s/.test(line)
        const isNumbered = /^[\s]*\d+\.\s/.test(line)
        const isEmpty = line.trim() === ''

        if (isEmpty) return <br key={i} />
        if (isBullet) return <div key={i} style={{ display: 'flex', gap: '6px', marginTop: '3px' }}><span style={{color:'var(--primary)',flexShrink:0}}>•</span><span>{rendered}</span></div>
        if (isNumbered) return <div key={i} style={{ marginTop: '3px' }}>{rendered}</div>
        return <span key={i}>{rendered}{i < lines.length - 1 ? ' ' : ''}</span>
      })}
    </>
  )
}
