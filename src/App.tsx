import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './App.css'

type RepoStatus = 'Underrated' | 'Rising' | 'Near 1K' | 'Crossed 1K' | 'Archived/Inactive'
type Route = 'discover' | 'collections' | 'submit' | 'about' | 'watchlist'
type Tier = 'fresh' | 'rising' | 'hidden' | 'near1k' | 'graduated' | 'inactive'
type LoadState = 'loading' | 'ready' | 'error'

type Repo = {
  name: string
  full_name?: string
  description?: string
  stars: number
  forks?: number
  language?: string | null
  topics?: string[]
  tags?: string[]
  url?: string
  repoUrl?: string
  owner?: string
  license?: string | null
  updated_at?: string
  pushed_at?: string
  created_at?: string
  firstSeenAt?: string
  lastGitHubUpdatedAt?: string
  crossedOneKAt?: string
  status?: RepoStatus
  category?: string
  wave?: string
  archived?: boolean
  disabled?: boolean
  unavailable?: boolean
  unavailableReason?: string
  submittedReason?: string
  dailyStarDelta?: number
  weeklyStarDelta?: number
}

type RepoView = Repo & {
  id: string
  ownerName: string
  repoName: string
  repoUrl: string
  statusLabel: RepoStatus
  tier: Tier
  topicsAll: string[]
  lastUpdated: string | null
  firstSeen: string | null
  signal: number
  longDesc: string
}

type UpdateReport = {
  checkedAt: string
  checkedCount: number
  failures: Array<{ id: string; reason: string }>
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

const SITE_EMAIL = import.meta.env.VITE_SITE_EMAIL || 'submit@undrdr.com'
const readmeCache = new Map<string, string>()

function formatNumber(value = 0) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return String(value)
}

