import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import './App.css'

type RepoStatus = 'Underrated' | 'Rising' | 'Near 1K' | 'Crossed 1K' | 'Archived/Inactive'
type SectionId = 'discover' | 'new' | 'rising' | 'near' | 'crossed' | 'topics' | 'favorites' | 'submit' | 'about'
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

type UpdateReport = {
  checkedAt: string
  checkedCount: number
  totalRepos: number
  statusCounts: Partial<Record<RepoStatus, number>>
  failures: Array<{ id: string; reason: string }>
  crossedOneK: Array<ReportRepo>
  nearOneK: Array<ReportRepo>
  rising: Array<ReportRepo>
  unavailable: Array<ReportRepo>
}

type ReportRepo = {
  full_name: string
  url: string
  stars: number
  previousStars?: number
  dailyStarDelta?: number
  weeklyStarDelta?: number
  status: RepoStatus
}

type MockSubmission = {
  repoUrl: string
  reason: string
  contact: string
  submittedAt: string
}

type MockUser = {
  name: string
}

const NAV_ITEMS: Array<{ id: SectionId; label: string }> = [
  { id: 'discover', label: 'Discover' },
  { id: 'new', label: 'New' },
  { id: 'rising', label: 'Rising' },
  { id: 'near', label: 'Near 1K' },
  { id: 'crossed', label: 'Crossed 1K' },
  { id: 'topics', label: 'Topics' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'submit', label: 'Submit' },
  { id: 'about', label: 'About' },
]

const STATUS_OPTIONS: Array<'all' | RepoStatus> = ['all', 'Underrated', 'Rising', 'Near 1K', 'Crossed 1K', 'Archived/Inactive']
type SignalIconName = 'agent' | 'mcp' | 'apple' | 'cli' | 'local' | 'automation' | 'security' | 'web' | 'data' | 'repo' | 'github'
const SIGNAL_KEY: Array<{ icon: SignalIconName; label: string }> = [
  { icon: 'agent', label: 'Agents' },
  { icon: 'local', label: 'Local AI' },
  { icon: 'apple', label: 'Apple' },
  { icon: 'cli', label: 'CLI' },
  { icon: 'web', label: 'Web' },
  { icon: 'security', label: 'Security' },
  { icon: 'data', label: 'Data' },
]

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

function normalizeSlug(value?: string) {
  return slugFromUrl(value)?.toLowerCase() || ''
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b))
}

function readStoredArray<T>(key: string) {
  if (typeof window === 'undefined') return []
  const stored = window.localStorage.getItem(key)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function readStoredUser() {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem('undrdr-mock-user')
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored)
    return typeof parsed?.name === 'string' ? parsed as MockUser : null
  } catch {
    return null
  }
}

function statusReason(status: RepoStatus) {
  if (status === 'Crossed 1K') return 'Graduated past the underrated threshold'
  if (status === 'Near 1K') return 'Close to crossing 1,000 stars'
  if (status === 'Rising') return 'Star growth or curated momentum signal'
  if (status === 'Archived/Inactive') return 'Repository appears unavailable or inactive'
  return 'Still below 1,000 stars'
}

function repoSignalIcon(repo: RepoView): SignalIconName {
  const text = [repo.displayName, repo.description, repo.language, ...repo.allTopics].join(' ').toLowerCase()
  if (/(mcp|model-context-protocol)/.test(text)) return 'mcp'
  if (/(agent|claude|codex|openclaw|multi-agent|autonomous)/.test(text)) return 'agent'
  if (/(macos|swift|swiftui|apple|ios|xcode)/.test(text)) return 'apple'
  if (/(cli|terminal|command|shell|tui)/.test(text)) return 'cli'
  if (/(local|ollama|llm|privacy|self-hosted|offline)/.test(text)) return 'local'
  if (/(automation|workflow|scheduler|pipeline)/.test(text)) return 'automation'
  if (/(security|audit|pentest|auth|vulnerability)/.test(text)) return 'security'
  if (/(react|web|frontend|next|html|css|dashboard)/.test(text)) return 'web'
  if (/(data|ml|machine-learning|analytics|rag|vector)/.test(text)) return 'data'
  return 'repo'
}

