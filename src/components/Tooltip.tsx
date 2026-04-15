import { type Repo, getTempColor } from '../types'

interface TooltipProps {
  repo: Repo | null
  x: number
  y: number
}

export default function Tooltip({ repo, x, y }: TooltipProps) {
  if (!repo) return null

  // Position tooltip to avoid going off-screen
  const shiftX = x > window.innerWidth - 300 ? -260 : 20
  const shiftY = x > window.innerHeight - 200 ? -100 : 20

  const starsFormatted = repo.stars >= 1000
    ? `${(repo.stars / 1000).toFixed(1)}k`
    : String(repo.stars)

  return (
    <div
      className={`tooltip ${repo ? 'visible' : ''}`}
      style={{
        left: x + shiftX,
        top: y + shiftY,
      }}
    >
      <div className="tooltip-name">{repo.name}</div>
      <div className="tooltip-owner">
        {repo.url.replace('https://github.com/', '')}
      </div>
      {repo.description && (
        <div className="tooltip-desc">{repo.description}</div>
      )}
      <div className="tooltip-meta">
        <span className="tooltip-stars">★ {starsFormatted}</span>
        <span className="tooltip-lang">{repo.lang}</span>
        <span className="tooltip-temp" style={{ color: getTempColor(repo.temperature) }}>
          {repo.temperature}
        </span>
      </div>
    </div>
  )
}