function formatDate(value?: string | null) {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
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

function submissionMailto() {
  const subject = encodeURIComponent('UND-RDR repo submission')
  const body = encodeURIComponent(['GitHub repo URL:', '', 'Why should UND-RDR track it?', '', 'Your contact:'].join('\n'))
  return `mailto:${SITE_EMAIL}?subject=${subject}&body=${body}`
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

function routeFromHash(): Route {
  if (typeof window === 'undefined') return 'discover'
  const raw = window.location.hash.replace(/^#\/?/, '')
  if (raw === 'collections' || raw === 'submit' || raw === 'about' || raw === 'watchlist') return raw
  if (raw === 'favorites') return 'watchlist'
  return 'discover'
}

function inferStatus(repo: Repo): RepoStatus {
  if (repo.status) return repo.status
  if (repo.archived || repo.disabled || repo.unavailable) return 'Archived/Inactive'
  if (repo.stars >= 1000) return 'Crossed 1K'
  if (repo.stars >= 900) return 'Near 1K'
  if ((repo.dailyStarDelta || 0) >= 3 || (repo.weeklyStarDelta || 0) >= 12 || repo.wave === 'rising') return 'Rising'
  return 'Underrated'
}

function tierFor(repo: Repo, status: RepoStatus): Tier {
  if (status === 'Archived/Inactive') return 'inactive'
  if (status === 'Crossed 1K') return 'graduated'
  if (status === 'Near 1K' || repo.stars >= 500) return 'near1k'
  if (status === 'Rising' || repo.stars >= 50) return 'rising'
  if (daysSince(repo.firstSeenAt || repo.created_at) <= 30 || repo.wave === 'new') return 'fresh'
  return 'hidden'
}

function tierLabel(tier: Tier) {
  if (tier === 'near1k') return 'Near 1K'
  if (tier === 'graduated') return 'Graduated'
  if (tier === 'inactive') return 'Inactive'
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

function tierPhrase(tier: Tier) {
  if (tier === 'fresh') return ['Fresh find', 'This repo was recently discovered by UND-RDR.']
  if (tier === 'rising') return ['Rising fast', 'Momentum is visible in the current snapshot.']
  if (tier === 'hidden') return ['Hidden gem', 'Still quiet, still worth inspecting.']
  if (tier === 'near1k') return ['Almost famous', 'Close to leaving the underrated zone.']
  if (tier === 'graduated') return ['Graduated', 'This repo crossed the 1,000-star threshold.']
  return ['Needs review', 'This repo may be archived, inactive, or unavailable.']
}

function languageColor(language?: string | null) {
  const map: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f1e05a',
    Python: '#3572A5',
    Rust: '#dea584',
    Go: '#00ADD8',
    Swift: '#f05138',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Ruby: '#701516',
  }
  return map[language || ''] || '#a5a8a4'
}

function normalizeRepo(repo: Repo): RepoView {
  const repoUrl = repo.repoUrl || repo.url || ''
  const fullName = repo.full_name || slugFromUrl(repoUrl) || repo.name
  const [ownerName, repoNameFromFull] = fullName.split('/')
  const statusLabel = inferStatus(repo)
  const tier = tierFor(repo, statusLabel)
  const lastUpdated = repo.lastGitHubUpdatedAt || repo.pushed_at || repo.updated_at || null
  const firstSeen = repo.firstSeenAt || repo.created_at || null
  const topicsAll = Array.from(new Set([...(repo.topics || []), ...(repo.tags || []), repo.category, repo.wave].filter(Boolean) as string[])).slice(0, 10)
  const signal = Math.min(4, Math.max(1, Math.ceil(((repo.dailyStarDelta || 0) * 10 + (repo.weeklyStarDelta || 0) + Math.max(0, 40 - daysSince(lastUpdated))) / 25)))
  const longDesc = [
    repo.description || 'No description is available yet.',
    repo.submittedReason ? `Why it is here: ${repo.submittedReason}` : '',
    `Current status: ${tierPhrase(tier)[0]}.`,
  ].filter(Boolean).join(' ')

  return {
    ...repo,
    id: fullName.toLowerCase(),
    ownerName: repo.owner || ownerName || 'unknown',
    repoName: repo.name || repoNameFromFull || fullName,
    repoUrl,
    statusLabel,
    tier,
    topicsAll,
    lastUpdated,
    firstSeen,
    signal,
    longDesc,
  }
}

function App() {
  const [repos, setRepos] = useState<RepoView[]>([])
  const [report, setReport] = useState<UpdateReport | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [route, setRoute] = useState<Route>(() => routeFromHash())
  const [activeTier, setActiveTier] = useState<'all' | Tier>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(() => window.localStorage.getItem('undrdr-mock-user') === 'true')
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readStoredArray<string>('undrdr-mock-favorites'))
  const [submissions, setSubmissions] = useState<SubmissionReceipt[]>(() => readStoredArray<SubmissionReceipt>('undrdr-submission-receipts'))
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
    function syncRoute() {
      setRoute(routeFromHash())
      setSelectedId(null)
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    }

    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const selectedRepo = useMemo(() => repos.find((repo) => repo.id === selectedId) || null, [repos, selectedId])
  const repoIds = useMemo(() => new Set(repos.map((repo) => repo.id)), [repos])
  const stats = useMemo(() => ({
    total: repos.length,
    fresh: repos.filter((repo) => repo.tier === 'fresh').length,
    rising: repos.filter((repo) => repo.tier === 'rising').length,
    hidden: repos.filter((repo) => repo.tier === 'hidden').length,
    near: repos.filter((repo) => repo.tier === 'near1k').length,
    graduated: repos.filter((repo) => repo.tier === 'graduated').length,
    underOneK: repos.filter((repo) => repo.stars < 1000).length,
  }), [repos])

  const visibleRepos = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return repos
      .filter((repo) => activeTier === 'all' || repo.tier === activeTier)
      .filter((repo) => {
        if (!needle) return true
        return [repo.ownerName, repo.repoName, repo.description, repo.language, repo.statusLabel, ...repo.topicsAll].join(' ').toLowerCase().includes(needle)
      })
      .sort((a, b) => {
        if (activeTier === 'fresh') return daysSince(a.firstSeen) - daysSince(b.firstSeen)
        if (activeTier === 'rising') return (b.dailyStarDelta || 0) - (a.dailyStarDelta || 0) || (b.weeklyStarDelta || 0) - (a.weeklyStarDelta || 0)
        if (activeTier === 'near1k') return Math.abs(1000 - a.stars) - Math.abs(1000 - b.stars)
        return b.signal - a.signal || b.stars - a.stars
      })
      .slice(0, 120)
  }, [repos, activeTier, query])

  const selectedIndex = selectedRepo ? visibleRepos.findIndex((repo) => repo.id === selectedRepo.id) : -1
  const previousRepo = selectedIndex > 0 ? visibleRepos[selectedIndex - 1] : null
  const nextRepo = selectedIndex >= 0 && selectedIndex < visibleRepos.length - 1 ? visibleRepos[selectedIndex + 1] : null
  const relatedRepos = useMemo(() => selectedRepo ? relatedReposFor(selectedRepo, repos, 3) : [], [selectedRepo, repos])

  useEffect(() => {
    if (!selectedRepo) return undefined
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedId(null)
      if (event.key === 'ArrowLeft' && previousRepo) setSelectedId(previousRepo.id)
      if (event.key === 'ArrowRight' && nextRepo) setSelectedId(nextRepo.id)
      if (event.key === 'Enter' && relatedRepos[0]) setSelectedId(relatedRepos[0].id)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKey)
    }
  }, [selectedRepo, previousRepo, nextRepo, relatedRepos])

  function go(nextRoute: Route) {
    setRoute(nextRoute)
    window.location.hash = nextRoute === 'discover' ? '' : `/${nextRoute}`
  }

  function toggleLogin() {
    const next = !isLoggedIn
    setIsLoggedIn(next)
    window.localStorage.setItem('undrdr-mock-user', String(next))
    if (!next) {
      setFavoriteIds([])
      window.localStorage.removeItem('undrdr-mock-favorites')
    }
    setToast(next ? 'Signed in locally. Saving is enabled.' : 'Signed out.')
  }

  function toggleFavorite(repoId: string) {
    if (!isLoggedIn) {
      setToast('Sign in to save repos.')
      return
    }
    const next = favoriteSet.has(repoId) ? favoriteIds.filter((id) => id !== repoId) : [repoId, ...favoriteIds]
    setFavoriteIds(next)
    window.localStorage.setItem('undrdr-mock-favorites', JSON.stringify(next))
  }

  function addSubmission(submission: SubmissionReceipt) {
    const next = [submission, ...submissions].slice(0, 20)
    setSubmissions(next)
    window.localStorage.setItem('undrdr-submission-receipts', JSON.stringify(next))
  }

  function clearSubmissions() {
    setSubmissions([])
    window.localStorage.removeItem('undrdr-submission-receipts')
  }

  return (
    <>
      <Header route={route} savedCount={favoriteIds.length} isLoggedIn={isLoggedIn} onRoute={go} onLogin={toggleLogin} />
      {route === 'discover' && (
        <>
          <Hero stats={stats} />
          <DiscoveryBar activeTier={activeTier} query={query} stats={stats} onTier={setActiveTier} onQuery={setQuery} onSurprise={() => visibleRepos[0] && setSelectedId(visibleRepos[Math.floor(Math.random() * visibleRepos.length)].id)} />
          <RepoGrid repos={visibleRepos} report={report} loadState={loadState} favoriteSet={favoriteSet} isLoggedIn={isLoggedIn} onOpen={setSelectedId} onFavorite={toggleFavorite} />
        </>
      )}
      {route === 'collections' && <CollectionsPage repos={repos} onPick={(term) => { setQuery(term); setActiveTier('all'); go('discover') }} />}
      {route === 'submit' && <SubmitPage repoIds={repoIds} submissions={submissions} onSubmit={addSubmission} onClear={clearSubmissions} />}
      {route === 'about' && <AboutPage stats={stats} />}
      {route === 'watchlist' && <WatchlistPage repos={repos.filter((repo) => favoriteSet.has(repo.id))} favoriteSet={favoriteSet} isLoggedIn={isLoggedIn} onLogin={toggleLogin} onOpen={setSelectedId} onFavorite={toggleFavorite} />}
      <DetailOverlay repo={selectedRepo} previousRepo={previousRepo} nextRepo={nextRepo} relatedRepos={relatedRepos} isOpen={Boolean(selectedRepo)} isLoggedIn={isLoggedIn} isFavorite={selectedRepo ? favoriteSet.has(selectedRepo.id) : false} onClose={() => setSelectedId(null)} onSelect={setSelectedId} onFavorite={toggleFavorite} />
      <SiteFooter onRoute={go} onTier={(tier) => { setActiveTier(tier); go('discover') }} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}

