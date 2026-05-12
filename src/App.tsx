import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Repo = {
  name: string
  full_name: string
  description?: string
  stars: number
  forks?: number
  language?: string | null
  topics?: string[]
  tags?: string[]
  title?: string
  url: string
  owner?: string
  license?: string | null
  updated_at?: string
  pushed_at?: string
  category?: string
  wave?: string
  is_gem?: boolean
}

type SortMode = 'signal' | 'stars' | 'updated' | 'name'
type ViewMode = 'list' | 'cards' | 'grid' | 'random'

const palette = ['#6D80A6', '#A66D80', '#80A66D', '#404040', '#8C8C8C']
const TRENDING_KEYWORDS = ['ai agents', 'mcp', 'local-first', 'macos', 'llm', 'automation', 'rust', 'cli', 'developer-tools', 'self-hosted']

const CATEGORY_COLORS: Record<string, string> = {
  'Mac Tool': '#3B82F6',
  'Apple Intelligence': '#3B82F6',
  'Apple ML': '#60A5FA',
  'MLX / Apple ML': '#60A5FA',
  'Apple NLP': '#60A5FA',
  'App Intents': '#93C5FD',
  'AI Agent': '#8B5CF6',
  'Multi-Agent': '#8B5CF6',
  'Hermes Agent': '#A78BFA',
  'Self-Evolving AI': '#A78BFA',
  'Agent Builder': '#C4B5FD',
  'Proactive Agent': '#C4B5FD',
  'Computer Use': '#8B5CF6',
  'Browser Agent': '#8B5CF6',
  'Planning': '#8B5CF6',
  'Reasoning': '#8B5CF6',
  'MCP Server': '#14B8A6',
  'Self-Hosted': '#2DD4BF',
  'Data AI': '#5EEAD4',
  'Local LLM': '#99F6E4',
  'Dev Tools': '#F97316',
  'CLI Tool': '#FB923C',
  'TUI / Terminal': '#FDBA74',
  'Tool Use': '#FED7AA',
  'Prompt Tools': '#FED7AA',
  'Productivity AI': '#FB923C',
  'AI Video': '#EC4899',
  'AI Music': '#F472B6',
  'AI + 3D': '#F9A8D4',
  'Creative Code': '#FBCFE8',
  'Design AI': '#FBCFE8',
  'Generative Art': '#FCE7F3',
  'Voice / Audio': '#F9A8D4',
  'WebGL / 3D': '#06B6D4',
  'Game Engine': '#22D3EE',
  'AR / XR': '#67E8F9',
  'Simulation': '#A5F3FC',
  'Privacy / Security': '#EF4444',
  'Security AI': '#F87171',
  'RAG / Memory': '#22C55E',
  'Vision AI': '#EAB308',
  'MoE / Mix': '#6366F1',
  'Gemma / Google': '#818CF8',
  'Experimental': '#6B7280',
  'Robotics': '#9CA3AF',
  'Unsorted': '#8C8C8C',
}

function categoryColor(category?: string) {
  return CATEGORY_COLORS[category || 'Unsorted'] || '#8C8C8C'
}

function formatNumber(value = 0) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return String(value)
}

function daysSince(date?: string) {
  if (!date) return 9999
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000))
}

function signalScore(repo: Repo) {
  const recent = Math.max(0, 365 - daysSince(repo.pushed_at || repo.updated_at))
  const lowStarBonus = repo.stars < 1000 ? 250 : 0
  const gemBonus = repo.is_gem ? 400 : 0
  return recent + lowStarBonus + gemBonus + Math.min(repo.stars, 1000) / 6
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b))
}

