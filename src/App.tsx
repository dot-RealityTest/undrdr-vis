import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import './App.css'

type RepoStatus = 'Underrated' | 'Rising' | 'Near 1K' | 'Crossed 1K' | 'Archived/Inactive'
type SectionId = 'discover' | 'browse' | 'new' | 'rising' | 'near' | 'crossed' | 'topics' | 'favorites' | 'submit' | 'data' | 'about'
type SortMode = 'curated' | 'stars' | 'newest' | 'rising' | 'updated' | 'closest'
type DiscoveryModeId = 'surprise' | 'rising' | 'fresh' | 'almost' | 'local' | 'agents' | 'apple'

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
  submittedFromIssue?: string
  submittedReason?: string
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

function normalizeSiteUrl(value?: string) {
  const fallback = 'https://akakika.com/undrdr/'
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

const SITE_CONFIG: SiteConfig = {
  siteUrl: normalizeSiteUrl(import.meta.env.VITE_SITE_URL),
  activeHost: hostFromUrl(normalizeSiteUrl(import.meta.env.VITE_SITE_URL)),
  targetDomain: import.meta.env.VITE_TARGET_DOMAIN || 'undrdr.com',
  siteEmail: import.meta.env.VITE_SITE_EMAIL || 'submit@undrdr.com',
}

function submissionMailto(siteEmail: string) {
  const subject = encodeURIComponent('UND-RDR repo submission')
  const body = encodeURIComponent([
    'GitHub repo URL:',
    '',
    'Why should UND-RDR track it?',
    '',
    'Your contact:',
  ].join('\n'))
  return `mailto:${siteEmail}?subject=${subject}&body=${body}`
}

const NAV_ITEMS: Array<{ id: SectionId; label: string }> = [
  { id: 'discover', label: 'Discover' },
  { id: 'browse', label: 'Browse' },
  { id: 'new', label: 'New' },
  { id: 'rising', label: 'Rising' },
  { id: 'near', label: 'Near 1K' },
  { id: 'crossed', label: 'Crossed 1K' },
  { id: 'topics', label: 'Topics' },
  { id: 'favorites', label: 'Watchlist' },
  { id: 'submit', label: 'Submit' },
  { id: 'data', label: 'Data' },
  { id: 'about', label: 'About' },
]

const VIEW_IDS = new Set<SectionId>(NAV_ITEMS.map((item) => item.id))

function readHashView(): SectionId {
  if (typeof window === 'undefined') return 'discover'
  const raw = window.location.hash.replace(/^#\/?/, '').trim()
  const normalized = raw === 'repo-index' ? 'browse' : raw
  return VIEW_IDS.has(normalized as SectionId) ? normalized as SectionId : 'discover'
}

function writeHashView(view: SectionId) {
  if (typeof window === 'undefined') return
  const next = `#/${view}`
  if (window.location.hash === next) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  window.location.hash = `/${view}`
}

const STATUS_OPTIONS: Array<'all' | RepoStatus> = ['all', 'Underrated', 'Rising', 'Near 1K', 'Crossed 1K', 'Archived/Inactive']
type SignalIconName = 'agent' | 'mcp' | 'apple' | 'cli' | 'local' | 'automation' | 'security' | 'web' | 'data' | 'repo' | 'github'
const DISCOVERY_MODES: Array<{ id: DiscoveryModeId; label: string; detail: string; icon: SignalIconName }> = [
  { id: 'surprise', label: 'Surprise me', detail: 'Jump to one signal', icon: 'repo' },
  { id: 'rising', label: 'Fast risers', detail: 'Momentum first', icon: 'automation' },
  { id: 'fresh', label: 'Fresh finds', detail: 'Newest seen', icon: 'github' },
  { id: 'almost', label: 'Almost famous', detail: 'Near 1K', icon: 'web' },
  { id: 'local', label: 'Local AI', detail: 'Private and self-hosted', icon: 'local' },
  { id: 'agents', label: 'Agents', detail: 'Agentic tools', icon: 'agent' },
  { id: 'apple', label: 'Apple/macOS', detail: 'Mac-native finds', icon: 'apple' },
]
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

function formatSubmissionDelivery(delivery: SubmissionReceipt['delivery'], submittedAt: string) {
  if (delivery === 'github-issue') return 'issue created'
  if (delivery === 'webhook') return 'sent'
  if (delivery === 'email') return 'emailed'
  if (delivery === 'validated-only') return 'received'
  return formatDate(submittedAt)
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

function statusDisplayLabel(status: RepoStatus) {
  if (status === 'Crossed 1K') return 'Graduated'
  if (status === 'Near 1K') return 'Almost famous'
  if (status === 'Rising') return 'Heating up'
  if (status === 'Archived/Inactive') return 'Inactive'
  return 'Underrated'
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
  const [submissions, setSubmissions] = useState<SubmissionReceipt[]>(() => readStoredArray<SubmissionReceipt>('undrdr-submission-receipts'))
  const [mockUser, setMockUser] = useState<MockUser | null>(() => readStoredUser())
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readStoredArray<string>('undrdr-mock-favorites'))
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('all')
  const [topic, setTopic] = useState('all')
  const [status, setStatus] = useState<'all' | RepoStatus>('all')
  const [sort, setSort] = useState<SortMode>('curated')
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null)
  const [hoveredRepoId, setHoveredRepoId] = useState<string | null>(null)
  const [isPreviewFading, setIsPreviewFading] = useState(false)
  const [previewTick, setPreviewTick] = useState(0)
  const [activeView, setActiveView] = useState<SectionId>(() => readHashView())

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
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setHoveredRepoId(null)
    }

    window.addEventListener('keydown', closeWithEscape)
    return () => window.removeEventListener('keydown', closeWithEscape)
  }, [])

  useEffect(() => {
    function syncHashView() {
      setActiveView(readHashView())
      setHoveredRepoId(null)
      setIsPreviewFading(false)
      setSelectedRepoId(null)
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    }

    syncHashView()
    window.addEventListener('hashchange', syncHashView)
    return () => window.removeEventListener('hashchange', syncHashView)
  }, [])

  useEffect(() => {
    if (!hoveredRepoId || selectedRepoId) return undefined

    const fadeTimer = window.setTimeout(() => setIsPreviewFading(true), 3600)
    const closeTimer = window.setTimeout(() => {
      setHoveredRepoId(null)
      setIsPreviewFading(false)
    }, 4300)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(closeTimer)
    }
  }, [hoveredRepoId, selectedRepoId, previewTick])

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
  const newestPage = useMemo(() => [...repos].sort((a, b) => daysSince(a.firstSeen) - daysSince(b.firstSeen)), [repos])
  const newest = useMemo(() => newestPage.slice(0, 8), [newestPage])
  const communityFinds = useMemo(() => repos
    .filter((repo) => repo.wave === 'submitted' || Boolean(repo.submittedFromIssue))
    .sort((a, b) => daysSince(a.firstSeen) - daysSince(b.firstSeen))
    .slice(0, 6), [repos])
  const risingPage = useMemo(() => repos.filter((repo) => repo.statusLabel === 'Rising').sort((a, b) => b.growthScore - a.growthScore), [repos])
  const nearOneKPage = useMemo(() => repos.filter((repo) => repo.statusLabel === 'Near 1K').sort((a, b) => b.stars - a.stars), [repos])
  const crossedPage = useMemo(() => repos.filter((repo) => repo.statusLabel === 'Crossed 1K').sort((a, b) => b.stars - a.stars), [repos])
  const rising = useMemo(() => risingPage.slice(0, 8), [risingPage])
  const nearOneK = useMemo(() => nearOneKPage.slice(0, 8), [nearOneKPage])
  const crossed = useMemo(() => crossedPage.slice(0, 8), [crossedPage])
  const trendingTopics = topics.slice(0, 14)
  const repoIds = useMemo(() => new Set(repos.map((repo) => repo.id)), [repos])
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const favoriteRepos = useMemo(() => repos.filter((repo) => favoriteSet.has(repo.id)), [repos, favoriteSet])
  const selectedRepo = useMemo(() => repos.find((repo) => repo.id === selectedRepoId) || null, [repos, selectedRepoId])
  const hoveredRepo = useMemo(() => repos.find((repo) => repo.id === hoveredRepoId) || null, [repos, hoveredRepoId])
  const hoveredNextRepo = useMemo(() => hoveredRepo ? relatedReposFor(hoveredRepo, repos, 1)[0] || null : null, [hoveredRepo, repos])
  const visibleRepos = useMemo(() => filtered.slice(0, 80), [filtered])
  const selectedBrowseIndex = selectedRepo ? visibleRepos.findIndex((repo) => repo.id === selectedRepo.id) : -1
  const previousRepo = selectedBrowseIndex > 0 ? visibleRepos[selectedBrowseIndex - 1] : null
  const nextRepo = selectedBrowseIndex >= 0 && selectedBrowseIndex < visibleRepos.length - 1 ? visibleRepos[selectedBrowseIndex + 1] : null
  const relatedRepos = useMemo(() => selectedRepo ? relatedReposFor(selectedRepo, repos, 4) : [], [repos, selectedRepo])

  function resetFilters() {
    setQuery('')
    setLanguage('all')
    setTopic('all')
    setStatus('all')
    setSort('curated')
  }

  function jumpToIndex() {
    writeHashView('browse')
  }

  function handlePreviewRepo(repoId: string | null) {
    if (!repoId) return
    setIsPreviewFading(false)
    setHoveredRepoId(repoId)
    setPreviewTick((value) => value + 1)
  }

  function closePreview() {
    setIsPreviewFading(false)
    setHoveredRepoId(null)
  }

  function applyDiscoveryMode(modeId: DiscoveryModeId) {
    resetFilters()

    if (modeId === 'surprise') {
      const pool = repos.length ? repos : filtered
      const repo = pool[Math.floor(Math.random() * Math.max(pool.length, 1))]
      if (repo) {
        setQuery(repo.displayName)
        setHoveredRepoId(repo.id)
      }
      setSort('curated')
    }

    if (modeId === 'rising') {
      setStatus('Rising')
      setSort('rising')
    }

    if (modeId === 'fresh') {
      setSort('newest')
    }

    if (modeId === 'almost') {
      setStatus('Near 1K')
      setSort('closest')
    }

    if (modeId === 'local') {
      setQuery('local')
      setSort('curated')
    }

    if (modeId === 'agents') {
      setQuery('agent')
      setSort('rising')
    }

    if (modeId === 'apple') {
      setQuery('macos')
      setSort('updated')
    }

    jumpToIndex()
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

  const searchPanel = (
    <div className="search-panel" aria-label="Repository search and filters">
      <label className="search-box">
        <span>Search the index</span>
        <input
          name="repo-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') writeHashView('browse')
          }}
          placeholder="repo, owner, language, topic..."
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
      <button className="search-submit" type="button" onClick={() => writeHashView('browse')}>Browse results</button>
    </div>
  )

  return (
    <main className="app-shell">
      <a className="skip-link" href="#/browse">Skip to Repository Index</a>
      <header className="site-header">
        <a className="wordmark" href="#/discover" aria-label="UND-RDR home">
          <img className="wordmark-mark" src="./assets/undrdr-discovery-icon-bright.png" alt="" aria-hidden="true" />
          <span>UND-RDR</span>
        </a>
        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <a key={item.id} href={`#/${item.id}`} aria-current={activeView === item.id ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <AuthControl user={mockUser} favoriteCount={favoriteIds.length} onSignIn={mockSignIn} onSignOut={mockSignOut} />
      </header>

      {activeView === 'discover' && (
        <>
      <section className="hero" id="discover">
        <div className="hero-copy">
          <h1>{formatNumber(stats.total)} underrated GitHub repos.</h1>
          <p>Browse what is heating up before it gets obvious. Hover for the signal, click a card to open the repo, and keep moving from one find to the next.</p>
        </div>
        {searchPanel}
      </section>

      <DiscoveryModes onSelect={applyDiscoveryMode} />

      <section className="metrics" aria-label="Dataset summary">
        <Metric label="Repos tracked" value={stats.total} />
        <Metric label="Under 1K" value={stats.underOneK} />
        <Metric label="Heating up" value={stats.rising} />
        <Metric label="Almost famous" value={stats.near} />
        <Metric label="Graduated" value={stats.crossed} />
      </section>

      <SignalSystem />

      <StatusBanner loadState={loadState} duplicateCount={duplicates.length} />

      <UpdateReportPanel report={report} />

      <SectionHeader eyebrow="Featured" title="High-Signal Finds" detail="Projects with unusual momentum, strong topics, or graduation signals." />
      <RepoGrid repos={featured} favoriteIds={favoriteSet} isLoggedIn={Boolean(mockUser)} onPreviewRepo={handlePreviewRepo} onToggleFavorite={toggleFavorite} emptyTitle="No featured repos yet" emptyDetail="Marked gems and strong momentum signals will appear here." />

      <section className="community-section" aria-label="Community submitted repositories">
        <div>
          <p>Submitted</p>
          <h2>Community Finds</h2>
          <span>Repos accepted through the public submission review flow.</span>
        </div>
        <div className="community-list">
          {communityFinds.length
            ? communityFinds.map((repo) => <MiniRepo key={repo.id} repo={repo} />)
            : <StateBlock title="No community finds yet" detail="Accepted public submissions will appear here." compact />}
        </div>
      </section>

      <section className="split-sections">
        <RepoRail id="new" title="Fresh Finds" repos={newest} />
        <RepoRail id="rising" title="Heating Up" repos={rising} />
        <RepoRail id="near" title="Almost Famous" repos={nearOneK} />
        <RepoRail id="crossed" title="Graduated" repos={crossed} emptyDetail="No graduated repos are present in this snapshot yet." />
      </section>
        </>
      )}

      {activeView === 'browse' && (
        <section className="index-section browse-view" id="browse" aria-label="Repository index">
          <div className="index-heading">
            <div>
              <p>Live Browse</p>
              <h2>{filtered.length} repos</h2>
            </div>
            <button className="reset-button" onClick={resetFilters}>Reset filters</button>
          </div>
          <div className="browse-search">{searchPanel}</div>

          {loadState === 'loading' && <StateBlock title="Loading repo data" detail="Reading the local UND-RDR repository dataset." />}
          {loadState === 'error' && <StateBlock title="Could not load repo data" detail="The app could not read public/data/all_repos.json. The backup copy is preserved in backups/." />}
          {loadState === 'ready' && filtered.length === 0 && <StateBlock title="No results after filters" detail="Try a broader topic, status, or language." />}
          {loadState === 'ready' && filtered.length > 0 && <RepoList repos={visibleRepos} favoriteIds={favoriteSet} isLoggedIn={Boolean(mockUser)} onPreviewRepo={handlePreviewRepo} onToggleFavorite={toggleFavorite} />}
        </section>
      )}

      {activeView === 'new' && <FocusedRepoSection id="new" eyebrow="New" title="Fresh Finds" detail="The newest projects added to the UND-RDR index." repos={newestPage.slice(0, 80)} favoriteIds={favoriteSet} isLoggedIn={Boolean(mockUser)} onPreviewRepo={handlePreviewRepo} onToggleFavorite={toggleFavorite} />}
      {activeView === 'rising' && <FocusedRepoSection id="rising" eyebrow="Rising" title="Heating Up" detail="Repos with the strongest current momentum signal." repos={risingPage.slice(0, 80)} favoriteIds={favoriteSet} isLoggedIn={Boolean(mockUser)} onPreviewRepo={handlePreviewRepo} onToggleFavorite={toggleFavorite} />}
      {activeView === 'near' && <FocusedRepoSection id="near" eyebrow="Near 1K" title="Almost Famous" detail="Projects close to graduating from underrated." repos={nearOneKPage.slice(0, 80)} favoriteIds={favoriteSet} isLoggedIn={Boolean(mockUser)} onPreviewRepo={handlePreviewRepo} onToggleFavorite={toggleFavorite} />}
      {activeView === 'crossed' && <FocusedRepoSection id="crossed" eyebrow="Crossed 1K" title="Graduated" detail="Repos that crossed the 1,000-star threshold and stayed in the archive." repos={crossedPage.slice(0, 80)} favoriteIds={favoriteSet} isLoggedIn={Boolean(mockUser)} onPreviewRepo={handlePreviewRepo} onToggleFavorite={toggleFavorite} />}

      {activeView === 'topics' && <section className="topics-section view-section" id="topics">
        <SectionHeader eyebrow="Today" title="Trending Topics" detail="Topic density from the local repo index. Daily external trend discovery can plug in here later." />
        <div className="topic-grid">
          {trendingTopics.map(([name, count], index) => (
            <button key={name} onClick={() => { setTopic(name); setQuery(''); setStatus('all'); setSort('curated'); writeHashView('browse') }} className={topic === name ? 'active' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{name}</strong>
              <em>{count}</em>
            </button>
          ))}
        </div>
      </section>}

      {activeView === 'submit' && <SubmitRepoSection siteConfig={SITE_CONFIG} existingRepoIds={repoIds} submissions={submissions} onClear={clearSubmissionReceipts} onSubmit={handleSubmissionReceipt} />}

      {activeView === 'favorites' && <section className="favorites-section" id="favorites" aria-label="Repository watchlist">
        <div className="index-heading">
          <div>
            <p>Watchlist</p>
            <h2>{mockUser ? `${favoriteRepos.length} saved repos` : 'Watchlist requires login'}</h2>
          </div>
          {!mockUser && <button className="reset-button" onClick={mockSignIn}>Mock login</button>}
        </div>
        {!mockUser && <StateBlock title="Log in to save repos" detail="Your watchlist is personal, so this mock keeps it behind a local sign-in state." />}
        {mockUser && favoriteRepos.length === 0 && <StateBlock title="No saved repos yet" detail="Use the star on repo cards to build your personal watchlist." />}
        {mockUser && favoriteRepos.length > 0 && <RepoList repos={favoriteRepos} favoriteIds={favoriteSet} isLoggedIn={Boolean(mockUser)} onPreviewRepo={handlePreviewRepo} onToggleFavorite={toggleFavorite} />}
      </section>}

      {hoveredRepo && !selectedRepo && (
        <HoverPreview
          repo={hoveredRepo}
          nextRepo={hoveredNextRepo}
          isFading={isPreviewFading}
          onClose={closePreview}
          onPreviewRepo={handlePreviewRepo}
        />
      )}

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

      {activeView === 'data' && (
        <>
          <UpdateReportPanel report={report} />
          <MethodSection siteConfig={SITE_CONFIG} stats={stats} report={report} duplicateCount={duplicates.length} />
        </>
      )}

      {activeView === 'about' && <section className="about-section" id="about">
        <div>
          <p>About UND-RDR</p>
          <h2>UND-RDR tracks underrated GitHub projects before they become famous.</h2>
        </div>
        <div className="about-grid">
          <Definition title="Underrated" detail="A project still under 1,000 stars." />
          <Definition title="Heating up" detail="A project with star growth or curated momentum signals." />
          <Definition title="Almost famous" detail="A project close to crossing the 1,000-star threshold." />
          <Definition title="Graduated" detail="A project that crossed 1,000 stars and left the underrated zone." />
          <Definition title="Submit a repo" detail={<><a className="inline-link" href={submissionMailto(SITE_CONFIG.siteEmail)}>{SITE_CONFIG.siteEmail}</a> or use the protected Submit form.</>} />
        </div>
      </section>}
    </main>
  )
}

function MethodSection({ siteConfig, stats, report, duplicateCount }: { siteConfig: SiteConfig; stats: { total: number; underOneK: number; rising: number; near: number; crossed: number }; report: UpdateReport | null; duplicateCount: number }) {
  const freshness = report
    ? `Latest local GitHub check: ${formatDate(report.checkedAt)} across ${formatNumber(report.checkedCount)} repos.`
    : 'Daily automation is prepared, but not fully connected yet.'
  const isTargetDomain = siteConfig.activeHost === siteConfig.targetDomain
  const submissionDetail = siteConfig.siteEmail
    ? `Submissions go through a protected intake check now. Mail forwarding can route review copies to ${siteConfig.siteEmail}.`
    : `Submissions go through a protected intake check now. Add a webhook or review inbox when ${siteConfig.targetDomain} operations are ready.`
  const domainDetail = isTargetDomain
    ? `Metadata is targeting ${siteConfig.siteUrl}. Keep akaKika redirects alive until the move is verified.`
    : `UND-RDR stays under ${siteConfig.siteUrl} for now. Set VITE_SITE_URL to https://${siteConfig.targetDomain}/ when the domain is connected.`

  return (
    <section className="method-section" id="data" aria-label="Data and method">
      <div className="method-intro">
        <p>Data / Method</p>
        <h2>The index is protected first, then designed around discovery.</h2>
        <span>UND-RDR keeps the raw repository snapshot intact while the interface turns it into readable signals: fresh, rising, almost famous, and graduated.</span>
      </div>
      <div className="method-grid">
        <Definition title="Source" detail={`This build reads ${formatNumber(stats.total)} repos from the protected local JSON snapshot. The UI does not rewrite the raw data.`} />
        <Definition title="Threshold" detail={`${formatNumber(stats.underOneK)} repos are still under 1,000 stars. Repos that cross the line graduate instead of disappearing.`} />
        <Definition title="Signals" detail={`${formatNumber(stats.rising)} heating up, ${formatNumber(stats.near)} almost famous, and ${formatNumber(stats.crossed)} graduated repos are derived from star counts and growth fields.`} />
        <Definition title="Freshness" detail={freshness} />
        <Definition title="Protection" detail={`Validation checks for duplicate IDs and repo loss before changes ship. Current duplicate groups: ${duplicateCount}.`} />
        <Definition title="Submissions" detail={submissionDetail} />
        <Definition title="Automation" detail="The next backend pass should run a daily GitHub check, update stars, detect 1K crossings, and record growth deltas." />
        <Definition title="Domain" detail={domainDetail} />
      </div>
    </section>
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
      <a href="#/favorites">{favoriteCount} saved</a>
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

function SubmitRepoSection({ siteConfig, existingRepoIds, submissions, onClear, onSubmit }: { siteConfig: SiteConfig; existingRepoIds: Set<string>; submissions: SubmissionReceipt[]; onClear: () => void; onSubmit: (submission: SubmissionReceipt) => void }) {
  const [repoUrl, setRepoUrl] = useState('')
  const [reason, setReason] = useState('')
  const [contact, setContact] = useState('')
  const [website, setWebsite] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [messageKind, setMessageKind] = useState<'info' | 'success' | 'warning'>('info')
  const [message, setMessage] = useState('Submissions are validated by UND-RDR intake before review. The live dataset is never changed automatically.')
  const slug = normalizeSlug(repoUrl)
  const isDuplicate = Boolean(slug && existingRepoIds.has(slug))
  const intakeText = siteConfig.siteEmail
    ? <>Use the form for protected review, or email <a className="inline-link" href={submissionMailto(siteConfig.siteEmail)}>{siteConfig.siteEmail}</a>.</>
    : `Submissions are received through a protected intake endpoint. Add a review email or webhook later to forward them outside ${siteConfig.targetDomain}.`

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
        body: JSON.stringify({
          repoUrl,
          reason,
          contact,
          website,
        }),
      })
      const result = await response.json() as SubmitResponse

      if (!response.ok || !result.ok || !result.submission) {
        setMessageKind('warning')
        setMessage(result.message || 'Submission could not be received. Try again later.')
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
      setMessage('Submission endpoint could not be reached. Try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="submit-section" id="submit">
      <div className="submit-copy">
        <p>Submit</p>
        <h2>Know an underrated repo?</h2>
        <span>{intakeText}</span>
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
        <label className="submit-honeypot" aria-hidden="true">
          <span>Website</span>
          <input
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
        <div className={`submit-note ${isDuplicate || messageKind === 'warning' ? 'warning' : ''} ${messageKind === 'success' ? 'success' : ''}`} aria-live="polite">{message}</div>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Checking...' : 'Submit for review'}</button>
      </form>
      <div className="submission-preview">
        <div className="queue-heading">
          <strong>Review receipts</strong>
          {submissions.length > 0 && <button type="button" onClick={onClear}>Clear</button>}
        </div>
        {submissions.length ? submissions.slice(0, 4).map((item) => (
          <a key={item.id || `${item.repoUrl}-${item.submittedAt}`} href={item.reviewUrl || item.repoUrl} target="_blank" rel="noreferrer">
            <span>{normalizeSlug(item.repoUrl)}</span>
            <em>{formatSubmissionDelivery(item.delivery, item.submittedAt)}</em>
          </a>
        )) : <span>No submissions received in this browser yet.</span>}
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

function DiscoveryModes({ onSelect }: { onSelect: (modeId: DiscoveryModeId) => void }) {
  return (
    <section className="discovery-modes" aria-label="Discovery modes">
      <div>
        <p>Discovery modes</p>
        <span>Pick a path through the index.</span>
      </div>
      <div className="mode-buttons">
        {DISCOVERY_MODES.map((mode) => (
          <button key={mode.id} type="button" onClick={() => onSelect(mode.id)}>
            <SignalIcon name={mode.icon} />
            <strong>{mode.label}</strong>
            <span>{mode.detail}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function HoverPreview({ repo, nextRepo, isFading, onClose, onPreviewRepo }: { repo: RepoView; nextRepo: RepoView | null; isFading: boolean; onClose: () => void; onPreviewRepo: (repoId: string | null) => void }) {
  const iconName = repoSignalIcon(repo)
  const delta = repo.dailyStarDelta || repo.weeklyStarDelta || 0
  const topTopics = repo.allTopics.slice(0, 3)

  return (
    <aside
      className={`hover-preview ${isFading ? 'is-fading' : ''}`}
      style={{ '--status-color': statusColor(repo.statusLabel) } as CSSProperties}
      aria-label={`${repo.displayName} preview`}
      onMouseEnter={() => onPreviewRepo(repo.id)}
      onMouseLeave={() => onPreviewRepo(null)}
      onPointerEnter={() => onPreviewRepo(repo.id)}
      onFocus={() => onPreviewRepo(repo.id)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null
        if (!event.currentTarget.contains(nextTarget)) onPreviewRepo(null)
      }}
    >
      <div className="hover-preview-topline">
        <p className="hover-preview-kicker"><SignalIcon name={iconName} /> Current signal</p>
        <button type="button" onClick={onClose} aria-label="Close preview">Close</button>
      </div>
      <h3>{repo.displayName}</h3>
      <span className="hover-preview-description">{repo.description || 'No description available yet.'}</span>
      <div className="hover-preview-reason">
        <strong>Why here</strong>
        <span>{repo.statusReason}</span>
      </div>
      <div className="hover-preview-meta">
        <em><SignalIcon name="github" />{repo.ownerName}/{repo.name}</em>
        <strong>{formatNumber(repo.stars)} stars</strong>
        <em>{repo.language || 'Unknown'}</em>
        {delta > 0 && <strong>+{formatNumber(delta)} signal</strong>}
      </div>
      {topTopics.length > 0 && (
        <div className="hover-preview-topics" aria-hidden="true">
          {topTopics.map((item) => <span key={item}>{item}</span>)}
        </div>
      )}
      {nextRepo && (
        <button type="button" className="next-signal" onClick={() => onPreviewRepo(nextRepo.id)}>
          <span>Next signal</span>
          <strong>{nextRepo.displayName}</strong>
          <em>{nextRepo.language || 'Unknown'} · {formatNumber(nextRepo.stars)} stars</em>
        </button>
      )}
      <a className="hover-preview-open" href={repo.repoUrl} target="_blank" rel="noreferrer">
        Open on GitHub
      </a>
    </aside>
  )
}

function RepoGrid({ repos, favoriteIds, isLoggedIn, onPreviewRepo, onToggleFavorite, emptyTitle, emptyDetail }: { repos: RepoView[]; favoriteIds: Set<string>; isLoggedIn: boolean; onPreviewRepo: (repoId: string | null) => void; onToggleFavorite: (repoId: string) => void; emptyTitle: string; emptyDetail: string }) {
  if (!repos.length) return <StateBlock title={emptyTitle} detail={emptyDetail} />
  return (
    <section className="repo-grid">
      {repos.map((repo) => (
        <RepoCard
          key={repo.id}
          repo={repo}
          isFavorite={favoriteIds.has(repo.id)}
          isLoggedIn={isLoggedIn}
          onPreviewRepo={onPreviewRepo}
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

function RepoList({ repos, favoriteIds, isLoggedIn, onPreviewRepo, onToggleFavorite }: { repos: RepoView[]; favoriteIds: Set<string>; isLoggedIn: boolean; onPreviewRepo: (repoId: string | null) => void; onToggleFavorite: (repoId: string) => void }) {
  return (
    <div className="repo-list">
      {repos.map((repo) => (
        <RepoCard
          key={repo.id}
          repo={repo}
          compact
          isFavorite={favoriteIds.has(repo.id)}
          isLoggedIn={isLoggedIn}
          onPreviewRepo={onPreviewRepo}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  )
}

function FocusedRepoSection({ id, eyebrow, title, detail, repos, favoriteIds, isLoggedIn, onPreviewRepo, onToggleFavorite }: { id: SectionId; eyebrow: string; title: string; detail: string; repos: RepoView[]; favoriteIds: Set<string>; isLoggedIn: boolean; onPreviewRepo: (repoId: string | null) => void; onToggleFavorite: (repoId: string) => void }) {
  return (
    <section className="index-section focused-view" id={id} aria-label={title}>
      <div className="index-heading">
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span className="view-count">{formatNumber(repos.length)} repos</span>
      </div>
      <p className="view-detail">{detail}</p>
      {repos.length
        ? <RepoList repos={repos} favoriteIds={favoriteIds} isLoggedIn={isLoggedIn} onPreviewRepo={onPreviewRepo} onToggleFavorite={onToggleFavorite} />
        : <StateBlock title="No repos yet" detail="This view is ready for the next dataset refresh." />}
    </section>
  )
}

function RepoCard({ repo, isFavorite, isLoggedIn, onPreviewRepo, onToggleFavorite, compact = false }: { repo: RepoView; isFavorite: boolean; isLoggedIn: boolean; onPreviewRepo: (repoId: string | null) => void; onToggleFavorite: (repoId: string) => void; compact?: boolean }) {
  const favoriteLabel = isLoggedIn ? (isFavorite ? 'Saved' : 'Save') : 'Login to save'
  const favoriteAriaLabel = isLoggedIn ? `${isFavorite ? 'Remove saved repo' : 'Save repo'}: ${repo.displayName}` : `Log in to save ${repo.displayName}`
  const repoOpenLabel = `Open ${repo.displayName} on GitHub. ${statusDisplayLabel(repo.statusLabel)}. ${formatNumber(repo.stars)} stars. ${repo.language || 'Unknown'} repository.`
  const iconName = repoSignalIcon(repo)

  return (
    <article
      className={`repo-card ${compact ? 'compact' : ''}`}
      style={{ '--status-color': statusColor(repo.statusLabel) } as CSSProperties}
      onMouseEnter={() => onPreviewRepo(repo.id)}
      onMouseLeave={() => onPreviewRepo(null)}
      onPointerEnter={() => onPreviewRepo(repo.id)}
      onFocus={() => onPreviewRepo(repo.id)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null
        if (!event.currentTarget.contains(nextTarget)) onPreviewRepo(null)
      }}
    >
      <a
        className="card-open-link"
        href={repo.repoUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={repoOpenLabel}
        title={`Open ${repo.displayName} on GitHub`}
        onMouseEnter={() => onPreviewRepo(repo.id)}
        onPointerEnter={() => onPreviewRepo(repo.id)}
        onFocus={() => onPreviewRepo(repo.id)}
      />
      <div className="card-topline">
        <span className="status-badge">{!compact && <SignalIcon name={iconName} />}{statusDisplayLabel(repo.statusLabel)}</span>
        <span className="card-actions">
          <span>{repo.language || 'Unknown'}</span>
          <button
            className={`favorite-button ${isFavorite ? 'active' : ''}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (!isLoggedIn) return
              onToggleFavorite(repo.id)
            }}
            aria-disabled={!isLoggedIn}
            title={isLoggedIn ? favoriteLabel : 'Mock login before saving favorites'}
            aria-label={favoriteAriaLabel}
          >
            <StarIcon filled={isFavorite} />
          </button>
        </span>
      </div>
      <div className="repo-identity">
        <span className="repo-icon" aria-hidden="true"><SignalIcon name={iconName} /></span>
        <div>
          <span className="repo-title repo-title-link">{repo.displayName}</span>
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
        <div className="card-meta">
          <strong>{formatNumber(repo.stars)} stars</strong>
          <span>Updated {formatDate(repo.lastUpdated)}</span>
        </div>
      </div>
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
          <span className="detail-status">{statusDisplayLabel(repo.statusLabel)}</span>
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
                  <span><SignalIcon name={repoSignalIcon(related)} />{statusDisplayLabel(related.statusLabel)}</span>
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

function Definition({ title, detail }: { title: string; detail: ReactNode }) {
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