function Header({ route, savedCount, isLoggedIn, onRoute, onLogin }: { route: Route; savedCount: number; isLoggedIn: boolean; onRoute: (route: Route) => void; onLogin: () => void }) {
  return (
    <header className="header">
      <div className="container header-inner">
        <button type="button" className="logo" onClick={() => onRoute('discover')}>
          <LogoIcon size={22} />
          UND-RDR
        </button>
        <nav className="nav">
          <a className={route === 'discover' ? 'active' : ''} onClick={() => onRoute('discover')}>Discover</a>
          <a className={route === 'collections' ? 'active' : ''} onClick={() => onRoute('collections')}>Collections <StarSmall /></a>
          <a className={route === 'submit' ? 'active' : ''} onClick={() => onRoute('submit')}>Submit</a>
          <a className={route === 'about' ? 'active' : ''} onClick={() => onRoute('about')}>About</a>
        </nav>
        <div className="nav-right">
          {isLoggedIn && <a className="saved-count" onClick={() => onRoute('watchlist')}>{savedCount} saved</a>}
          <a className="login-btn" onClick={onLogin}><UserIcon />{isLoggedIn ? 'Sign out' : 'Sign in'}</a>
        </div>
      </div>
    </header>
  )
}

function Hero({ stats }: { stats: { total: number; underOneK: number; fresh: number; graduated: number } }) {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-inner">
          <div>
            <div className="hero-label"><span className="dot" /> Live index</div>
            <h1>Find what<br />everyone <em>missed</em></h1>
            <p className="hero-sub">Open-source gems with 0-1K stars. The best projects are the ones nobody&apos;s talking about yet.</p>
          </div>
          <div className="hero-stats">
            <HeroStat value={stats.total} label="repos tracked" />
            <HeroStat value={stats.fresh} label="fresh finds" />
            <HeroStat value={stats.underOneK} label="under 1K" />
            <HeroStat value={stats.graduated} label="graduated" />
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return <div className="hero-stat"><span className="hero-stat-val">{formatNumber(value)}</span><span className="hero-stat-label">{label}</span></div>
}