function App() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('all')
  const [category, setCategory] = useState('all')
  const [wave, setWave] = useState('all')
  const [sort, setSort] = useState<SortMode>('signal')
  const [active, setActive] = useState<Repo | null>(null)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('undrdr:favorites') || '[]') } catch { return [] }
  })
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [randomSeed, setRandomSeed] = useState(0)

  useEffect(() => {
    fetch('./data/all_repos.json')
      .then((res) => res.json())
      .then((data: Repo[]) => setRepos(data))
      .catch(() => setRepos([]))
  }, [])

  useEffect(() => {
    localStorage.setItem('undrdr:favorites', JSON.stringify(favorites))
  }, [favorites])

  const toggleFavorite = (repo: Repo) => {
    const key = repo.full_name || repo.url
    setFavorites((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key])
  }

  const languages = useMemo(() => uniq(repos.map((repo) => repo.language || 'Unknown')), [repos])
  const categories = useMemo(() => uniq(repos.map((repo) => repo.category || 'Unsorted')), [repos])
  const waves = useMemo(() => uniq(repos.map((repo) => repo.wave || 'unmarked')), [repos])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = repos.filter((repo) => {
      const haystack = [repo.title, repo.name, repo.full_name, repo.description, repo.language, repo.category, repo.wave, ...(repo.tags || repo.topics || [])]
        .join(' ')
        .toLowerCase()
      const key = repo.full_name || repo.url
      return (!showFavoritesOnly || favorites.includes(key))
        && (!q || haystack.includes(q))
        && (language === 'all' || (repo.language || 'Unknown') === language)
        && (category === 'all' || (repo.category || 'Unsorted') === category)
        && (wave === 'all' || (repo.wave || 'unmarked') === wave)
    })

    return list.sort((a, b) => {
      if (sort === 'stars') return b.stars - a.stars
      if (sort === 'updated') return daysSince(a.pushed_at || a.updated_at) - daysSince(b.pushed_at || b.updated_at)
      if (sort === 'name') return a.name.localeCompare(b.name)
      return signalScore(b) - signalScore(a)
    })
  }, [repos, query, language, category, wave, sort, showFavoritesOnly, favorites])

  const randomRepo = useMemo(() => {
    if (!filtered.length) return null
    return filtered[Math.abs(randomSeed) % filtered.length]
  }, [filtered, randomSeed])

  const stats = useMemo(() => ({
    total: repos.length,
    under1k: repos.filter((repo) => repo.stars < 1000).length,
    gems: repos.filter((repo) => repo.is_gem).length,
    languages: languages.length,
    favorites: favorites.length,
  }), [repos, languages.length, favorites.length])

  const topTopics = useMemo(() => {
    const counts = new Map<string, number>()
    repos.forEach((repo) => (repo.tags || repo.topics || []).forEach((topic) => counts.set(topic, (counts.get(topic) || 0) + 1)))
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 14)
  }, [repos])

  const featured = useMemo(() => filtered.slice(0, 3), [filtered])
  const trendingKeywords = useMemo(() => TRENDING_KEYWORDS.map((item) => {
    const needle = item.toLowerCase()
    const count = repos.filter((repo) => [repo.title, repo.name, repo.full_name, repo.description, repo.language, repo.category, repo.wave, ...(repo.tags || repo.topics || [])].join(' ').toLowerCase().includes(needle)).length
    return { name: item, count }
  }).sort((a, b) => b.count - a.count), [repos])

  return (
    <main className="shell">
      <nav className="topbar">
        <a className="brand" href="/">KIKA/</a>
        <span className="system">for people who think in systems</span>
        <div className="navlinks">
          <a href="/">APPS</a>
          <a href="/">ABOUT</a>
          <a href="/undrdr/">UNDRDR</a>
          <a href="/">BLOG</a>
          <a href="https://github.com/dot-RealityTest" target="_blank" rel="noreferrer">GITHUB</a>
        </div>
      </nav>

      <section className="hero">
        <div className="heroTitle">
          <p className="kicker">OPEN SOURCE / UNDER THE RADAR</p>
          <h1>UNDRDR</h1>
          <div className="heroRule" />
        </div>

      </section>

      <section className="statsGrid">
        <Stat label="repos indexed" value={stats.total} />
        <Stat label="under 1k stars" value={stats.under1k} />
        <Stat label="marked gems" value={stats.gems} />
        <Stat label="languages" value={stats.languages} />
        <Stat label={showFavoritesOnly ? "showing liked" : "favorites"} value={stats.favorites} onClick={() => setShowFavoritesOnly((value) => !value)} active={showFavoritesOnly} />
      </section>

      <section className="controls">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repo, owner, topic, language…" />
        <Select label="Language" value={language} values={languages} onChange={setLanguage} />
        <Select label="Category" value={category} values={categories} onChange={setCategory} />
        <Select label="Wave" value={wave} values={waves} onChange={setWave} />
        <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
          <option value="signal">sort / signal</option>
          <option value="stars">sort / stars</option>
          <option value="updated">sort / updated</option>
          <option value="name">sort / name</option>
        </select>
      </section>

      <section className="topics">
        <div className="topicLabel">TOPIC SIGNALS</div>
        {topTopics.map(([topic, count], index) => (
          <button key={topic} style={{ '--tone': palette[index % palette.length] } as React.CSSProperties} onClick={() => setQuery(topic)}>
            {topic}<span>{count}</span>
          </button>
        ))}
      </section>

      <section className="featureGrid">
        {featured.map((repo, index) => (
          <a className="featureCard" href={repo.url} target="_blank" rel="noreferrer" key={repo.full_name} style={{ '--cat-color': categoryColor(repo.category) } as React.CSSProperties}>
            <span className="featureIndex">0{index + 1}</span>
            <div>
              <p style={{ color: categoryColor(repo.category) }}>{repo.category || 'Hidden Gem'}</p>
              <h3>{repo.title || repo.name}</h3>
              <span>{repo.description || 'No description.'}</span>
            </div>
            <footer><strong>★ {formatNumber(repo.stars)}</strong><em>{repo.language || 'Unknown'}</em></footer>
          </a>
        ))}
      </section>

      <section className="languageStrip trendStrip">
        {trendingKeywords.map((item, index) => (
          <button key={item.name} onClick={() => setQuery(item.name)} className={query.toLowerCase() === item.name.toLowerCase() ? 'active' : ''}>
            <span>{String(index + 1).padStart(2, '0')}</span>{item.name}<b>{item.count}</b>
          </button>
        ))}
      </section>

      <section className="viewSwitch">
        {(['list', 'cards', 'grid', 'random'] as ViewMode[]).map((mode) => (
          <button key={mode} className={viewMode === mode ? 'active' : ''} onClick={() => { setViewMode(mode); if (mode === 'random') setRandomSeed(Math.floor(Math.random() * Math.max(filtered.length, 1))) }}>
            {mode}
          </button>
        ))}
        {viewMode === 'random' && <button className="shuffle" onClick={() => setRandomSeed(Math.floor(Math.random() * Math.max(filtered.length, 1)))}>shuffle</button>}
      </section>

      <section className="listHeader">
        <div><p className="kicker">LIVE FILTER</p><h2>{viewMode === 'random' ? 'RANDOM' : 'INDEX'}</h2></div>
        <p>{filtered.length} results / {showFavoritesOnly ? "liked" : sort} / {viewMode}</p>
      </section>

      {viewMode === 'random' && randomRepo ? (
        <section className="randomView">
          <article className="randomCard" style={{ '--cat-color': categoryColor(randomRepo.category) } as React.CSSProperties}>
            <p className="kicker">SURPRISE REPO</p>
            <h3>{randomRepo.title || randomRepo.name}</h3>
            <p>{randomRepo.description}</p>
            <div className="metaLine">
              <span>{randomRepo.language || 'Unknown'}</span>
              <span style={{ borderColor: categoryColor(randomRepo.category), color: categoryColor(randomRepo.category), background: categoryColor(randomRepo.category) + '18' }}>{randomRepo.category || 'Unsorted'}</span>
              <span>★ {formatNumber(randomRepo.stars)}</span>
            </div>
            <div className="randomActions">
              <a href={randomRepo.url} target="_blank" rel="noreferrer">open repo →</a>
              <button onClick={() => toggleFavorite(randomRepo)}>{favorites.includes(randomRepo.full_name || randomRepo.url) ? 'liked ♥' : 'like ♡'}</button>
              <button onClick={() => setRandomSeed(Math.floor(Math.random() * Math.max(filtered.length, 1)))}>another random</button>
            </div>
          </article>
        </section>
      ) : (
      <section className={`repoList ${viewMode}`}>
        {filtered.map((repo, index) => (
          <article key={repo.full_name} className={`repoRow ${repo.is_gem ? 'gem' : ''}`} style={{ '--cat-color': categoryColor(repo.category) } as React.CSSProperties} onMouseEnter={() => setActive(repo)} onMouseLeave={() => setActive(null)}>
            <span className="count">#{String(index + 1).padStart(3, '0')}</span>
            <span className="heat" style={{ '--score': `${Math.min(100, Math.round(signalScore(repo) / 10))}%` } as React.CSSProperties} />
            <div className="repoMain">
              <div className="titleLine">
                <a href={repo.url} target="_blank" rel="noreferrer">{repo.title || repo.name}</a>
                <button
                  className={`favorite ${favorites.includes(repo.full_name || repo.url) ? 'active' : ''}`}
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleFavorite(repo) }}
                  aria-label={favorites.includes(repo.full_name || repo.url) ? 'Remove favorite' : 'Add favorite'}
                  title={favorites.includes(repo.full_name || repo.url) ? 'Remove favorite' : 'Add favorite'}
                >♥</button>
              </div>
              <p>{repo.description || 'No description.'}</p>
              <div className="metaLine">
                <span>{repo.language || 'Unknown'}</span>
                <span className="catBadge" style={{ borderColor: categoryColor(repo.category), color: categoryColor(repo.category), background: categoryColor(repo.category) + '18' }}>{repo.category || 'Unsorted'}</span>
                <span>{(repo.tags || repo.topics || [])[0] || repo.wave || 'tagged'}</span>
              </div>
            </div>
            <div className="repoStats">
              <span>★ {formatNumber(repo.stars)}</span>
              <span>⑂ {formatNumber(repo.forks || 0)}</span>
              <span>{daysSince(repo.pushed_at || repo.updated_at)}d</span>
            </div>
          </article>
        ))}
      </section>
      )}

      <aside className={`detail ${active ? 'visible' : ''}`}>
        {active && (
          <>
            <p className="kicker">CURRENT HOVER</p>
            <h3>{active.title || active.name}</h3>
            <p>{active.description}</p>
            <div className="detailMeta">
              <span>{active.full_name}</span>
              <span>★ {formatNumber(active.stars)}</span>
              <span>{active.license || 'no license data'}</span>
              <span>{favorites.includes(active.full_name || active.url) ? 'favorited' : 'not favorited'}</span>
            </div>
          </>
        )}
      </aside>
    </main>
  )
}

function Stat({ label, value, onClick, active }: { label: string; value: number; onClick?: () => void; active?: boolean }) {
  const Tag = onClick ? 'button' : 'div'
  return <Tag className={`stat ${onClick ? 'clickable' : ''} ${active ? 'active' : ''}`} onClick={onClick as any}><strong>{formatNumber(value)}</strong><span>{label}</span></Tag>
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="all">{label} / all</option>
      {values.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  )
}

export default App
