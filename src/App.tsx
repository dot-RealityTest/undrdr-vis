import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import './App.css'

type RepoStatus = 'Underrated' | 'Rising' | 'Near 1K' | 'Crossed 1K' | 'Archived/Inactive'
type SectionId = 'discover' | 'new' | 'rising' | 'near' | 'crossed' | 'topics' | 'about'
type SortMode = 'curated' | 'stars' | 'newest' | 'rising' | 'updated' | 'closest'

type Repo = {
  name: string
  full_name: string
  description?: string
  stars: number
  previousStars?: number
  dailyStarDelta?: number
  weeklyStarDelta?: number
  language?: string | null
  topics?: string[]
  tags?: string[]
  title?: string
  url: string
  owner?: string
  license?: string | null
  updated_at?: string
  pushed_at?: string
  created_at?: string
  firstSeenAt?: string
  lastCheckedAt?: string
  lastGitHubUpdatedAt?: string
  crossedOneKAt?: string
  status?: RepoStatus
  category?: string
  wave?: string
  is_gem?: boolean
  archived?: boolean
  disabled?: boolean
}

type RepoView = Repo & {
  id: string
  displayName: string
  ownerName: string
  repoUrl: string
  statusLabel: RepoStatus
  statusReason: string
  allTopics: string[]
  lastUpdated: string | null
  firstSeen: string | null
  growthScore: number
}

type LoadState = 'loading' | 'ready' | 'error'

const NAV_ITEMS: Array<{ id: SectionId; label: string }> = [
  { id: 'discover', label: 'Discover' },
  { id: 'new', label: 'New' },
  { id: 'rising', label: 'Rising' },
  { id: 'near', label: 'Near 1K' },
  { id: 'crossed', label: 'Crossed 1K' },
  { id: 'topics', label: 'Topics' },
  { id: 'about', label: 'About' },
]

const STATUS_OPTIONS: Array<'all' | RepoStatus> = ['all', 'Underrated', 'Rising', 'Near 1K', 'Crossed 1K', 'Archived/Inactive']

function formatNumber(value = 0) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return String(value)
}