function DiscoveryBar({ activeTier, query, stats, onTier, onQuery, onSurprise }: { activeTier: 'all' | Tier; query: string; stats: { total: number; fresh: number; rising: number; hidden: number; near: number; graduated: number }; onTier: (tier: 'all' | Tier) => void; onQuery: (query: string) => void; onSurprise: () => void }) {
  return (
    <div className="discovery-bar">
      <div className="container">
        <div className="discovery-inner">
          <div className="tabs">
            <Tab active={activeTier === 'all'} label="All" count={formatNumber(stats.total)} icon="grid" onClick={() => onTier('all')} />
            <Tab active={activeTier === 'fresh'} label="Fresh" count={formatNumber(stats.fresh)} icon="sprout" onClick={() => onTier('fresh')} />
            <Tab active={activeTier === 'rising'} label="Rising" count={formatNumber(stats.rising)} icon="rise" onClick={() => onTier('rising')} />
            <Tab active={activeTier === 'hidden'} label="Hidden" count={formatNumber(stats.hidden)} icon="gem" onClick={() => onTier('hidden')} />
            <Tab active={activeTier === 'near1k'} label="Near 1K" count={formatNumber(stats.near)} icon="rocket" onClick={() => onTier('near1k')} />
            <Tab active={activeTier === 'graduated'} label="Graduated" count={formatNumber(stats.graduated)} icon="cap" onClick={() => onTier('graduated')} />
            <button className="tab" onClick={onSurprise}><DiceIcon /> Surprise me</button>
          </div>
          <div className="search-field">
            <SearchIcon />
            <input type="text" placeholder="Search repos, topics..." value={query} onChange={(event) => onQuery(event.target.value)} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Tab({ active, label, count, icon, onClick }: { active: boolean; label: string; count: string; icon: 'grid' | 'sprout' | 'rise' | 'gem' | 'rocket' | 'cap'; onClick: () => void }) {
  return <button className={`tab ${active ? 'active' : ''}`} onClick={onClick}>{tabIcon(icon)}{label} <span className="tab-count">{count}</span></button>
}

function RepoGrid({ repos, report, loadState, favoriteSet, isLoggedIn, onOpen, onFavorite }: { repos: RepoView[]; report: UpdateReport | null; loadState: LoadState; favoriteSet: Set<string>; isLoggedIn: boolean; onOpen: (id: string) => void; onFavorite: (id: string) => void }) {
  return (
    <main className="repos">
      <div className="container">
        <div className="section-head">
          <h2>Today&apos;s discoveries</h2>
          <span className="meta">{formatNumber(repos.length)} repos · {report ? `checked ${formatDate(report.checkedAt)}` : loadState === 'loading' ? 'loading' : 'live snapshot'}</span>
        </div>
        {loadState === 'loading' && <EmptyState title="Loading repo data" detail="Reading the protected UND-RDR dataset." />}
        {loadState === 'error' && <EmptyState title="Could not load repo data" detail="The app could not read public/data/all_repos.json." />}
        {loadState === 'ready' && repos.length === 0 && <EmptyState title="No repos found" detail="Try another tab or search term." />}
        {repos.length > 0 && (
          <div className="repo-grid" id="repoGrid">
            {repos.map((repo) => <RepoCard key={repo.id} repo={repo} starred={favoriteSet.has(repo.id)} isLoggedIn={isLoggedIn} onOpen={onOpen} onFavorite={onFavorite} />)}
          </div>
        )}
      </div>
    </main>
  )
}

function RepoCard({ repo, starred, isLoggedIn, onOpen, onFavorite }: { repo: RepoView; starred: boolean; isLoggedIn: boolean; onOpen: (id: string) => void; onFavorite: (id: string) => void }) {
  return (
    <article className="repo-card" data-tier={repo.tier} tabIndex={0} onClick={() => onOpen(repo.id)} onKeyDown={(event) => event.key === 'Enter' && onOpen(repo.id)}>
      <div className="repo-top">
        <div className="repo-id">
          <GitHubMark width={16} />
          <span className="repo-id-name"><span>{repo.ownerName}/</span>{repo.repoName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span className={`tier-tag ${repo.tier}`}>{tierLabel(repo.tier)}</span>
          <button className={`card-star ${starred ? 'starred' : ''}`} onClick={(event) => { event.stopPropagation(); onFavorite(repo.id) }} data-starred={starred}>
            <span className="card-star-tip">{isLoggedIn ? (starred ? 'Saved' : 'Save') : 'Sign in to save'}</span>
            <StarIcon filled={starred} />
          </button>
        </div>
      </div>
      <p className="repo-desc">{repo.description || 'No description available yet.'}</p>
      <div className="repo-foot">
        <span className="repo-foot-item stars"><StarOutline />{formatNumber(repo.stars)}</span>
        <span className="repo-foot-item lang-dot" style={{ '--dot': languageColor(repo.language) } as React.CSSProperties}>{repo.language || 'Unknown'}</span>
        <span className="repo-foot-item"><ForkIcon />{formatNumber(repo.forks || 0)}</span>
        <span className="repo-foot-item">{formatDate(repo.lastUpdated)}</span>
        <SignalBars value={repo.signal} />
      </div>
    </article>
  )
}

function DetailOverlay({ repo, previousRepo, nextRepo, relatedRepos, isOpen, isLoggedIn, isFavorite, onClose, onSelect, onFavorite }: { repo: RepoView | null; previousRepo: RepoView | null; nextRepo: RepoView | null; relatedRepos: RepoView[]; isOpen: boolean; isLoggedIn: boolean; isFavorite: boolean; onClose: () => void; onSelect: (id: string) => void; onFavorite: (id: string) => void }) {
  if (!repo) {
    return <div className="overlay" id="overlay" />
  }

  const [tierTitle, tierDetail] = tierPhrase(repo.tier)

  return (
    <div className={`overlay ${isOpen ? 'open' : ''}`} id="overlay">
      <div className="overlay-bg" onClick={onClose} />
      <div className="detail-panel" id="detailPanel">
        <div className="detail-close">
          <button className="detail-close-btn" onClick={onClose}>
            <CloseIcon /> Close <kbd>ESC</kbd>
          </button>
          <div className="detail-nav-btns">
            <button className="detail-nav-btn" disabled={!previousRepo} onClick={() => previousRepo && onSelect(previousRepo.id)} title="Previous repo"><ChevronLeft /></button>
            <button className="detail-nav-btn" disabled={!nextRepo} onClick={() => nextRepo && onSelect(nextRepo.id)} title="Next repo"><ChevronRight /></button>
          </div>
        </div>

        <div className="detail-body" id="detailBody">
          <div className="detail-repo-header">
            <div className="detail-avatar"><RepoAvatar repo={repo} /></div>
            <div>
              <div className="detail-repo-title"><span>{repo.ownerName}/</span>{repo.repoName}</div>
              <div className="detail-repo-sub">{repo.language || 'Unknown'} · {formatDate(repo.lastUpdated)}</div>
            </div>
          </div>

          <div className="detail-tier-bar">
            <span className={`tier-tag ${repo.tier}`}>{tierLabel(repo.tier)}</span>
            <div className="detail-tier-text"><strong>{tierTitle}</strong> — {tierDetail}</div>
          </div>

          <p className="detail-desc">{repo.longDesc}</p>

          <div className="detail-stats">
            <DetailStat value={formatNumber(repo.stars)} label="Stars" />
            <DetailStat value={formatNumber(repo.forks || 0)} label="Forks" />
            <DetailStat value={`${repo.signal}/4`} label="Signal" />
            <DetailStat value={signalText(repo.signal)} label="Momentum" />
          </div>

          <div className="detail-topics">
            {(repo.topicsAll.length ? repo.topicsAll : ['open-source']).map((topic) => <span className="detail-topic" key={topic}>{topic}</span>)}
          </div>

          <div className="detail-readme">
            <div className="detail-readme-header"><BookIcon /> README.md</div>
            <ReadmePreview key={repo.id} repo={repo} />
          </div>

          <div className="detail-actions">
            <a href={repo.repoUrl} target="_blank" rel="noreferrer" className="btn-primary"><GitHubMark width={14} /> View on GitHub</a>
            <button className="btn-ghost detail-star-btn" onClick={() => onFavorite(repo.id)}>
              <StarIcon filled={isFavorite} /> {isLoggedIn ? (isFavorite ? 'Saved' : 'Save') : 'Sign in to save'}
            </button>
          </div>
        </div>

        <div className="next-strip" id="nextStrip">
          <div className="next-strip-label"><RiseIcon /> Next discovery</div>
          <div id="nextCards">
            {relatedRepos.map((item) => <NextCard key={item.id} repo={item} onSelect={onSelect} />)}
          </div>
          <div className="keyboard-hint">
            <span><kbd>←</kbd> <kbd>→</kbd> navigate</span>
            <span><kbd>ESC</kbd> close</span>
            <span><kbd>↵</kbd> open next</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function NextCard({ repo, onSelect }: { repo: RepoView; onSelect: (id: string) => void }) {
  return (
    <div className="next-card" onClick={() => onSelect(repo.id)}>
      <div className="next-card-avatar"><RepoAvatar repo={repo} /></div>
      <div className="next-card-info">
        <div className="next-card-name"><span>{repo.ownerName}/</span>{repo.repoName}</div>
        <div className="next-card-desc">{repo.description || 'No description available yet.'}</div>
      </div>
      <div className="next-card-meta">
        <span className="next-card-stars"><StarOutline />{formatNumber(repo.stars)}</span>
        <span className="next-card-arrow"><ChevronRight /></span>
      </div>
    </div>
  )
}

function ReadmePreview({ repo }: { repo: RepoView }) {
  const [readme, setReadme] = useState<string | null>(() => readmeCache.get(repo.id) || null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(() => readmeCache.has(repo.id) ? 'ready' : 'loading')

  useEffect(() => {
    const cached = readmeCache.get(repo.id)
    if (cached) {
      return undefined
    }

    const controller = new AbortController()

    fetch(`https://api.github.com/repos/${repo.ownerName}/${repo.repoName}/readme`, {
      signal: controller.signal,
      headers: { accept: 'application/vnd.github+json' },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`README ${response.status}`)
        return response.json() as Promise<{ content?: string; encoding?: string }>
      })
      .then((data) => {
        if (!data.content) throw new Error('README is empty')
        const decoded = decodeGitHubContent(data.content)
        readmeCache.set(repo.id, decoded)
        setReadme(decoded)
        setState('ready')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState('error')
      })

    return () => controller.abort()
  }, [repo.id, repo.ownerName, repo.repoName])

  if (state === 'loading') {
    return <div className="detail-readme-body"><p className="readme-status">Loading original README from GitHub...</p></div>
  }

  if (state === 'error' || !readme) {
    return (
      <div className="detail-readme-body">
        <p className="readme-status">Original README preview is unavailable from GitHub right now.</p>
        <p><code>{repo.ownerName}/{repo.repoName}</code></p>
      </div>
    )
  }

  return (
    <div className="detail-readme-body readme-rendered">
      {renderReadmePreview(readmePreview(readme, repo.repoName))}
    </div>
  )
}

function decodeGitHubContent(content: string) {
  const clean = content.replace(/\s/g, '')
  const binary = window.atob(clean)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function readmePreview(readme: string, repoName: string) {
  let cleaned = readme
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<\/?p\b[^>]*>/gi, '')
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, '$1')
    .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()

  const lines = cleaned.split('\n')
  const headingIndex = lines.findIndex((line, index) => {
    if (index > 40) return false
    const normalized = line.replace(/^#+\s*/, '').trim().toLowerCase()
    return normalized === repoName.toLowerCase()
  })

  if (headingIndex > 0) {
    cleaned = lines.slice(headingIndex).join('\n').trim()
  }

  if (cleaned.length <= 2200) return cleaned
  return `${cleaned.slice(0, 2200).trimEnd()}\n\n...`
}

function renderReadmePreview(markdown: string) {
  const lines = markdown
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => !/^\s*!\[[^\]]*]\([^)]+\)\s*$/.test(line))

  const nodes: ReactNode[] = []
  let paragraph: string[] = []
  let bullets: string[] = []

  function flushParagraph() {
    if (!paragraph.length) return
    const text = paragraph.join(' ').replace(/\s+/g, ' ').trim()
    if (text) {
      nodes.push(<p key={`p-${nodes.length}`}>{renderInlineMarkdown(text)}</p>)
    }
    paragraph = []
  }

  function flushBullets() {
    if (!bullets.length) return
    nodes.push(
      <ul key={`ul-${nodes.length}`}>
        {bullets.map((item, index) => <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>)}
      </ul>,
    )
    bullets = []
  }

  lines.forEach((line) => {
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      flushBullets()
      return
    }

    const heading = trimmed.match(/^#{1,6}\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushBullets()
      nodes.push(<h3 key={`h-${nodes.length}`}>{renderInlineMarkdown(heading[1])}</h3>)
      return
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/)
    if (bullet) {
      flushParagraph()
      bullets.push(bullet[1])
      return
    }

    flushBullets()
    paragraph.push(trimmed)
  })

  flushParagraph()
  flushBullets()

  return nodes.length ? nodes : [<p key="empty">README preview is empty.</p>]
}

function renderInlineMarkdown(text: string) {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const raw = match[0]
    if (raw.startsWith('`')) {
      nodes.push(<code key={`code-${match.index}`}>{raw.slice(1, -1)}</code>)
    } else if (raw.startsWith('**')) {
      nodes.push(<strong key={`strong-${match.index}`}>{raw.slice(2, -2)}</strong>)
    } else {
      const link = raw.match(/^\[([^\]]+)]\(([^)]+)\)$/)
      const label = link?.[1] || raw
      const href = link?.[2] || ''
      if (/^https?:\/\//i.test(href)) {
        nodes.push(<a key={`link-${match.index}`} href={href} target="_blank" rel="noreferrer">{label}</a>)
      } else {
        nodes.push(label)
      }
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function CollectionsPage({ repos, onPick }: { repos: RepoView[]; onPick: (term: string) => void }) {
  const collections = [
    ['Rust Ecosystem', 'rust'],
    ['TypeScript Tools', 'typescript'],
    ['AI / ML', 'ai'],
    ['CLI & Terminal', 'cli'],
    ['Developer Experience', 'developer-tools'],
    ['Local AI', 'local'],
  ]
  return (
    <main className="page-panel">
      <div className="container">
        <div className="section-head">
          <h2>Collections</h2>
          <span className="meta">curated paths through {formatNumber(repos.length)} repos</span>
        </div>
        <div className="collection-grid">
          {collections.map(([label, term]) => {
            const count = repos.filter((repo) => [repo.ownerName, repo.repoName, repo.description, repo.language, ...repo.topicsAll].join(' ').toLowerCase().includes(term)).length
            return <button className="collection-card" key={term} onClick={() => onPick(term)}><strong>{label}</strong><span>Open this discovery path.</span><em>{formatNumber(count)} repos</em></button>
          })}
        </div>
      </div>
    </main>
  )
}

function SubmitPage({ repoIds, submissions, onSubmit, onClear }: { repoIds: Set<string>; submissions: SubmissionReceipt[]; onSubmit: (submission: SubmissionReceipt) => void; onClear: () => void }) {
  const [repoUrl, setRepoUrl] = useState('')
  const [reason, setReason] = useState('')
  const [contact, setContact] = useState('')
  const [website, setWebsite] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('Submissions create a protected review issue. The live dataset is never changed automatically.')
  const [messageKind, setMessageKind] = useState<'info' | 'success' | 'warning'>('info')
  const slug = normalizeSlug(repoUrl)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!slug) {
      setMessageKind('warning')
      setMessage('Paste a full GitHub repo URL, like https://github.com/owner/repo.')
      return
    }
    if (repoIds.has(slug)) {
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
      setMessage(result.message || 'Repository received for review.')
    } catch {
      setMessageKind('warning')
      setMessage('Submission endpoint could not be reached. Email the repo instead.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-panel">
      <div className="container">
        <div className="section-head">
          <h2>Submit</h2>
          <span className="meta">or email <a href={submissionMailto()}>{SITE_EMAIL}</a></span>
        </div>
        <div className="submit-layout">
          <form className="submit-form" onSubmit={submit}>
            <label>GitHub repo URL<input type="url" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/owner/repo" /></label>
            <label>Why should UND-RDR track it?<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Short reason, topic, or discovery note..." /></label>
            <label>Contact optional<input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="email or GitHub handle..." /></label>
            <label className="honeypot">Website<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} /></label>
            <div className={`submit-note ${messageKind}`}>{message}</div>
            <button className="btn-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Checking...' : 'Submit for review'}</button>
          </form>
          <aside className="receipt-panel">
            <div className="receipt-panel-head"><strong>Review receipts</strong>{submissions.length > 0 && <button onClick={onClear}>Clear</button>}</div>
            {submissions.length ? submissions.slice(0, 6).map((item) => <a key={item.id || item.submittedAt} href={item.reviewUrl || item.repoUrl} target="_blank" rel="noreferrer"><strong>{normalizeSlug(item.repoUrl)}</strong><span>{formatSubmissionDelivery(item.delivery, item.submittedAt)}</span></a>) : <span>No submissions received in this browser yet.</span>}
          </aside>
        </div>
      </div>
    </main>
  )
}

