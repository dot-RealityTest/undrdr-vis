import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import './App.css'

type RepoStatus = 'Underrated' | 'Rising' | 'Near 1K' | 'Crossed 1K' | 'Archived/Inactive'
type RouteId = 'discover' | 'collections' | 'submit' | 'watchlist' | 'data' | 'about'
type LaneId = 'all' | 'fresh' | 'rising' | 'hidden' | 'near' | 'graduated'
type SortMode = 'curated' | 'stars' | 'newest' | 'rising' | 'updated' | 'closest'
type LoadState = 'loading' | 'ready' | 'error'
type IconName = 'target' | 'repo' | 'star' | 'github' | 'search' | 'spark' | 'rise' | 'near' | 'graduate' | 'code' | 'globe' | 'pin' | 'refresh' | 'mail' | 'close' | 'arrow' | 'bars'

type Repo = {
  name: string
  full_name?: string
  description?: string
  stars: number
  previousStars?: number
  dailyStarDelta?: number
  weeklyStarDelta?: number
  forks?: number
  language?: string | null
  topics?: string[]
  tags?: string[]
  title?: string
  url?: string
  repoUrl?: string
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
  unavailable?: boolean
  unavailableReason?: string
  submittedFromIssue?: string
  submittedReason?: string
}

type RepoView = Repo & {
  id: string
  displayName: string
  ownerName: string
  name: string
  fullName: string
  repoUrl: string
  statusLabel: RepoStatus
  statusReason: string
  lane: LaneId
  allTopics: string[]
  lastUpdated: string | null
  firstSeen: string | null
  growthScore: number
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

type UpdateReport = {
  checkedAt: string
  checkedCount: number
  totalRepos: number
  statusCounts: Partial<Record<RepoStatus, number>>
  failures: Array<{ id: string; reason: string }>
  crossedOneK: ReportRepo[]
  nearOneK: ReportRepo[]
  rising: ReportRepo[]
  unavailable: ReportRepo[]
}

type SubmissionReceipt = {
  id?: string
  repoUrl: string
  reason: string
  contact: string
  submittedAt: string
  delivery?: 'github-issue' | 'webhook' | 'email' | 'validated-only' | 'local'
  reviewUrl?: string | null
}

type SubmitResponse = {
  ok: boolean
  message?: string
  error?: string
  delivery?: SubmissionReceipt['delivery']
  reviewUrl?: string | null
  submission?: {
    id: string
    repoUrl: string
    reason: string
    contact: string
    submittedAt: string
  }
}

type MockUser = {
  name: string
}

type SiteConfig = {
  siteUrl: string
  activeHost: string
  targetDomain: string
  siteEmail: string
}

const NAV_ITEMS: Array<{ id: RouteId; label: string }> = [
  { id: 'discover', label: 'Discover' },
  { id: 'collections', label: 'Collections' },
  { id: 'submit', label: 'Submit' },
  { id: 'about', label: 'About' },
]

const LANES: Array<{ id: LaneId; label: string; hint: string; icon: IconName }> = [
  { id: 'all', label: 'All', hint: 'full index', icon: 'target' },
  { id: 'fresh', label: 'Fresh', hint: 'new finds', icon: 'spark' },
  { id: 'rising', label: 'Rising', hint: 'momentum', icon: 'rise' },
  { id: 'hidden', label: 'Hidden', hint: 'under 500', icon: 'pin' },
  { id: 'near', label: 'Near 1K', hint: 'almost', icon: 'near' },
  { id: 'graduated', label: 'Graduated', hint: 'crossed', icon: 'graduate' },
]

const STATUS_OPTIONS: Array<'all' | RepoStatus> = ['all', 'Underrated', 'Rising', 'Near 1K', 'Crossed 1K', 'Archived/Inactive']

const SITE_CONFIG: SiteConfig = {
  siteUrl: normalizeSiteUrl(import.meta.env.VITE_SITE_URL),
  activeHost: hostFromUrl(normalizeSiteUrl(import.meta.env.VITE_SITE_URL)),
  targetDomain: import.meta.env.VITE_TARGET_DOMAIN || 'undrdr.com',
  siteEmail: import.meta.env.VITE_SITE_EMAIL || 'submit@undrdr.com',
}

function normalizeSiteUrl(value?: string) {
  const fallback = 'https://undrdr.com/'
  const raw = value?.trim() || fallback
  return raw.endsWith('/') ? raw : `${raw}/`
}

function hostFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  }
}

function submissionMailto(siteEmail: string) {
  const subject = encodeURIComponent('UND-RDR repo submission')
  const body = encodeURIComponent(['GitHub repo URL:', '', 'Why should UND-RDR track it?', '', 'Your contact:'].join('\n'))
  return `mailto:${siteEmail}?subject=${subject}&body=${body}`
}

function readHashParts(): { route: RouteId; lane: LaneId } {
  if (typeof window === 'undefined') return { route: 'discover', lane: 'all' }
  const raw = window.location.hash.replace(/^#\/?/, '').trim()
  if (raw === 'topics') return { route: 'collections', lane: 'all' }
  if (raw === 'favorites') return { route: 'watchlist', lane: 'all' }
  if (raw === 'new') return { route: 'discover', lane: 'fresh' }
  if (raw === 'rising') return { route: 'discover', lane: 'rising' }
  if (raw === 'near') return { route: 'discover', lane: 'near' }
  if (raw === 'crossed') return { route: 'discover', lane: 'graduated' }
  if (raw === 'browse' || raw === 'repo-index') return { route: 'discover', lane: 'all' }

  const [routeRaw, laneRaw] = raw.split('/')
  const route = isRoute(routeRaw) ? routeRaw : 'discover'
  const lane = isLane(laneRaw) ? laneRaw : 'all'
  return { route, lane }
}

function isRoute(value?: string): value is RouteId {
  return value === 'discover' || value === 'collections' || value === 'submit' || value === 'watchlist' || value === 'data' || value === 'about'
}

function isLane(value?: string): value is LaneId {
  return value === 'all' || value === 'fresh' || value === 'rising' || value === 'hidden' || value === 'near' || value === 'graduated'
}

function writeHash(route: RouteId, lane?: LaneId) {
  if (typeof window === 'undefined') return
  const next = lane && route === 'discover' ? `#/${route}/${lane}` : `#/${route}`
  if (window.location.hash === next) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  window.location.hash = next
}

function formatNumber(value = 0) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return String(value)
}