function formatDate(value?: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function daysSince(value?: string | null) {
  if (!value) return 99999
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 99999
  return Math.max(0, Math.floor((Date.now() - time) / 86400000))
}

function slugFromUrl(url?: string) {
  const match = url?.match(/github\.com\/([^/]+)\/([^/#?]+)/i)
  return match ? `${match[1]}/${match[2].replace(/\.git$/, '')}` : undefined
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b))
}

function inferStatus(repo: Repo): { label: RepoStatus; reason: string } {
  if (repo.status) return { label: repo.status, reason: 'Stored status' }
  if (repo.archived || repo.disabled) return { label: 'Archived/Inactive', reason: 'Repository appears unavailable or inactive' }
  if (repo.stars >= 1000) return { label: 'Crossed 1K', reason: 'Graduated past the underrated threshold' }
  if (repo.stars >= 900) return { label: 'Near 1K', reason: 'Close to crossing 1,000 stars' }

  const daily = repo.dailyStarDelta || 0
  const weekly = repo.weeklyStarDelta || 0
  const recent = daysSince(repo.pushed_at || repo.updated_at) <= 30
  if (daily >= 3 || weekly >= 12 || (repo.is_gem && recent) || repo.wave === 'rising') {
    return { label: 'Rising', reason: 'Recent activity or curated momentum signal' }
  }

  return { label: 'Underrated', reason: 'Still below 1,000 stars' }
}

function normalizeRepo(repo: Repo): RepoView {
  const fullName = repo.full_name || slugFromUrl(repo.url) || repo.name
  const [ownerFromName, nameFromFull] = fullName.split('/')
  const status = inferStatus(repo)
  const lastUpdated = repo.lastGitHubUpdatedAt || repo.pushed_at || repo.updated_at || null
  const firstSeen = repo.firstSeenAt || repo.created_at || null
  const growthScore = (repo.dailyStarDelta || 0) * 10 + (repo.weeklyStarDelta || 0) + Math.max(0, 45 - daysSince(lastUpdated)) + (repo.is_gem ? 20 : 0)

  return {
    ...repo,
    id: fullName.toLowerCase(),
    full_name: fullName,
    displayName: repo.title || repo.name || nameFromFull || fullName,
    ownerName: repo.owner || ownerFromName || 'unknown',
    repoUrl: repo.url,
    statusLabel: status.label,
    statusReason: status.reason,
    allTopics: Array.from(new Set([...(repo.topics || []), ...(repo.tags || []), repo.category, repo.wave].filter(Boolean) as string[])).slice(0, 8),
    lastUpdated,
    firstSeen,
    growthScore,
  }
}

function App() {
  const [repos, setRepos] = useState<RepoView[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('all')
  const [topic, setTopic] = useState('all')
  const [status, setStatus] = useState<'all' | RepoStatus>('all')
  const [sort, setSort] = useState<SortMode>('curated')

  useEffect(() => {
    fetch('./data/all_repos.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${res.status}`)
        return res.json()
      })
      .then((data: Repo[]) => {
        setRepos(data.map(normalizeRepo))
        setLoadState('ready')
      })
      .catch(() => {
        setRepos([])
        setLoadState('error')
      })
  }, [])

  const languages = useMemo(() => uniq(repos.map((repo) => repo.language || 'Unknown')), [repos])
  const topics = useMemo(() => {
    const counts = new Map<string, number>()
    repos.forEach((repo) => repo.allTopics.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1)))
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [repos])

  const duplicates = useMemo(() => {
    const counts = new Map<string, number>()
    repos.forEach((repo) => counts.set(repo.id, (counts.get(repo.id) || 0) + 1))
    return Array.from(counts.entries()).filter(([, count]) => count > 1)
  }, [repos])

  const stats = useMemo(() => ({
    total: repos.length,
    underrated: repos.filter((repo) => repo.statusLabel === 'Underrated').length,
    rising: repos.filter((repo) => repo.statusLabel === 'Rising').length,
    near: repos.filter((repo) => repo.statusLabel === 'Near 1K').length,
    crossed: repos.filter((repo) => repo.statusLabel === 'Crossed 1K').length,
  }), [repos])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = repos.filter((repo) => {
      const haystack = [
        repo.displayName,
        repo.full_name,
        repo.description,
        repo.ownerName,
        repo.language,
        repo.statusLabel,
        ...repo.allTopics,
      ].join(' ').toLowerCase()

      return (!needle || haystack.includes(needle))
        && (language === 'all' || (repo.language || 'Unknown') === language)
        && (topic === 'all' || repo.allTopics.includes(topic))
        && (status === 'all' || repo.statusLabel === status)
    })

    return list.sort((a, b) => {
      if (sort === 'stars') return b.stars - a.stars
      if (sort === 'newest') return daysSince(a.firstSeen) - daysSince(b.firstSeen)
      if (sort === 'rising') return b.growthScore - a.growthScore
      if (sort === 'updated') return daysSince(a.lastUpdated) - daysSince(b.lastUpdated)
      if (sort === 'closest') return Math.abs(1000 - b.stars) - Math.abs(1000 - a.stars)
      return b.growthScore + Math.min(b.stars, 999) / 25 - (a.growthScore + Math.min(a.stars, 999) / 25)
    })
  }, [repos, query, language, topic, status, sort])

  const featured = useMemo(() => repos.filter((repo) => repo.is_gem || repo.growthScore > 35).sort((a, b) => b.growthScore - a.growthScore).slice(0, 6), [repos])
  const newest = useMemo(() => [...repos].sort((a, b) => daysSince(a.firstSeen) - daysSince(b.firstSeen)).slice(0, 8), [repos])
  const rising = useMemo(() => repos.filter((repo) => repo.statusLabel === 'Rising').sort((a, b) => b.growthScore - a.growthScore).slice(0, 8), [repos])
  const nearOneK = useMemo(() => repos.filter((repo) => repo.statusLabel === 'Near 1K').sort((a, b) => b.stars - a.stars).slice(0, 8), [repos])
  const crossed = useMemo(() => repos.filter((repo) => repo.statusLabel === 'Crossed 1K').sort((a, b) => b.stars - a.stars).slice(0, 8), [repos])
  const trendingTopics = topics.slice(0, 14)

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="#discover" aria-label="UND-RDR home">UND-RDR</a>
        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
        </nav>
      </header>

      <section className="hero" id="discover">
        <div className="hero-copy">
          <h1>Discover the repos before everybody knows them.</h1>
          <p>UND-RDR tracks underrated GitHub projects before they become famous. Browse the living index by signal, topic, momentum, and distance from 1,000 stars.</p>
        </div>
        <div className="search-panel" aria-label="Repository search and filters">
          <label className="search-box">
            <span>Search the index</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="repo, owner, language, topic..." />
          </label>
          <div className="filter-grid">
            <Select label="Language" value={language} values={languages} onChange={setLanguage} />
            <Select label="Topic" value={topic} values={topics.map(([name]) => name)} onChange={setTopic} />
            <select value={status} onChange={(event) => setStatus(event.target.value as 'all' | RepoStatus)} aria-label="Status">
              {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item === 'all' ? 'Status / all' : item}</option>)}
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Sort">
              <option value="curated">Sort / curated</option>
              <option value="stars">Sort / stars</option>
              <option value="newest">Sort / newest</option>
              <option value="rising">Sort / rising</option>
              <option value="updated">Sort / recently updated</option>
              <option value="closest">Sort / closest to 1K</option>
            </select>
          </div>
        </div>
      </section>

      <section className="metrics" aria-label="Dataset summary">
        <Metric label="Repos tracked" value={stats.total} />
        <Metric label="Still underrated" value={stats.underrated} />
        <Metric label="Rising now" value={stats.rising} />
        <Metric label="Near 1K" value={stats.near} />
        <Metric label="Crossed 1K" value={stats.crossed} />
      </section>

      <StatusBanner loadState={loadState} duplicateCount={duplicates.length} />

      <SectionHeader eyebrow="Featured" title="Curated Underrated Repos" detail="High-signal projects from the current dataset." />
      <RepoGrid repos={featured} emptyTitle="No featured repos yet" emptyDetail="Marked gems and strong momentum signals will appear here." />

      <section className="split-sections">
        <RepoRail id="new" title="Newest Additions" repos={newest} />
        <RepoRail id="rising" title="Rising Repos" repos={rising} />
        <RepoRail id="near" title="Close To 1,000" repos={nearOneK} />
        <RepoRail id="crossed" title="Crossed 1K" repos={crossed} emptyDetail="No graduated repos are present in this snapshot yet." />
      </section>

      <section className="topics-section" id="topics">
        <SectionHeader eyebrow="Today" title="Trending Topics" detail="Topic density from the local repo index. Daily external trend discovery can plug in here later." />
        <div className="topic-grid">
          {trendingTopics.map(([name, count], index) => (
            <button key={name} onClick={() => { setTopic(name); setQuery('') }} className={topic === name ? 'active' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{name}</strong>
              <em>{count}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="index-section" aria-label="Repository index">
        <div className="index-heading">
          <div>
            <p>Live Browse</p>
            <h2>{filtered.length} repositories</h2>
          </div>
          <button className="reset-button" onClick={() => { setQuery(''); setLanguage('all'); setTopic('all'); setStatus('all'); setSort('curated') }}>Reset filters</button>
        </div>

        {loadState === 'loading' && <StateBlock title="Loading repo data" detail="Reading the local UND-RDR repository dataset." />}
        {loadState === 'error' && <StateBlock title="Could not load repo data" detail="The app could not read public/data/all_repos.json. The backup copy is preserved in backups/." />}
        {loadState === 'ready' && filtered.length === 0 && <StateBlock title="No results after filters" detail="Try a broader topic, status, or language." />}
        {loadState === 'ready' && filtered.length > 0 && <RepoList repos={filtered.slice(0, 80)} />}
      </section>

      <section className="about-section" id="about">
        <div>
          <p>About UND-RDR</p>
          <h2>UND-RDR tracks underrated GitHub projects before they become famous.</h2>
        </div>
        <div className="about-grid">
          <Definition title="Underrated" detail="A project still under 1,000 stars." />
          <Definition title="Rising" detail="A project with growth, recency, or curated momentum signals." />
          <Definition title="Near 1K" detail="A project close to crossing the 1,000-star threshold." />
          <Definition title="Crossed 1K" detail="A project that graduated from underrated into wider visibility." />
        </div>
      </section>
    </main>
  )
}

function StatusBanner({ loadState, duplicateCount }: { loadState: LoadState; duplicateCount: number }) {
  if (loadState === 'loading') return <div className="status-banner">Loading repo data from the local snapshot...</div>
  if (loadState === 'error') return <div className="status-banner error">Failed GitHub update/data load. Showing no repos until the local JSON is available.</div>
  if (duplicateCount > 0) return <div className="status-banner warning">Duplicate repo detected: {duplicateCount} duplicate id group{duplicateCount === 1 ? '' : 's'} need review.</div>
  return <div className="status-banner">Local dataset loaded. Daily GitHub updates are prepared for, but not connected yet.</div>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><strong>{formatNumber(value)}</strong><span>{label}</span></div>
}

function SectionHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="section-header">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <span>{detail}</span>
    </div>
  )
}