function AboutPage({ stats }: { stats: { total: number; underOneK: number; rising: number; graduated: number } }) {
  return (
    <main className="page-panel">
      <div className="container">
        <div className="section-head">
          <h2>About UND-RDR</h2>
          <span className="meta">{formatNumber(stats.total)} repos · {formatNumber(stats.underOneK)} under 1K</span>
        </div>
        <div className="about-grid">
          <InfoCard title="Underrated" detail="A project still under 1,000 stars." />
          <InfoCard title="Rising" detail={`A project showing momentum. ${formatNumber(stats.rising)} are rising now.`} />
          <InfoCard title="Near 1K" detail="A project close to crossing the threshold." />
          <InfoCard title="Graduated" detail={`${formatNumber(stats.graduated)} repos crossed 1,000 stars and stayed in the archive.`} />
        </div>
      </div>
    </main>
  )
}

function WatchlistPage({ repos, favoriteSet, isLoggedIn, onLogin, onOpen, onFavorite }: { repos: RepoView[]; favoriteSet: Set<string>; isLoggedIn: boolean; onLogin: () => void; onOpen: (id: string) => void; onFavorite: (id: string) => void }) {
  return (
    <main className="repos page-panel">
      <div className="container">
        <div className="section-head">
          <h2>{isLoggedIn ? 'Saved repos' : 'Sign in to save repos'}</h2>
          <span className="meta">{formatNumber(repos.length)} saved</span>
        </div>
        {!isLoggedIn && <button className="btn-primary" onClick={onLogin}>Sign in</button>}
        {isLoggedIn && repos.length === 0 && <EmptyState title="No saved repos yet" detail="Use the star on repo cards to build your watchlist." />}
        {isLoggedIn && repos.length > 0 && <div className="repo-grid">{repos.map((repo) => <RepoCard key={repo.id} repo={repo} starred={favoriteSet.has(repo.id)} isLoggedIn onOpen={onOpen} onFavorite={onFavorite} />)}</div>}
      </div>
    </main>
  )
}