function inferStatus(repo: Repo): { label: RepoStatus; reason: string } {
  if (repo.status) return { label: repo.status, reason: statusReason(repo.status) }
  if (repo.archived || repo.disabled) return { label: 'Archived/Inactive', reason: 'Repository appears unavailable or inactive' }
  if (repo.stars >= 1000) return { label: 'Crossed 1K', reason: 'Graduated past the underrated threshold' }
  if (repo.stars >= 900) return { label: 'Near 1K', reason: 'Close to crossing 1,000 stars' }

  const daily = repo.dailyStarDelta || 0
  const weekly = repo.weeklyStarDelta || 0
  if (daily >= 3 || weekly >= 12 || repo.wave === 'rising') {
    return { label: 'Rising', reason: 'Star growth or curated momentum signal' }
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
  const [report, setReport] = useState<UpdateReport | null>(null)
  const [submissions, setSubmissions] = useState<MockSubmission[]>(() => readStoredArray<MockSubmission>('undrdr-mock-submissions'))
  const [mockUser, setMockUser] = useState<MockUser | null>(() => readStoredUser())
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readStoredArray<string>('undrdr-mock-favorites'))
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('all')
  const [topic, setTopic] = useState('all')
  const [status, setStatus] = useState<'all' | RepoStatus>('all')
  const [sort, setSort] = useState<SortMode>('curated')
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`./data/all_repos.json?v=${Date.now()}`, { cache: 'no-store' })
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

  useEffect(() => {
    fetch(`./data/update-report.json?v=${Date.now()}`, { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data: UpdateReport | null) => setReport(data))
      .catch(() => setReport(null))
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
    underOneK: repos.filter((repo) => repo.stars < 1000).length,
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
  const repoIds = useMemo(() => new Set(repos.map((repo) => repo.id)), [repos])
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const favoriteRepos = useMemo(() => repos.filter((repo) => favoriteSet.has(repo.id)), [repos, favoriteSet])
  const selectedRepo = useMemo(() => repos.find((repo) => repo.id === selectedRepoId) || null, [repos, selectedRepoId])
  const visibleRepos = useMemo(() => filtered.slice(0, 80), [filtered])
  const selectedBrowseIndex = selectedRepo ? visibleRepos.findIndex((repo) => repo.id === selectedRepo.id) : -1
  const previousRepo = selectedBrowseIndex > 0 ? visibleRepos[selectedBrowseIndex - 1] : null
  const nextRepo = selectedBrowseIndex >= 0 && selectedBrowseIndex < visibleRepos.length - 1 ? visibleRepos[selectedBrowseIndex + 1] : null
  const relatedRepos = useMemo(() => {
    if (!selectedRepo) return []
    const selectedTopics = new Set(selectedRepo.allTopics)

    return repos
      .filter((repo) => repo.id !== selectedRepo.id)
      .map((repo) => {
        const sharedTopics = repo.allTopics.filter((item) => selectedTopics.has(item)).length
        const languageMatch = repo.language && selectedRepo.language && repo.language === selectedRepo.language ? 2 : 0
        const statusMatch = repo.statusLabel === selectedRepo.statusLabel ? 1.5 : 0
        const starCloseness = Math.max(0, 1 - Math.abs(repo.stars - selectedRepo.stars) / 1000)
        return { repo, score: sharedTopics * 3 + languageMatch + statusMatch + starCloseness }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.repo.growthScore - a.repo.growthScore)
      .slice(0, 4)
      .map((item) => item.repo)
  }, [repos, selectedRepo])

  function handleMockSubmit(submission: MockSubmission) {
    const next = [submission, ...submissions].slice(0, 20)
    setSubmissions(next)
    window.localStorage.setItem('undrdr-mock-submissions', JSON.stringify(next))
  }

  function clearMockSubmissions() {
    setSubmissions([])
    window.localStorage.removeItem('undrdr-mock-submissions')
  }

  function mockSignIn() {
    const user = { name: 'Mock member' }
    setMockUser(user)
    window.localStorage.setItem('undrdr-mock-user', JSON.stringify(user))
  }

  function mockSignOut() {
    setMockUser(null)
    setFavoriteIds([])
    window.localStorage.removeItem('undrdr-mock-user')
    window.localStorage.removeItem('undrdr-mock-favorites')
  }

  function toggleFavorite(repoId: string) {
    if (!mockUser) return
    const next = favoriteSet.has(repoId) ? favoriteIds.filter((id) => id !== repoId) : [repoId, ...favoriteIds]
    setFavoriteIds(next)
    window.localStorage.setItem('undrdr-mock-favorites', JSON.stringify(next))
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#repo-index">Skip to Repository Index</a>
      <header className="site-header">
        <a className="wordmark" href="#discover" aria-label="UND-RDR home">UND-RDR</a>
        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
        </nav>
        <AuthControl user={mockUser} favoriteCount={favoriteIds.length} onSignIn={mockSignIn} onSignOut={mockSignOut} />
      </header>

      <section className="hero" id="discover">
        <div className="hero-copy">
          <h1>Discover the repos before everybody knows them.</h1>
          <p>UND-RDR tracks underrated GitHub projects before they become famous. Browse the living index by signal, topic, momentum, and distance from 1,000 stars.</p>
        </div>
        <div className="search-panel" aria-label="Repository search and filters">
          <label className="search-box">
            <span>Search the index</span>
            <input
              name="repo-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="repo, owner, language, topic…"
              autoComplete="off"
            />
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
        <Metric label="Under 1K" value={stats.underOneK} />
        <Metric label="Rising now" value={stats.rising} />
        <Metric label="Near 1K" value={stats.near} />
        <Metric label="Crossed 1K" value={stats.crossed} />
      </section>

      <SignalSystem />

      <StatusBanner loadState={loadState} duplicateCount={duplicates.length} />

      <UpdateReportPanel report={report} />

      <SectionHeader eyebrow="Featured" title="Curated Underrated Repos" detail="High-signal projects from the current dataset." />
      <RepoGrid repos={featured} favoriteIds={favoriteSet} isLoggedIn={Boolean(mockUser)} onSelectRepo={setSelectedRepoId} onToggleFavorite={toggleFavorite} emptyTitle="No featured repos yet" emptyDetail="Marked gems and strong momentum signals will appear here." />

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

      <SubmitRepoSection existingRepoIds={repoIds} submissions={submissions} onClear={clearMockSubmissions} onSubmit={handleMockSubmit} />

      <section className="favorites-section" id="favorites" aria-label="Favorite repositories">
        <div className="index-heading">
          <div>
            <p>Saved</p>
            <h2>{mockUser ? `${favoriteRepos.length} favorites` : 'Favorites require login'}</h2>
          </div>
          {!mockUser && <button className="reset-button" onClick={mockSignIn}>Mock login</button>}
        </div>
        {!mockUser && <StateBlock title="Log in to favorite repos" detail="Favorites are personal, so this mock keeps them behind a local sign-in state." />}
        {mockUser && favoriteRepos.length === 0 && <StateBlock title="No favorites yet" detail="Use the Save button on repo cards to build your personal watchlist." />}
        {mockUser && favoriteRepos.length > 0 && <RepoList repos={favoriteRepos} favoriteIds={favoriteSet} isLoggedIn={Boolean(mockUser)} onSelectRepo={setSelectedRepoId} onToggleFavorite={toggleFavorite} />}
      </section>

      <section className="index-section" id="repo-index" aria-label="Repository index">
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
        {loadState === 'ready' && filtered.length > 0 && <RepoList repos={visibleRepos} favoriteIds={favoriteSet} isLoggedIn={Boolean(mockUser)} onSelectRepo={setSelectedRepoId} onToggleFavorite={toggleFavorite} />}
      </section>

      {selectedRepo && (
        <RepoDetailPanel
          repo={selectedRepo}
          isFavorite={favoriteSet.has(selectedRepo.id)}
          isLoggedIn={Boolean(mockUser)}
          onClose={() => setSelectedRepoId(null)}
          onToggleFavorite={toggleFavorite}
          onSelectRepo={setSelectedRepoId}
          previousRepo={previousRepo}
          nextRepo={nextRepo}
          relatedRepos={relatedRepos}
        />
      )}

      <section className="about-section" id="about">
        <div>
          <p>About UND-RDR</p>
          <h2>UND-RDR tracks underrated GitHub projects before they become famous.</h2>
        </div>
        <div className="about-grid">
          <Definition title="Underrated" detail="A project still under 1,000 stars." />
          <Definition title="Rising" detail="A project with star growth or curated momentum signals." />
          <Definition title="Near 1K" detail="A project close to crossing the 1,000-star threshold." />
          <Definition title="Crossed 1K" detail="A project that graduated from underrated into wider visibility." />
        </div>
      </section>
    </main>
  )
}

function StatusBanner({ loadState, duplicateCount }: { loadState: LoadState; duplicateCount: number }) {
  if (loadState === 'loading') return <div className="status-banner" aria-live="polite">Loading repo data from the local snapshot…</div>
  if (loadState === 'error') return <div className="status-banner error" aria-live="polite">Failed GitHub update/data load. Showing no repos until the local JSON is available.</div>
  if (duplicateCount > 0) return <div className="status-banner warning" aria-live="polite">Duplicate repo detected: {duplicateCount} duplicate id group{duplicateCount === 1 ? '' : 's'} need review.</div>
  return <div className="status-banner" aria-live="polite">Fresh GitHub snapshot loaded. Daily scheduler is prepared, but not connected yet.</div>
}

function AuthControl({ user, favoriteCount, onSignIn, onSignOut }: { user: MockUser | null; favoriteCount: number; onSignIn: () => void; onSignOut: () => void }) {
  if (!user) {
    return <button className="auth-button" onClick={onSignIn}>Mock login</button>
  }

  return (
    <div className="auth-control">
      <a href="#favorites">{favoriteCount} saved</a>
      <button onClick={onSignOut}>Log out</button>
    </div>
  )
}

function UpdateReportPanel({ report }: { report: UpdateReport | null }) {
  if (!report) return null

  const topRising = report.rising.slice(0, 4)
  const crossed = report.crossedOneK.slice(0, 4)

  return (
    <section className="update-report" aria-label="Latest GitHub check">
      <div className="update-summary">
        <p>Latest Check</p>
        <h2>{formatDate(report.checkedAt)}</h2>
        <span>{formatNumber(report.checkedCount)} checked · {report.failures.length} need review · {report.statusCounts['Crossed 1K'] || 0} crossed 1K</span>
      </div>
      <ReportColumn title="Fresh Crossings" repos={crossed} empty="No new crossings in this report." />
      <ReportColumn title="Fastest Risers" repos={topRising} empty="No rising repos in this report." />
      <div className="report-issues">
        <strong>Attention</strong>
        <span>{report.failures.length ? `${report.failures.length} repos failed the GitHub check and stayed in the dataset.` : 'No GitHub check failures in the latest report.'}</span>
      </div>
    </section>
  )
}

function ReportColumn({ title, repos, empty }: { title: string; repos: ReportRepo[]; empty: string }) {
  return (
    <div className="report-column">
      <strong>{title}</strong>
      {repos.length ? repos.map((repo) => (
        <a key={repo.full_name} href={repo.url} target="_blank" rel="noreferrer">
          <span>{repo.full_name}</span>
          <em>+{formatNumber(repo.dailyStarDelta || 0)}</em>
        </a>
      )) : <span>{empty}</span>}
    </div>
  )
}

function SubmitRepoSection({ existingRepoIds, submissions, onClear, onSubmit }: { existingRepoIds: Set<string>; submissions: MockSubmission[]; onClear: () => void; onSubmit: (submission: MockSubmission) => void }) {
  const [repoUrl, setRepoUrl] = useState('')
  const [reason, setReason] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('Mock intake only. Nothing is emailed or added to the live dataset yet.')
  const slug = normalizeSlug(repoUrl)
  const isDuplicate = Boolean(slug && existingRepoIds.has(slug))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!slug) {
      setMessage('Paste a full GitHub repo URL, like https://github.com/owner/repo.')
      return
    }

    if (isDuplicate) {
      setMessage(`${slug} is already in UND-RDR. Duplicate caught before intake.`)
      return
    }

    onSubmit({
      repoUrl: `https://github.com/${slug}`,
      reason: reason.trim(),
      contact: contact.trim(),
      submittedAt: new Date().toISOString(),
    })
    setRepoUrl('')
    setReason('')
    setContact('')
    setMessage('Mock submission saved locally for review. The live dataset was not changed.')
  }

  return (
    <section className="submit-section" id="submit">
      <div className="submit-copy">
        <p>Submit</p>
        <h2>Know an underrated repo?</h2>
        <span>For now this is a local mock intake. After undrdr.com and site email are set, this can become a real submission queue.</span>
      </div>
      <form className="submit-form" onSubmit={submit}>
        <label>
          <span>GitHub repo URL</span>
          <input
            name="repo-url"
            type="url"
            inputMode="url"
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            placeholder="https://github.com/owner/repo"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          <span>Why should UND-RDR track it?</span>
          <textarea
            name="repo-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Short reason, topic, or discovery note…"
            rows={4}
            autoComplete="off"
          />
        </label>
        <label>
          <span>Contact optional</span>
          <input
            name="submitter-contact"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="email or GitHub handle…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className={`submit-note ${isDuplicate ? 'warning' : ''}`} aria-live="polite">{message}</div>
        <button type="submit">Mock submit</button>
      </form>
      <div className="submission-preview">
        <div className="queue-heading">
          <strong>Mock queue</strong>
          {submissions.length > 0 && <button type="button" onClick={onClear}>Clear</button>}
        </div>
        {submissions.length ? submissions.slice(0, 4).map((item) => (
          <a key={`${item.repoUrl}-${item.submittedAt}`} href={item.repoUrl} target="_blank" rel="noreferrer">
            <span>{normalizeSlug(item.repoUrl)}</span>
            <em>{formatDate(item.submittedAt)}</em>
          </a>
        )) : <span>No mock submissions yet.</span>}
      </div>
    </section>
  )
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

function SignalSystem() {
  return (
    <section className="signal-system" aria-label="Repository signal key">
      <span className="signal-system-label"><SignalIcon name="github" /> GitHub signal set</span>
      <div>
        {SIGNAL_KEY.map((item) => (
          <span key={item.label}>
            <SignalIcon name={item.icon} />
            {item.label}
          </span>
        ))}
      </div>
    </section>
  )
}

function RepoGrid({ repos, favoriteIds, isLoggedIn, onSelectRepo, onToggleFavorite, emptyTitle, emptyDetail }: { repos: RepoView[]; favoriteIds: Set<string>; isLoggedIn: boolean; onSelectRepo: (repoId: string) => void; onToggleFavorite: (repoId: string) => void; emptyTitle: string; emptyDetail: string }) {
  if (!repos.length) return <StateBlock title={emptyTitle} detail={emptyDetail} />
  return (
    <section className="repo-grid">
      {repos.map((repo) => (
        <RepoCard
          key={repo.id}
          repo={repo}
          isFavorite={favoriteIds.has(repo.id)}
          isLoggedIn={isLoggedIn}
          onSelectRepo={onSelectRepo}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </section>
  )
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

function RepoList({ repos, favoriteIds, isLoggedIn, onSelectRepo, onToggleFavorite }: { repos: RepoView[]; favoriteIds: Set<string>; isLoggedIn: boolean; onSelectRepo: (repoId: string) => void; onToggleFavorite: (repoId: string) => void }) {
  return (
    <div className="repo-list">
      {repos.map((repo) => (
        <RepoCard
          key={repo.id}
          repo={repo}
          compact
          isFavorite={favoriteIds.has(repo.id)}
          isLoggedIn={isLoggedIn}
          onSelectRepo={onSelectRepo}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  )
}

function RepoCard({ repo, isFavorite, isLoggedIn, onSelectRepo, onToggleFavorite, compact = false }: { repo: RepoView; isFavorite: boolean; isLoggedIn: boolean; onSelectRepo: (repoId: string) => void; onToggleFavorite: (repoId: string) => void; compact?: boolean }) {
  const favoriteLabel = isLoggedIn ? (isFavorite ? 'Saved' : 'Save') : 'Login to save'
  const favoriteAriaLabel = isLoggedIn ? `${isFavorite ? 'Remove saved repo' : 'Save repo'}: ${repo.displayName}` : `Log in to save ${repo.displayName}`
  const iconName = repoSignalIcon(repo)

  return (
    <article className={`repo-card ${compact ? 'compact' : ''}`} style={{ '--status-color': statusColor(repo.statusLabel) } as CSSProperties}>
      <div className="card-topline">
        <span className="status-badge">{!compact && <SignalIcon name={iconName} />}{repo.statusLabel}</span>
        <span className="card-actions">
          <span>{repo.language || 'Unknown'}</span>
          <button
            className={`favorite-button ${isFavorite ? 'active' : ''}`}
            type="button"
            onClick={() => onToggleFavorite(repo.id)}
            disabled={!isLoggedIn}
            title={isLoggedIn ? favoriteLabel : 'Mock login before saving favorites'}
            aria-label={favoriteAriaLabel}
          >
            {compact ? <StarIcon filled={isFavorite} /> : favoriteLabel}
          </button>
        </span>
      </div>
      <div className="repo-identity">
        <span className="repo-icon" aria-hidden="true"><SignalIcon name={iconName} /></span>
        <div>
          <button className="repo-title button-link" type="button" onClick={() => onSelectRepo(repo.id)}>{repo.displayName}</button>
          <p className="repo-owner"><SignalIcon name="github" />{repo.ownerName}/{repo.name}</p>
        </div>
      </div>
      {!compact && <p className="repo-description">{repo.description || 'No description available yet.'}</p>}
      {!compact && (
        <div className="repo-tags">
          {repo.allTopics.slice(0, 6).map((item) => <span key={item}>{item}</span>)}
        </div>
      )}
      <div className="card-footer">
        <strong>{formatNumber(repo.stars)} stars</strong>
        <span>Updated {formatDate(repo.lastUpdated)}</span>
      </div>
      {!compact && <p className="why-line">{repo.statusReason}</p>}
      <button className="details-button" type="button" onClick={() => onSelectRepo(repo.id)}>Details</button>
    </article>
  )
}

function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg className="star-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.75l2.44 4.94 5.45.79-3.94 3.84.93 5.43L12 16.18 7.12 18.75l.93-5.43-3.94-3.84 5.45-.79L12 3.75z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function SignalIcon({ name }: { name: SignalIconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const filled = { fill: 'currentColor' }

  return (
    <svg className={`signal-icon ${name === 'github' ? 'github-icon' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
      {name === 'github' && <path {...filled} d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.06c-3.08.67-3.73-1.31-3.73-1.31-.5-1.28-1.23-1.62-1.23-1.62-1-.68.08-.67.08-.67 1.11.08 1.69 1.14 1.69 1.14.99 1.69 2.59 1.2 3.22.92.1-.72.39-1.2.7-1.48-2.46-.28-5.05-1.23-5.05-5.47 0-1.21.43-2.2 1.14-2.97-.11-.28-.49-1.41.11-2.93 0 0 .93-.3 3.05 1.13A10.58 10.58 0 0 1 12 6.3c.94 0 1.88.13 2.77.38 2.12-1.43 3.05-1.13 3.05-1.13.6 1.52.22 2.65.11 2.93.71.77 1.14 1.76 1.14 2.97 0 4.25-2.59 5.18-5.06 5.46.4.35.75 1.02.75 2.06V22c0 .29.2.64.76.53A11.1 11.1 0 0 0 12 .9Z" />}
      {name === 'agent' && <><path {...common} d="M7 8h10v8H7z" /><path {...common} d="M9 8V5h6v3M9.5 11h.01M14.5 11h.01M10 14h4M4 11h3M17 11h3" /></>}
      {name === 'mcp' && <><path {...common} d="M8 7.5 12 5l4 2.5v5L12 15l-4-2.5z" /><path {...common} d="M4 16.5 8 14l4 2.5v5L8 24l-4-2.5zM12 16.5 16 14l4 2.5v5L16 24l-4-2.5z" transform="translate(0 -2)" /></>}
      {name === 'apple' && <><path {...common} d="M15 4c-.8.6-1.4 1.4-1.5 2.5M12.2 7.2c-2.7-1.4-6.2.5-6.2 4.5 0 3.8 2.7 7.3 4.4 7.3.8 0 1.1-.5 2.1-.5s1.3.5 2.1.5c1.4 0 3.4-2.7 3.4-5.2-2-.8-2.5-3.6-.4-5.1-1.1-1.4-3-1.9-5.4-1.5Z" /></>}
      {name === 'cli' && <><path {...common} d="M4 6h16v12H4zM7 10l2 2-2 2M11 14h4" /></>}
      {name === 'local' && <><path {...common} d="M12 21s7-5.3 7-11a7 7 0 0 0-14 0c0 5.7 7 11 7 11Z" /><circle {...common} cx="12" cy="10" r="2.5" /></>}
      {name === 'automation' && <><path {...common} d="M5 12a7 7 0 0 1 12-5M19 12a7 7 0 0 1-12 5" /><path {...common} d="M17 4v4h-4M7 20v-4h4" /></>}
      {name === 'security' && <><path {...common} d="M12 3 19 6v5c0 4.4-2.8 7.6-7 10-4.2-2.4-7-5.6-7-10V6z" /><path {...common} d="m9.5 12 1.8 1.8 3.5-4" /></>}
      {name === 'web' && <><circle {...common} cx="12" cy="12" r="8" /><path {...common} d="M4 12h16M12 4c2 2.2 3 4.9 3 8s-1 5.8-3 8M12 4c-2 2.2-3 4.9-3 8s1 5.8 3 8" /></>}
      {name === 'data' && <><ellipse {...common} cx="12" cy="6" rx="6" ry="3" /><path {...common} d="M6 6v6c0 1.7 2.7 3 6 3s6-1.3 6-3V6M6 12v6c0 1.7 2.7 3 6 3s6-1.3 6-3v-6" /></>}
      {name === 'repo' && <><path {...common} d="M7 4h8l3 3v13H7z" /><path {...common} d="M15 4v4h4M9.5 12h5M9.5 16h5" /></>}
    </svg>
  )
}

function RepoDetailPanel({ repo, isFavorite, isLoggedIn, onClose, onToggleFavorite, onSelectRepo, previousRepo, nextRepo, relatedRepos }: { repo: RepoView; isFavorite: boolean; isLoggedIn: boolean; onClose: () => void; onToggleFavorite: (repoId: string) => void; onSelectRepo: (repoId: string) => void; previousRepo: RepoView | null; nextRepo: RepoView | null; relatedRepos: RepoView[] }) {
  const starDelta = repo.dailyStarDelta || 0
  const weeklyDelta = repo.weeklyStarDelta || 0
  const favoriteLabel = isLoggedIn ? (isFavorite ? 'Saved' : 'Save') : 'Login to save'
  const deltaLabel = starDelta > 0 ? `+${formatNumber(starDelta)} today` : 'No new stars today'
  const iconName = repoSignalIcon(repo)

  return (
    <div className="detail-backdrop" role="presentation" onClick={onClose}>
      <aside className="repo-detail" aria-label={`${repo.displayName} details`} onClick={(event) => event.stopPropagation()}>
        <div className="detail-topline" style={{ '--status-color': statusColor(repo.statusLabel) } as CSSProperties}>
          <span className="detail-status">{repo.statusLabel}</span>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="detail-hero">
          <p><SignalIcon name="github" />{repo.ownerName}/{repo.name}</p>
          <h2><span className="detail-icon" aria-hidden="true"><SignalIcon name={iconName} /></span>{repo.displayName}</h2>
          <div className="detail-signal">
            <strong>{repo.statusReason}</strong>
            <span>{deltaLabel}</span>
          </div>
          <span className="detail-description">{repo.description || 'No description available yet.'}</span>
        </div>
        <div className="detail-actions">
          <a href={repo.repoUrl} target="_blank" rel="noreferrer"><SignalIcon name="github" />Open on GitHub</a>
          <button
            className={`favorite-button ${isFavorite ? 'active' : ''}`}
            type="button"
            onClick={() => onToggleFavorite(repo.id)}
            disabled={!isLoggedIn}
            title={isLoggedIn ? favoriteLabel : 'Mock login before saving favorites'}
          >
            {favoriteLabel}
          </button>
        </div>
        <div className="detail-metrics">
          <Metric label="Stars" value={repo.stars} />
          <Metric label="Daily delta" value={starDelta} />
          <Metric label="Weekly delta" value={weeklyDelta} />
        </div>
        <div className="detail-grid">
          <Definition title="Language" detail={repo.language || 'Unknown'} />
          <Definition title="First seen" detail={formatDate(repo.firstSeen)} />
          <Definition title="Last updated" detail={formatDate(repo.lastUpdated)} />
          <Definition title="Threshold" detail={repo.stars >= 1000 ? 'Graduated from underrated' : `${formatNumber(Math.max(0, 1000 - repo.stars))} stars from 1K`} />
        </div>
        <div className="discovery-trail" aria-label="Continue discovering repositories">
          <div className="trail-header">
            <strong>Continue Discovering</strong>
            <span>{relatedRepos.length ? 'Similar signals from the index' : 'Move through the current browse view'}</span>
          </div>
          <div className="trail-actions">
            <TrailButton label="Previous" repo={previousRepo} onSelectRepo={onSelectRepo} />
            <TrailButton label="Next" repo={nextRepo} onSelectRepo={onSelectRepo} />
          </div>
          {relatedRepos.length > 0 && (
            <div className="related-repos">
              {relatedRepos.map((related) => (
                <button key={related.id} type="button" onClick={() => onSelectRepo(related.id)} style={{ '--status-color': statusColor(related.statusLabel) } as CSSProperties}>
                  <span><SignalIcon name={repoSignalIcon(related)} />{related.statusLabel}</span>
                  <strong>{related.displayName}</strong>
                  <em><SignalIcon name="github" />{related.language || 'Unknown'} · {formatNumber(related.stars)} stars</em>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-tags">
          {repo.allTopics.length ? repo.allTopics.map((item) => <span key={item}>{item}</span>) : <span>No topics yet</span>}
        </div>
      </aside>
    </div>
  )
}

function TrailButton({ label, repo, onSelectRepo }: { label: string; repo: RepoView | null; onSelectRepo: (repoId: string) => void }) {
  return (
    <button className="trail-button" type="button" onClick={() => repo && onSelectRepo(repo.id)} disabled={!repo}>
      <span>{label}</span>
      <strong>{repo ? repo.displayName : 'End of List'}</strong>
    </button>
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