function formatDate(value?: string | null) {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
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
  if (status === 'Crossed 1K') return 'Graduated past the underrated threshold.'
  if (status === 'Near 1K') return 'Close to crossing the 1,000-star line.'
  if (status === 'Rising') return 'Current star growth is stronger than the baseline.'
  if (status === 'Archived/Inactive') return 'Repository needs availability review.'
  return 'Still below the obvious-discovery threshold.'
}

function statusDisplayLabel(status: RepoStatus) {
  if (status === 'Crossed 1K') return 'Graduated'
  if (status === 'Near 1K') return 'Near 1K'
  if (status === 'Rising') return 'Rising'
  if (status === 'Archived/Inactive') return 'Inactive'
  return 'Hidden'
}

function inferStatus(repo: Repo): RepoStatus {
  if (repo.status) return repo.status
  if (repo.archived || repo.disabled || repo.unavailable) return 'Archived/Inactive'
  if (repo.stars >= 1000) return 'Crossed 1K'
  if (repo.stars >= 900) return 'Near 1K'
  if ((repo.dailyStarDelta || 0) >= 3 || (repo.weeklyStarDelta || 0) >= 12 || repo.wave === 'rising') return 'Rising'
  return 'Underrated'
}

function laneFromRepo(repo: RepoView): LaneId {
  if (repo.statusLabel === 'Crossed 1K') return 'graduated'
  if (repo.statusLabel === 'Near 1K' || repo.stars >= 850) return 'near'
  if (repo.statusLabel === 'Rising') return 'rising'
  if (daysSince(repo.firstSeen) <= 30 || repo.wave === 'new') return 'fresh'
  if (repo.stars < 500) return 'hidden'
  return 'all'
}

function normalizeRepo(repo: Repo): RepoView {
  const repoUrl = repo.repoUrl || repo.url || ''
  const fullName = repo.full_name || slugFromUrl(repoUrl) || repo.name
  const [ownerFromName, nameFromFull] = fullName.split('/')
  const statusLabel = inferStatus(repo)
  const lastUpdated = repo.lastGitHubUpdatedAt || repo.pushed_at || repo.updated_at || null
  const firstSeen = repo.firstSeenAt || repo.created_at || null
  const growthScore = (repo.dailyStarDelta || 0) * 10 + (repo.weeklyStarDelta || 0) + Math.max(0, 45 - daysSince(lastUpdated)) + (repo.is_gem ? 20 : 0)
  const view: RepoView = {
    ...repo,
    name: repo.name || nameFromFull || fullName,
    id: fullName.toLowerCase(),
    fullName,
    displayName: repo.title || repo.name || nameFromFull || fullName,
    ownerName: repo.owner || ownerFromName || 'unknown',
    repoUrl,
    statusLabel,
    statusReason: repo.submittedReason || repo.unavailableReason || statusReason(statusLabel),
    lane: 'all',
    allTopics: Array.from(new Set([...(repo.topics || []), ...(repo.tags || []), repo.category, repo.wave].filter(Boolean) as string[])).slice(0, 10),
    lastUpdated,
    firstSeen,
    growthScore,
  }

  return { ...view, lane: laneFromRepo(view) }
}

function signalLevel(repo: RepoView) {
  if (repo.statusLabel === 'Crossed 1K') return 4
  if (repo.growthScore > 80) return 4
  if (repo.growthScore > 45 || repo.statusLabel === 'Rising') return 3
  if (repo.stars > 500 || repo.statusLabel === 'Near 1K') return 2
  return 1
}

function repoIcon(repo: RepoView): IconName {
  const text = [repo.displayName, repo.description, repo.language, ...repo.allTopics].join(' ').toLowerCase()
  if (/(github|repo|open-source)/.test(text)) return 'github'
  if (/(agent|claude|codex|automation|workflow)/.test(text)) return 'spark'
  if (/(web|react|next|html|css|frontend)/.test(text)) return 'globe'
  if (/(cli|terminal|shell|tui|command)/.test(text)) return 'code'
  return 'repo'
}