function SiteFooter({ onRoute, onTier }: { onRoute: (route: Route) => void; onTier: (tier: 'all' | Tier) => void }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand">
            <button className="footer-brand-logo" onClick={() => onRoute('discover')}><LogoIcon size={20} />UND-RDR</button>
            <p>A living discovery index for underrated open-source projects. Found early, before they become famous.</p>
            <div className="footer-social">
              <a href="https://github.com/dot-RealityTest" target="_blank" aria-label="GitHub" rel="noreferrer"><GitHubFill /></a>
              <a href="https://akakika.com" target="_blank" aria-label="Website" rel="noreferrer"><GlobeIcon /></a>
            </div>
          </div>
          <FooterColumn title="Discover" links={[['All Repos', () => onTier('all')], ['Fresh Finds', () => onTier('fresh')], ['Rising', () => onTier('rising')], ['Hidden Gems', () => onTier('hidden')], ['Graduated', () => onTier('graduated')]]} />
          <FooterColumn title="Collections" links={[['Rust Ecosystem', () => onRoute('collections')], ['TypeScript Tools', () => onRoute('collections')], ['AI / ML', () => onRoute('collections')], ['CLI & Terminal', () => onRoute('collections')], ['Developer Experience', () => onRoute('collections')]]} />
          <FooterColumn title="Kika's Universe" links={[['akakika.com', () => window.open('https://akakika.com', '_blank')], ['GitHub', () => window.open('https://github.com/dot-RealityTest/undrdr-vis', '_blank')], ['Submit a repo', () => onRoute('submit')]]} />
        </div>
        <hr className="footer-divider" />
        <div className="footer-bottom">
          <div className="footer-bottom-left"><LogoIcon size={12} /><span>© 2026 UND-RDR</span><span style={{ color: 'var(--faint)' }}>·</span><span className="footer-made">Made with <span className="heart">♥</span> for the open-source community</span></div>
          <div className="footer-bottom-right"><a onClick={() => onRoute('about')}>Privacy</a><a onClick={() => onRoute('about')}>Terms</a><a onClick={() => onRoute('about')}>RSS Feed</a><a onClick={() => onRoute('about')}>API</a></div>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, () => void]> }) {
  return <div className="footer-col"><h4>{title}</h4><ul>{links.map(([label, action]) => <li key={label}><a onClick={action}>{label}</a></li>)}</ul></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{detail}</span></div>
}

