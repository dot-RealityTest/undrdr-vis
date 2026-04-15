import { type Repo } from '../types'

interface LegendProps {
  repos: Repo[]
  highlightedTemp: string | null
  onHighlight: (temp: string | null) => void
}

export default function Legend({ repos, highlightedTemp, onHighlight }: LegendProps) {
  const temps = ['boss', 'hot', 'warm', 'cold'] as const
  const labels = {
    boss: 'BOSS — exceptional',
    hot: 'HOT — gaining momentum',
    warm: 'WARM — solid, niche',
    cold: 'COLD — new, no signal yet',
  }

  const counts: Record<string, number> = {}
  for (const t of temps) {
    counts[t] = repos.filter(r => r.temperature === t).length
  }

  return (
    <div className="legend">
      {temps.map(temp => (
        <div
          key={temp}
          className={`legend-item ${temp} ${highlightedTemp === temp ? 'active' : ''}`}
          onClick={() => onHighlight(highlightedTemp === temp ? null : temp)}
        >
          <div className="legend-dot" />
          <span className="legend-label">{labels[temp]}</span>
          <span className="legend-count">({counts[temp]})</span>
        </div>
      ))}
    </div>
  )
}