function relatedReposFor(repo: RepoView, repos: RepoView[], limit = 4) {
  const selectedTopics = new Set(repo.allTopics)
  return repos
    .filter((candidate) => candidate.id !== repo.id)
    .map((candidate) => {
      const sharedTopics = candidate.allTopics.filter((item) => selectedTopics.has(item)).length
      const languageMatch = candidate.language && repo.language && candidate.language === repo.language ? 2 : 0
      const statusMatch = candidate.statusLabel === repo.statusLabel ? 1.5 : 0
      const starCloseness = Math.max(0, 1 - Math.abs(candidate.stars - repo.stars) / 1000)
      return { repo: candidate, score: sharedTopics * 3 + languageMatch + statusMatch + starCloseness }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.repo.growthScore - a.repo.growthScore)
    .slice(0, limit)
    .map((item) => item.repo)
}

function App() {
  const hashParts = readHashParts()
  const [repos, setRepos] = useState<RepoView[]>([])
  const [report, setReport] = useState<UpdateReport | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionReceipt[]>(() => readStoredArray<SubmissionReceipt>('undrdr-submission-receipts'))
  const [mockUser, setMockUser] = useState<MockUser | null>(() => readStoredUser())
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readStoredArray<string>('undrdr-mock-favorites'))
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [route, setRoute] = useState<RouteId>(hashParts.route)
  const [lane, setLane] = useState<LaneId>(hashParts.lane)
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('all')
  const [topic, setTopic] = useState('all')
  const [status, setStatus] = useState<'all' | RepoStatus>('all')
  const [sort, setSort] = useState<SortMode>('curated')
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

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

  useEffect(() => {
    function syncHashView() {
      const next = readHashParts()
      setRoute(next.route)
      setLane(next.lane)
      setSelectedRepoId(null)
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    }

    window.addEventListener('hashchange', syncHashView)
    return () => window.removeEventListener('hashchange', syncHashView)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const languages = useMemo(() => uniq(repos.map((repo) => repo.language || 'Unknown')), [repos])
  const topics = useMemo(() => {
    const counts = new Map<string, number>()
    repos.forEach((repo) => repo.allTopics.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1)))
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [repos])

  const repoIds = useMemo(() => new Set(repos.map((repo) => repo.id)), [repos])
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const selectedRepo = useMemo(() => repos.find((repo) => repo.id === selectedRepoId) || null, [repos, selectedRepoId])
  const stats = useMemo(() => ({
    total: repos.length,
    underOneK: repos.filter((repo) => repo.stars < 1000).length,
    rising: repos.filter((repo) => repo.statusLabel === 'Rising').length,
    near: repos.filter((repo) => repo.statusLabel === 'Near 1K').length,
    graduated: repos.filter((repo) => repo.statusLabel === 'Crossed 1K').length,
  }), [repos])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = repos.filter((repo) => {
      const haystack = [repo.displayName, repo.fullName, repo.description, repo.ownerName, repo.language, repo.statusLabel, ...repo.allTopics].join(' ').toLowerCase()
      const laneMatch = lane === 'all' || repo.lane === lane || (lane === 'hidden' && repo.stars < 500 && repo.statusLabel !== 'Crossed 1K')
      return laneMatch
        && (!needle || haystack.includes(needle))
        && (language === 'all' || (repo.language || 'Unknown') === language)
        && (topic === 'all' || repo.allTopics.includes(topic))
        && (status === 'all' || repo.statusLabel === status)
    })

    return list.sort((a, b) => {
      if (sort === 'stars') return b.stars - a.stars
      if (sort === 'newest') return daysSince(a.firstSeen) - daysSince(b.firstSeen)
      if (sort === 'rising') return b.growthScore - a.growthScore
      if (sort === 'updated') return daysSince(a.lastUpdated) - daysSince(b.lastUpdated)
      if (sort === 'closest') return Math.abs(1000 - a.stars) - Math.abs(1000 - b.stars)
      return b.growthScore + Math.min(b.stars, 999) / 25 - (a.growthScore + Math.min(a.stars, 999) / 25)
    })
  }, [repos, query, language, topic, status, sort, lane])

  const visibleRepos = useMemo(() => filtered.slice(0, 96), [filtered])
  const favoriteRepos = useMemo(() => repos.filter((repo) => favoriteSet.has(repo.id)), [repos, favoriteSet])
  const selectedIndex = selectedRepo ? visibleRepos.findIndex((repo) => repo.id === selectedRepo.id) : -1
  const previousRepo = selectedIndex > 0 ? visibleRepos[selectedIndex - 1] : null
  const nextRepo = selectedIndex >= 0 && selectedIndex < visibleRepos.length - 1 ? visibleRepos[selectedIndex + 1] : null
  const relatedRepos = useMemo(() => selectedRepo ? relatedReposFor(selectedRepo, repos, 4) : [], [repos, selectedRepo])
  const hotTopics = topics.slice(0, 18)

  useEffect(() => {
    if (!selectedRepo) return undefined
    function handleKeys(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedRepoId(null)
      if (event.key === 'ArrowRight' && nextRepo) setSelectedRepoId(nextRepo.id)
      if (event.key === 'ArrowLeft' && previousRepo) setSelectedRepoId(previousRepo.id)
    }
    document.body.classList.add('has-open-panel')
    window.addEventListener('keydown', handleKeys)
    return () => {
      document.body.classList.remove('has-open-panel')
      window.removeEventListener('keydown', handleKeys)
    }
  }, [selectedRepo, nextRepo, previousRepo])

  function setRouteAndHash(nextRoute: RouteId, nextLane = lane) {
    setRoute(nextRoute)
    if (nextRoute === 'discover') setLane(nextLane)
    writeHash(nextRoute, nextRoute === 'discover' ? nextLane : undefined)
  }

  function resetFilters() {
    setQuery('')
    setLanguage('all')
    setTopic('all')
    setStatus('all')
    setSort('curated')
  }

  function chooseLane(nextLane: LaneId) {
    setLane(nextLane)
    setRouteAndHash('discover', nextLane)
    if (nextLane === 'fresh') setSort('newest')
    if (nextLane === 'rising') setSort('rising')
    if (nextLane === 'near') setSort('closest')
    if (nextLane === 'graduated') setSort('stars')
    if (nextLane === 'hidden' || nextLane === 'all') setSort('curated')
  }

  function surpriseMe() {
    const pool = filtered.length ? filtered : repos
    const repo = pool[Math.floor(Math.random() * Math.max(pool.length, 1))]
    if (repo) {
      setRouteAndHash('discover', lane)
      setSelectedRepoId(repo.id)
    }
  }

  function mockSignIn() {
    const user = { name: 'Mock member' }
    setMockUser(user)
    window.localStorage.setItem('undrdr-mock-user', JSON.stringify(user))
    setToast('Mock login active. Watchlist stars are now enabled.')
  }

  function mockSignOut() {
    setMockUser(null)
    setFavoriteIds([])
    window.localStorage.removeItem('undrdr-mock-user')
    window.localStorage.removeItem('undrdr-mock-favorites')
    setToast('Signed out of the local mock account.')
  }

  function toggleFavorite(repoId: string) {
    if (!mockUser) {
      setToast('Log in first to save repos to your watchlist.')
      return
    }
    const next = favoriteSet.has(repoId) ? favoriteIds.filter((id) => id !== repoId) : [repoId, ...favoriteIds]
    setFavoriteIds(next)
    window.localStorage.setItem('undrdr-mock-favorites', JSON.stringify(next))
  }

  function handleSubmissionReceipt(submission: SubmissionReceipt) {
    const next = [submission, ...submissions].slice(0, 20)
    setSubmissions(next)
    window.localStorage.setItem('undrdr-submission-receipts', JSON.stringify(next))
  }

  function clearSubmissionReceipts() {
    setSubmissions([])
    window.localStorage.removeItem('undrdr-submission-receipts')
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#repo-grid">Skip to discoveries</a>
      <Header
        route={route}
        user={mockUser}
        favoriteCount={favoriteIds.length}
        onRoute={setRouteAndHash}
        onSignIn={mockSignIn}
        onSignOut={mockSignOut}
      />

      {route === 'discover' && (
        <>
          <Hero stats={stats} report={report} loadState={loadState} />
          <DiscoveryBar
            lane={lane}
            query={query}
            resultCount={filtered.length}
            onLane={chooseLane}
            onQuery={setQuery}
            onSurprise={surpriseMe}
          />
          <DiscoveryIndex
            lane={lane}
            repos={visibleRepos}
            allResultCount={filtered.length}
            loadState={loadState}
            languages={languages}
            topics={topics.map(([name]) => name)}
            language={language}
            topic={topic}
            status={status}
            sort={sort}
            favoriteIds={favoriteSet}
            isLoggedIn={Boolean(mockUser)}
            report={report}
            onLanguage={setLanguage}
            onTopic={setTopic}
            onStatus={setStatus}
            onSort={setSort}
            onReset={resetFilters}
            onOpenRepo={setSelectedRepoId}
            onToggleFavorite={toggleFavorite}
          />
        </>
      )}

      {route === 'collections' && (
        <CollectionsPage
          topics={hotTopics}
          repos={repos}
          onTopic={(name) => {
            setTopic(name)
            setQuery('')
            setStatus('all')
            setSort('curated')
            chooseLane('all')
          }}
        />
      )}

      {route === 'submit' && (
        <SubmitRepoSection
          siteConfig={SITE_CONFIG}
          existingRepoIds={repoIds}
          submissions={submissions}
          onClear={clearSubmissionReceipts}
          onSubmit={handleSubmissionReceipt}
        />
      )}

      {route === 'watchlist' && (
        <WatchlistPage
          isLoggedIn={Boolean(mockUser)}
          repos={favoriteRepos}
          favoriteIds={favoriteSet}
          onSignIn={mockSignIn}
          onOpenRepo={setSelectedRepoId}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {route === 'data' && <DataPage stats={stats} report={report} repos={repos} loadState={loadState} />}
      {route === 'about' && <AboutPage siteConfig={SITE_CONFIG} stats={stats} />}

      <SiteFooter onRoute={setRouteAndHash} />
      {toast && <div className="toast" role="status">{toast}</div>}
      {selectedRepo && (
        <RepoDetailPanel
          repo={selectedRepo}
          previousRepo={previousRepo}
          nextRepo={nextRepo}
          relatedRepos={relatedRepos}
          isFavorite={favoriteSet.has(selectedRepo.id)}
          isLoggedIn={Boolean(mockUser)}
          onClose={() => setSelectedRepoId(null)}
          onSelectRepo={setSelectedRepoId}
          onToggleFavorite={toggleFavorite}
        />
      )}
    </main>
  )
}

function Header({ route, user, favoriteCount, onRoute, onSignIn, onSignOut }: { route: RouteId; user: MockUser | null; favoriteCount: number; onRoute: (route: RouteId) => void; onSignIn: () => void; onSignOut: () => void }) {
  return (
    <header className="site-header">
      <button className="brand" type="button" onClick={() => onRoute('discover')} aria-label="UND-RDR home">
        <img src="./assets/undrdr-discovery-icon-bright.png" alt="" />
        <span>UND-RDR</span>
      </button>
      <nav aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => (
          <button key={item.id} type="button" aria-current={route === item.id ? 'page' : undefined} onClick={() => onRoute(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="auth-area">
        {user && <button type="button" className="saved-link" onClick={() => onRoute('watchlist')}>{favoriteCount} saved</button>}
        {user ? <button type="button" className="login-button" onClick={onSignOut}>Log out</button> : <button type="button" className="login-button" onClick={onSignIn}>Mock login</button>}
      </div>
    </header>
  )
}

function Hero({ stats, report, loadState }: { stats: { total: number; underOneK: number; rising: number; near: number; graduated: number }; report: UpdateReport | null; loadState: LoadState }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="live-label"><span /> Live index</p>
        <h1>Find what everyone <em>missed</em></h1>
        <p className="hero-text">Open-source gems before they become obvious. UND-RDR turns a protected GitHub dataset into a fast discovery trail.</p>
      </div>
      <aside className="hero-stats" aria-label="UND-RDR index summary">
        <Metric label="Repos tracked" value={stats.total} />
        <Metric label="Under 1K" value={stats.underOneK} />
        <Metric label="Rising now" value={stats.rising} />
        <Metric label="Graduated" value={stats.graduated} />
        <div className={`sync-line ${loadState === 'error' ? 'is-error' : ''}`}>
          <Icon name="refresh" />
          <span>{report ? `Checked ${formatDate(report.checkedAt)}` : loadState === 'loading' ? 'Loading snapshot' : 'Local snapshot loaded'}</span>
        </div>
      </aside>
    </section>
  )
}

function DiscoveryBar({ lane, query, resultCount, onLane, onQuery, onSurprise }: { lane: LaneId; query: string; resultCount: number; onLane: (lane: LaneId) => void; onQuery: (query: string) => void; onSurprise: () => void }) {
  return (
    <section className="discovery-bar" aria-label="Discovery controls">
      <div className="container discovery-inner">
        <div className="lane-tabs" role="tablist" aria-label="Discovery lanes">
          {LANES.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={lane === item.id} onClick={() => onLane(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              <em>{item.hint}</em>
            </button>
          ))}
          <button type="button" className="surprise-button" onClick={onSurprise}>
            <Icon name="spark" />
            <span>Surprise me</span>
          </button>
        </div>
        <label className="bar-search">
          <Icon name="search" />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="repo, owner, language, topic" />
          <span>{formatNumber(resultCount)}</span>
        </label>
      </div>
    </section>
  )
}

function DiscoveryIndex(props: {
  lane: LaneId
  repos: RepoView[]
  allResultCount: number
  loadState: LoadState
  languages: string[]
  topics: string[]
  language: string
  topic: string
  status: 'all' | RepoStatus
  sort: SortMode
  favoriteIds: Set<string>
  isLoggedIn: boolean
  report: UpdateReport | null
  onLanguage: (value: string) => void
  onTopic: (value: string) => void
  onStatus: (value: 'all' | RepoStatus) => void
  onSort: (value: SortMode) => void
  onReset: () => void
  onOpenRepo: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const laneTitle = props.lane === 'all' ? 'Today’s discoveries' : LANES.find((item) => item.id === props.lane)?.label || 'Today’s discoveries'
  const reportLine = props.report ? `Latest check ${formatDate(props.report.checkedAt)} · ${formatNumber(props.report.checkedCount)} checked` : 'Local dataset snapshot'

  return (
    <section className="container discovery-section" id="repo-grid">
      <div className="section-head">
        <div>
          <p>{reportLine}</p>
          <h2>{laneTitle}</h2>
        </div>
        <span>{formatNumber(props.allResultCount)} matching repos. Cards stay short; open one to continue the discovery trail.</span>
      </div>

      <div className="refine-row" aria-label="Refine repositories">
        <Select label="Language" value={props.language} values={props.languages} onChange={props.onLanguage} />
        <Select label="Topic" value={props.topic} values={props.topics} onChange={props.onTopic} />
        <select value={props.status} onChange={(event) => props.onStatus(event.target.value as 'all' | RepoStatus)} aria-label="Status">
          {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item === 'all' ? 'Status / all' : item}</option>)}
        </select>
        <select value={props.sort} onChange={(event) => props.onSort(event.target.value as SortMode)} aria-label="Sort">
          <option value="curated">Sort / curated</option>
          <option value="stars">Sort / stars</option>
          <option value="newest">Sort / newest</option>
          <option value="rising">Sort / rising</option>
          <option value="updated">Sort / updated</option>
          <option value="closest">Sort / closest to 1K</option>
        </select>
        <button type="button" onClick={props.onReset}>Reset</button>
      </div>

      {props.loadState === 'loading' && <StateBlock title="Loading repo data" detail="Reading the protected UND-RDR snapshot." />}
      {props.loadState === 'error' && <StateBlock title="Could not load repo data" detail="The app could not read public/data/all_repos.json." />}
      {props.loadState === 'ready' && props.repos.length === 0 && <StateBlock title="No results" detail="Try a broader topic, status, or language." />}
      {props.loadState === 'ready' && props.repos.length > 0 && (
        <div className="repo-grid" aria-label="Repository discoveries">
          {props.repos.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              isFavorite={props.favoriteIds.has(repo.id)}
              isLoggedIn={props.isLoggedIn}
              onOpen={props.onOpenRepo}
              onToggleFavorite={props.onToggleFavorite}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function RepoCard({ repo, isFavorite, isLoggedIn, onOpen, onToggleFavorite }: { repo: RepoView; isFavorite: boolean; isLoggedIn: boolean; onOpen: (id: string) => void; onToggleFavorite: (id: string) => void }) {
  const level = signalLevel(repo)

  return (
    <article className="repo-card" style={{ '--signal': statusColor(repo.statusLabel) } as CSSProperties}>
      <button className="repo-card-main" type="button" onClick={() => onOpen(repo.id)}>
        <div className="card-top">
          <span>{statusDisplayLabel(repo.statusLabel)}</span>
          <em>{repo.language || 'Unknown'}</em>
        </div>
        <div className="repo-title-row">
          <span className="repo-avatar"><Icon name={repoIcon(repo)} /></span>
          <div>
            <h3>{repo.displayName}</h3>
            <p><Icon name="github" />{repo.ownerName}/{repo.name}</p>
          </div>
        </div>
        <p className="repo-description">{repo.description || 'No description available yet.'}</p>
        <div className="repo-card-meta">
          <strong>{formatNumber(repo.stars)} stars</strong>
          <span>{repo.dailyStarDelta ? `+${formatNumber(repo.dailyStarDelta)} today` : `Updated ${formatDate(repo.lastUpdated)}`}</span>
          <SignalBars level={level} />
        </div>
      </button>
      <button
        className={`star-button ${isFavorite ? 'is-active' : ''}`}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite(repo.id)
        }}
        aria-label={isLoggedIn ? `${isFavorite ? 'Remove' : 'Save'} ${repo.displayName}` : `Log in to save ${repo.displayName}`}
        title={isLoggedIn ? (isFavorite ? 'Saved' : 'Save') : 'Login to save'}
      >
        <Icon name="star" filled={isFavorite} />
      </button>
    </article>
  )
}

function RepoDetailPanel(props: {
  repo: RepoView
  previousRepo: RepoView | null
  nextRepo: RepoView | null
  relatedRepos: RepoView[]
  isFavorite: boolean
  isLoggedIn: boolean
  onClose: () => void
  onSelectRepo: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const repo = props.repo

  return (
    <div className="detail-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) props.onClose()
    }}>
      <aside className="detail-panel" aria-label={`${repo.displayName} discovery details`}>
        <div className="detail-chrome">
          <button type="button" onClick={props.onClose} aria-label="Close details"><Icon name="close" /> Close</button>
          <div>
            <button type="button" disabled={!props.previousRepo} onClick={() => props.previousRepo && props.onSelectRepo(props.previousRepo.id)}><Icon name="arrow" /> Prev</button>
            <button type="button" disabled={!props.nextRepo} onClick={() => props.nextRepo && props.onSelectRepo(props.nextRepo.id)}>Next <Icon name="arrow" /></button>
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-heading">
            <span className="detail-avatar"><Icon name={repoIcon(repo)} /></span>
            <p><Icon name="github" /> {repo.ownerName}/{repo.name}</p>
            <h2>{repo.displayName}</h2>
            <div className="tier-strip" style={{ '--signal': statusColor(repo.statusLabel) } as CSSProperties}>
              <strong>{statusDisplayLabel(repo.statusLabel)}</strong>
              <span>{repo.statusReason}</span>
            </div>
            <p className="detail-description">{repo.description || 'No description available yet.'}</p>
          </div>

          <div className="detail-stats">
            <Metric label="Stars" value={repo.stars} />
            <Metric label="Forks" value={repo.forks || 0} />
            <Metric label="Daily" value={repo.dailyStarDelta || 0} />
            <Metric label="Weekly" value={repo.weeklyStarDelta || 0} />
          </div>

          <div className="detail-actions">
            <a href={repo.repoUrl} target="_blank" rel="noreferrer"><Icon name="github" /> View on GitHub</a>
            <button type="button" onClick={() => props.onToggleFavorite(repo.id)}>
              <Icon name="star" filled={props.isFavorite} /> {props.isLoggedIn ? (props.isFavorite ? 'Saved' : 'Save') : 'Login to save'}
            </button>
          </div>

          <div className="detail-meta-grid">
            <Definition title="Language" detail={repo.language || 'Unknown'} />
            <Definition title="First seen" detail={formatDate(repo.firstSeen)} />
            <Definition title="Last updated" detail={formatDate(repo.lastUpdated)} />
            <Definition title="Threshold" detail={repo.stars >= 1000 ? 'Graduated from underrated' : `${formatNumber(Math.max(0, 1000 - repo.stars))} stars from 1K`} />
          </div>

          <div className="topic-cloud">
            {repo.allTopics.length ? repo.allTopics.map((item) => <span key={item}>{item}</span>) : <span>No topics yet</span>}
          </div>

          <section className="readme-preview" aria-label="Discovery note">
            <p>Discovery note</p>
            <strong>{repo.statusReason}</strong>
            <span>{repo.submittedReason || repo.license || 'Open the GitHub repository to inspect README, releases, issues, and fit.'}</span>
          </section>
        </div>

        <div className="next-discovery">
          <div>
            <p>Next discovery</p>
            <span>Use related repos or arrow keys to keep moving.</span>
          </div>
          <div className="related-row">
            {props.relatedRepos.map((related) => (
              <button key={related.id} type="button" onClick={() => props.onSelectRepo(related.id)}>
                <strong>{related.displayName}</strong>
                <span>{related.language || 'Unknown'} · {formatNumber(related.stars)} stars</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

function CollectionsPage({ topics, repos, onTopic }: { topics: Array<[string, number]>; repos: RepoView[]; onTopic: (topic: string) => void }) {
  const collections = [
    { title: 'Agent tools', query: 'agent', detail: 'Coding, orchestration, and autonomous workflow projects.' },
    { title: 'Local AI', query: 'local', detail: 'Self-hosted, offline, and privacy-first repos.' },
    { title: 'Apple/macOS', query: 'macos', detail: 'Swift, native Mac tools, and platform-specific finds.' },
    { title: 'CLI craft', query: 'cli', detail: 'Terminal-first utilities with strong developer ergonomics.' },
  ]

  return (
    <section className="container page-section">
      <PageIntro label="Collections" title="Browse by signal, not by accident." detail="The same dataset, grouped into useful editorial paths." />
      <div className="collection-grid">
        {collections.map((item) => {
          const count = repos.filter((repo) => [repo.displayName, repo.description, ...repo.allTopics].join(' ').toLowerCase().includes(item.query)).length
          return (
            <button key={item.title} type="button" onClick={() => onTopic(item.query)}>
              <Icon name="target" />
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
              <em>{formatNumber(count)} repos</em>
            </button>
          )
        })}
      </div>
      <div className="topic-list">
        {topics.map(([name, count], index) => (
          <button key={name} type="button" onClick={() => onTopic(name)}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{name}</strong>
            <em>{count}</em>
          </button>
        ))}
      </div>
    </section>
  )
}

function SubmitRepoSection({ siteConfig, existingRepoIds, submissions, onClear, onSubmit }: { siteConfig: SiteConfig; existingRepoIds: Set<string>; submissions: SubmissionReceipt[]; onClear: () => void; onSubmit: (submission: SubmissionReceipt) => void }) {
  const [repoUrl, setRepoUrl] = useState('')
  const [reason, setReason] = useState('')
  const [contact, setContact] = useState('')
  const [website, setWebsite] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [messageKind, setMessageKind] = useState<'info' | 'success' | 'warning'>('info')
  const [message, setMessage] = useState('Submissions create a protected review issue. The live dataset is never changed automatically.')
  const slug = normalizeSlug(repoUrl)
  const isDuplicate = Boolean(slug && existingRepoIds.has(slug))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!slug) {
      setMessageKind('warning')
      setMessage('Paste a full GitHub repo URL, like https://github.com/owner/repo.')
      return
    }
    if (isDuplicate) {
      setMessageKind('warning')
      setMessage(`${slug} is already in UND-RDR. Duplicate caught before intake.`)
      return
    }

    setIsSubmitting(true)
    setMessageKind('info')
    setMessage('Checking the repo against the UND-RDR index...')

    try {
      const response = await fetch('/api/submit-repo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repoUrl, reason, contact, website }),
      })
      const result = await response.json() as SubmitResponse

      if (!response.ok || !result.ok || !result.submission) {
        setMessageKind('warning')
        setMessage(result.message || result.error || 'Submission could not be received. Try again later.')
        return
      }

      onSubmit({
        id: result.submission.id,
        repoUrl: result.submission.repoUrl,
        reason: result.submission.reason,
        contact: result.submission.contact,
        submittedAt: result.submission.submittedAt,
        delivery: result.delivery || 'validated-only',
        reviewUrl: result.reviewUrl || null,
      })
      setRepoUrl('')
      setReason('')
      setContact('')
      setWebsite('')
      setMessageKind('success')
      setMessage(result.message || 'Repository received for review. The live dataset was not changed.')
    } catch {
      setMessageKind('warning')
      setMessage('Submission endpoint could not be reached. You can email the repo instead.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="container page-section submit-page">
      <PageIntro
        label="Submit"
        title="Know an underrated repo?"
        detail={<span>Use the protected form, or email <a href={submissionMailto(siteConfig.siteEmail)}>{siteConfig.siteEmail}</a>.</span>}
      />
      <form className="submit-form" onSubmit={submit}>
        <label>
          <span>GitHub repo URL</span>
          <input type="url" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/owner/repo" autoComplete="off" />
        </label>
        <label>
          <span>Why should UND-RDR track it?</span>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Short reason, topic, or discovery note..." rows={5} />
        </label>
        <label>
          <span>Contact optional</span>
          <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="email or GitHub handle..." />
        </label>
        <label className="honeypot" aria-hidden="true">
          <span>Website</span>
          <input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
        </label>
        <div className={`form-note ${messageKind}`} aria-live="polite">{message}</div>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Checking...' : 'Submit for review'}</button>
      </form>
      <aside className="receipt-panel">
        <div>
          <strong>Review receipts</strong>
          {submissions.length > 0 && <button type="button" onClick={onClear}>Clear</button>}
        </div>
        {submissions.length ? submissions.slice(0, 6).map((item) => (
          <a key={item.id || `${item.repoUrl}-${item.submittedAt}`} href={item.reviewUrl || item.repoUrl} target="_blank" rel="noreferrer">
            <span>{normalizeSlug(item.repoUrl)}</span>
            <em>{formatSubmissionDelivery(item.delivery, item.submittedAt)}</em>
          </a>
        )) : <span>No submissions received in this browser yet.</span>}
      </aside>
    </section>
  )
}

function WatchlistPage({ isLoggedIn, repos, favoriteIds, onSignIn, onOpenRepo, onToggleFavorite }: { isLoggedIn: boolean; repos: RepoView[]; favoriteIds: Set<string>; onSignIn: () => void; onOpenRepo: (id: string) => void; onToggleFavorite: (id: string) => void }) {
  return (
    <section className="container page-section">
      <PageIntro label="Watchlist" title={isLoggedIn ? `${repos.length} saved repos` : 'Watchlist requires login'} detail="Favorites are personal, so this local mock keeps them behind a sign-in state." />
      {!isLoggedIn && <button className="large-action" type="button" onClick={onSignIn}>Mock login</button>}
      {isLoggedIn && repos.length === 0 && <StateBlock title="No saved repos yet" detail="Use the star on repo cards to build your watchlist." />}
      {isLoggedIn && repos.length > 0 && (
        <div className="repo-grid">
          {repos.map((repo) => <RepoCard key={repo.id} repo={repo} isFavorite={favoriteIds.has(repo.id)} isLoggedIn onOpen={onOpenRepo} onToggleFavorite={onToggleFavorite} />)}
        </div>
      )}
    </section>
  )
}

function DataPage({ stats, report, repos, loadState }: { stats: { total: number; underOneK: number; rising: number; near: number; graduated: number }; report: UpdateReport | null; repos: RepoView[]; loadState: LoadState }) {
  const duplicates = repos.length - new Set(repos.map((repo) => repo.id)).size
  return (
    <section className="container page-section">
      <PageIntro label="Data" title="Protected dataset, readable signals." detail="UND-RDR keeps the raw repository snapshot intact while the UI derives useful browsing states." />
      <div className="data-grid">
        <Definition title="Source" detail={`${formatNumber(stats.total)} repos from public/data/all_repos.json.`} />
        <Definition title="Threshold" detail={`${formatNumber(stats.underOneK)} repos are still below 1,000 stars.`} />
        <Definition title="Signals" detail={`${formatNumber(stats.rising)} rising, ${formatNumber(stats.near)} near 1K, ${formatNumber(stats.graduated)} graduated.`} />
        <Definition title="Freshness" detail={report ? `Latest check ${formatDate(report.checkedAt)} across ${formatNumber(report.checkedCount)} repos.` : 'Daily automation is prepared, but not fully connected yet.'} />
        <Definition title="Validation" detail={`${duplicates} duplicate IDs detected. Load state: ${loadState}.`} />
        <Definition title="Next automation" detail="Daily GitHub checks should update stars, detect 1K crossings, and record growth deltas." />
      </div>
    </section>
  )
}

function AboutPage({ siteConfig, stats }: { siteConfig: SiteConfig; stats: { total: number; underOneK: number; rising: number; near: number; graduated: number } }) {
  return (
    <section className="container page-section">
      <PageIntro label="About" title="UND-RDR tracks underrated GitHub projects before they become famous." detail={`${formatNumber(stats.total)} repos, curated as a discovery system instead of a random list.`} />
      <div className="data-grid">
        <Definition title="Hidden" detail="Projects still below the obvious-discovery zone." />
        <Definition title="Rising" detail="Repos growing faster than the surrounding index." />
        <Definition title="Near 1K" detail="Projects close to crossing the underrated threshold." />
        <Definition title="Graduated" detail="Repos that crossed 1,000 stars and remain in the archive." />
        <Definition title="Submit" detail={<a href={submissionMailto(siteConfig.siteEmail)}>{siteConfig.siteEmail}</a>} />
        <Definition title="Move" detail={`The canonical domain is ${siteConfig.targetDomain}. akaKika can stay as a redirect/history layer.`} />
      </div>
    </section>
  )
}

function SiteFooter({ onRoute }: { onRoute: (route: RouteId) => void }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <button className="footer-brand" type="button" onClick={() => onRoute('discover')}><Icon name="target" /> UND-RDR</button>
          <p>Open-source projects before they become obvious.</p>
        </div>
        <FooterColumn title="Discover" items={[['All repos', 'discover'], ['Collections', 'collections'], ['Watchlist', 'watchlist']]} onRoute={onRoute} />
        <FooterColumn title="Operate" items={[['Submit', 'submit'], ['Data', 'data'], ['About', 'about']]} onRoute={onRoute} />
        <div>
          <strong>Kika’s universe</strong>
          <a href="https://akakika.com/" target="_blank" rel="noreferrer">akaKika</a>
          <a href="https://github.com/dot-RealityTest/undrdr-vis" target="_blank" rel="noreferrer">GitHub repo</a>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, items, onRoute }: { title: string; items: Array<[string, RouteId]>; onRoute: (route: RouteId) => void }) {
  return (
    <div>
      <strong>{title}</strong>
      {items.map(([label, route]) => <button key={route} type="button" onClick={() => onRoute(route)}>{label}</button>)}
    </div>
  )
}

function PageIntro({ label, title, detail }: { label: string; title: string; detail: ReactNode }) {
  return (
    <div className="page-intro">
      <p>{label}</p>
      <h1>{title}</h1>
      <span>{detail}</span>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><strong>{formatNumber(value)}</strong><span>{label}</span></div>
}

function SignalBars({ level }: { level: number }) {
  return (
    <span className="signal-bars" aria-label={`Signal level ${level} of 4`}>
      {[1, 2, 3, 4].map((item) => <i key={item} className={item <= level ? 'is-on' : ''} />)}
    </span>
  )
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="all">{label} / all</option>
      {values.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  )
}

function Definition({ title, detail }: { title: string; detail: ReactNode }) {
  return <div className="definition"><strong>{title}</strong><span>{detail}</span></div>
}

function StateBlock({ title, detail }: { title: string; detail: string }) {
  return <div className="state-block"><strong>{title}</strong><span>{detail}</span></div>
}

function formatSubmissionDelivery(delivery: SubmissionReceipt['delivery'], submittedAt: string) {
  if (delivery === 'github-issue') return 'issue created'
  if (delivery === 'webhook') return 'sent'
  if (delivery === 'email') return 'emailed'
  if (delivery === 'validated-only') return 'received'
  return formatDate(submittedAt)
}

function statusColor(status: RepoStatus) {
  if (status === 'Rising') return '#168052'
  if (status === 'Near 1K') return '#9d6b20'
  if (status === 'Crossed 1K') return '#323a46'
  if (status === 'Archived/Inactive') return '#8b3a3a'
  return '#5f776f'
}

function Icon({ name, filled = false }: { name: IconName; filled?: boolean }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'target' && <><circle {...stroke} cx="12" cy="12" r="8" /><circle {...stroke} cx="12" cy="12" r="3" /><path {...stroke} d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>}
      {name === 'repo' && <><path {...stroke} d="M7 4h8l3 3v13H7z" /><path {...stroke} d="M15 4v4h4M9.5 12h5M9.5 16h5" /></>}
      {name === 'star' && <path d="M12 3.75l2.44 4.94 5.45.79-3.94 3.84.93 5.43L12 16.18 7.12 18.75l.93-5.43-3.94-3.84 5.45-.79L12 3.75z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />}
      {name === 'github' && <path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.06c-3.08.67-3.73-1.31-3.73-1.31-.5-1.28-1.23-1.62-1.23-1.62-1-.68.08-.67.08-.67 1.11.08 1.69 1.14 1.69 1.14.99 1.69 2.59 1.2 3.22.92.1-.72.39-1.2.7-1.48-2.46-.28-5.05-1.23-5.05-5.47 0-1.21.43-2.2 1.14-2.97-.11-.28-.49-1.41.11-2.93 0 0 .93-.3 3.05 1.13A10.58 10.58 0 0 1 12 6.3c.94 0 1.88.13 2.77.38 2.12-1.43 3.05-1.13 3.05-1.13.6 1.52.22 2.65.11 2.93.71.77 1.14 1.76 1.14 2.97 0 4.25-2.59 5.18-5.06 5.46.4.35.75 1.02.75 2.06V22c0 .29.2.64.76.53A11.1 11.1 0 0 0 12 .9Z" />}
      {name === 'search' && <><circle {...stroke} cx="10.5" cy="10.5" r="6.5" /><path {...stroke} d="m16 16 4 4" /></>}
      {name === 'spark' && <><path {...stroke} d="M12 3l1.6 5 5 1.6-5 1.6-1.6 5-1.6-5-5-1.6 5-1.6z" /><path {...stroke} d="M18 15l.7 2.2 2.3.8-2.3.8L18 21l-.8-2.2-2.2-.8 2.2-.8z" /></>}
      {name === 'rise' && <><path {...stroke} d="M4 17 10 11l4 4 6-8" /><path {...stroke} d="M15 7h5v5" /></>}
      {name === 'near' && <><path {...stroke} d="M5 12h14M12 5v14" /><circle {...stroke} cx="12" cy="12" r="7" /></>}
      {name === 'graduate' && <><path {...stroke} d="m4 9 8-4 8 4-8 4z" /><path {...stroke} d="M7 11v4c2.6 2 7.4 2 10 0v-4M20 9v5" /></>}
      {name === 'code' && <><path {...stroke} d="m9 8-4 4 4 4M15 8l4 4-4 4" /></>}
      {name === 'globe' && <><circle {...stroke} cx="12" cy="12" r="8" /><path {...stroke} d="M4 12h16M12 4c2 2.2 3 4.9 3 8s-1 5.8-3 8M12 4c-2 2.2-3 4.9-3 8s1 5.8 3 8" /></>}
      {name === 'pin' && <><path {...stroke} d="M12 21s7-5.3 7-11a7 7 0 0 0-14 0c0 5.7 7 11 7 11Z" /><circle {...stroke} cx="12" cy="10" r="2.5" /></>}
      {name === 'refresh' && <><path {...stroke} d="M5 12a7 7 0 0 1 12-5M19 12a7 7 0 0 1-12 5" /><path {...stroke} d="M17 4v4h-4M7 20v-4h4" /></>}
      {name === 'mail' && <><path {...stroke} d="M4 6h16v12H4z" /><path {...stroke} d="m4 7 8 6 8-6" /></>}
      {name === 'close' && <><path {...stroke} d="M6 6l12 12M18 6 6 18" /></>}
      {name === 'arrow' && <><path {...stroke} d="M5 12h14M13 6l6 6-6 6" /></>}
      {name === 'bars' && <><path {...stroke} d="M6 18V9M12 18V5M18 18v-6" /></>}
    </svg>
  )
}

export default App