function InfoCard({ title, detail }: { title: string; detail: string }) {
  return <div className="about-card"><strong>{title}</strong><span>{detail}</span></div>
}

function DetailStat({ value, label }: { value: string; label: string }) {
  return <div className="detail-stat"><div className="detail-stat-val">{value}</div><div className="detail-stat-label">{label}</div></div>
}

function SignalBars({ value }: { value: number }) {
  return <span className="signal">{[1, 2, 3, 4].map((item) => <i key={item} className={item <= value ? 'on' : ''} />)}</span>
}

function RepoAvatar({ repo }: { repo: RepoView }) {
  if (/rust/i.test(repo.language || '')) return 'Rs'
  if (/type/i.test(repo.language || '')) return 'Ts'
  if (/python/i.test(repo.language || '')) return 'Py'
  if (/swift/i.test(repo.language || '')) return 'Sw'
  if (/go/i.test(repo.language || '')) return 'Go'
  return repo.repoName.slice(0, 2).toUpperCase()
}

function relatedReposFor(repo: RepoView, repos: RepoView[], limit = 3) {
  const topics = new Set(repo.topicsAll)
  return repos
    .filter((candidate) => candidate.id !== repo.id)
    .map((candidate) => ({
      repo: candidate,
      score: candidate.topicsAll.filter((topic) => topics.has(topic)).length * 3 + (candidate.language === repo.language ? 2 : 0) + (candidate.tier === repo.tier ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.repo.signal - a.repo.signal)
    .slice(0, limit)
    .map((item) => item.repo)
}

function signalText(signal: number) {
  if (signal <= 1) return 'Early'
  if (signal === 2) return 'Steady'
  if (signal === 3) return 'Rising'
  return 'Hot'
}

function formatSubmissionDelivery(delivery: SubmissionReceipt['delivery'], submittedAt: string) {
  if (delivery === 'github-issue') return 'issue created'
  if (delivery === 'webhook') return 'sent'
  if (delivery === 'email') return 'emailed'
  if (delivery === 'validated-only') return 'received'
  return formatDate(submittedAt)
}

function LogoIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /><line x1="12" y1="3" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="21" /><line x1="3" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="21" y2="12" /></svg>
}

function UserIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
}

function StarSmall() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.4"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
}