function RepoGrid({ repos, emptyTitle, emptyDetail }: { repos: RepoView[]; emptyTitle: string; emptyDetail: string }) {
  if (!repos.length) return <StateBlock title={emptyTitle} detail={emptyDetail} />
  return <section className="repo-grid">{repos.map((repo) => <RepoCard key={repo.id} repo={repo} />)}</section>
}

function RepoRail({ id, title, repos, emptyDetail = 'This section is ready for daily automation signals.' }: { id: SectionId; title: string; repos: RepoView[]; emptyDetail?: string }) {
  return (
    <section className="repo-rail" id={id}>
      <div className="rail-heading">
        <h3>{title}</h3>
        <span>{repos.length}</span>
      </div>
      {repos.length ? repos.map((repo) => <MiniRepo key={repo.id} repo={repo} />) : <StateBlock title="No repos yet" detail={emptyDetail} compact />}
    </section>
  )
}

function RepoList({ repos }: { repos: RepoView[] }) {
  return (
    <div className="repo-list">
      {repos.map((repo) => <RepoCard key={repo.id} repo={repo} compact />)}
    </div>
  )
}

function RepoCard({ repo, compact = false }: { repo: RepoView; compact?: boolean }) {
  return (
    <article className={`repo-card ${compact ? 'compact' : ''}`} style={{ '--status-color': statusColor(repo.statusLabel) } as CSSProperties}>
      <div className="card-topline">
        <span className="status-badge">{repo.statusLabel}</span>
        <span>{repo.language || 'Unknown'}</span>
      </div>
      <a className="repo-title" href={repo.repoUrl} target="_blank" rel="noreferrer">{repo.displayName}</a>
      <p className="repo-owner">{repo.ownerName}/{repo.name}</p>
      <p className="repo-description">{repo.description || 'No description available yet.'}</p>
      <div className="repo-tags">
        {repo.allTopics.slice(0, compact ? 4 : 6).map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="card-footer">
        <strong>{formatNumber(repo.stars)} stars</strong>
        <span>Updated {formatDate(repo.lastUpdated)}</span>
      </div>
      {!compact && <p className="why-line">{repo.statusReason}</p>}
    </article>
  )
}

function MiniRepo({ repo }: { repo: RepoView }) {
  return (
    <a className="mini-repo" href={repo.repoUrl} target="_blank" rel="noreferrer">
      <span className="mini-name">{repo.displayName}</span>
      <span>{formatNumber(repo.stars)} stars</span>
    </a>
  )
}

function Definition({ title, detail }: { title: string; detail: string }) {
  return <div className="definition"><strong>{title}</strong><span>{detail}</span></div>
}

function StateBlock({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return <div className={`state-block ${compact ? 'compact' : ''}`}><strong>{title}</strong><span>{detail}</span></div>
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="all">{label} / all</option>
      {values.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  )
}

function statusColor(status: RepoStatus) {
  if (status === 'Rising') return '#1f8a5b'
  if (status === 'Near 1K') return '#b26a00'
  if (status === 'Crossed 1K') return '#334155'
  if (status === 'Archived/Inactive') return '#8b3a3a'
  return '#2563eb'
}

export default App