function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
}

function tabIcon(icon: 'grid' | 'sprout' | 'rise' | 'gem' | 'rocket' | 'cap') {
  if (icon === 'grid') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
  if (icon === 'sprout') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22V10" /><path d="M6 14c0-4 2.5-6 6-6" /><path d="M18 14c0-4-2.5-6-6-6" /><circle cx="12" cy="6" r="0.5" fill="currentColor" /></svg>
  if (icon === 'rise') return <RiseIcon />
  if (icon === 'gem') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3h12l4 6-10 13L2 9z" /><path d="M2 9h20" /><path d="M12 22L8 9" /><path d="M12 22l4-13" /></svg>
  if (icon === 'rocket') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" /><path d="M12 15l-3-3 5.12-5.12A7 7 0 0120.5 3.5a7 7 0 01-3.38 6.38z" /><path d="M12 15l3 3" /><circle cx="17" cy="7" r="0.5" fill="currentColor" /></svg>
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 10l-10-5L2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" /><line x1="22" y1="10" x2="22" y2="16" /></svg>
}

function RiseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
}

function DiceIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="0.8" fill="currentColor" /><circle cx="16" cy="8" r="0.8" fill="currentColor" /><circle cx="8" cy="16" r="0.8" fill="currentColor" /><circle cx="16" cy="16" r="0.8" fill="currentColor" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg>
}

function StarIcon({ filled }: { filled: boolean }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
}

function StarOutline() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" /></svg>
}

function ForkIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 012 2v7" /><path d="M11 18H8a2 2 0 01-2-2V9" /></svg>
}

function GitHubMark({ width }: { width: number }) {
  return <svg width={width} height={width} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M15 22v-4a4.8 4.8 0 00-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 004 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
}

function GitHubFill() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
}

function GlobeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
}

function CloseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}

function ChevronLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
}

function ChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
}

function BookIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
}

export default App
