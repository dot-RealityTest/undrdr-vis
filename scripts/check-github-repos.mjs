import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_DATA_PATH = 'public/data/all_repos.json'
const MIN_REPO_COUNT = 683

const options = parseArgs(process.argv.slice(2))
const dataPath = path.resolve(options.data || DEFAULT_DATA_PATH)
const outputDir = path.resolve(options.outDir || 'data/github-checks')
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
const now = new Date().toISOString()

const rawRepos = readJsonArray(dataPath)
const seen = new Set()
const duplicates = []

for (const repo of rawRepos) {
  const id = repoId(repo)
  if (seen.has(id)) duplicates.push(id)
  seen.add(id)
}

if (rawRepos.length < MIN_REPO_COUNT) {
  throw new Error(`Refusing to run: expected at least ${MIN_REPO_COUNT} repos, found ${rawRepos.length}`)
}

if (duplicates.length) {
  throw new Error(`Refusing to run: duplicate repos detected: ${duplicates.slice(0, 10).join(', ')}`)
}

const selectedRepos = Number.isFinite(options.limit) ? rawRepos.slice(0, options.limit) : rawRepos
const updatedById = new Map()
const failures = []

console.log(`UND-RDR GitHub check`)
console.log(`- source: ${dataPath}`)
console.log(`- repos in dataset: ${rawRepos.length}`)
console.log(`- repos to check: ${selectedRepos.length}`)
console.log(`- mode: ${options.apply ? 'apply' : 'dry-run'}`)
console.log(`- auth: ${token ? 'token detected' : 'unauthenticated GitHub API'}`)

for (const [index, repo] of selectedRepos.entries()) {
  const parsed = parseGitHubRepo(repo.url || repo.full_name)
  if (!parsed) {
    failures.push({ id: repoId(repo), reason: 'invalid-github-url' })
    updatedById.set(repoId(repo), markUnavailable(repo, now, 'Invalid GitHub URL'))
    continue
  }

  process.stdout.write(`Checking ${index + 1}/${selectedRepos.length} ${parsed.owner}/${parsed.name}... `)

  try {
    const metadata = await fetchGitHubRepo(parsed.owner, parsed.name, token)
    const nextRepo = mergeGitHubMetadata(repo, metadata, now)
    updatedById.set(repoId(repo), nextRepo)
    console.log(`${repo.stars || 0} -> ${nextRepo.stars} stars (${nextRepo.status})`)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    failures.push({ id: repoId(repo), reason })
    updatedById.set(repoId(repo), markUnavailable(repo, now, reason))
    console.log(`failed: ${reason}`)
  }

  if (options.delayMs > 0 && index < selectedRepos.length - 1) {
    await sleep(options.delayMs)
  }
}

const nextRepos = rawRepos.map((repo) => updatedById.get(repoId(repo)) || repo)
validateNoDataLoss(rawRepos, nextRepos)

fs.mkdirSync(outputDir, { recursive: true })
const stamp = now.replace(/[:.]/g, '-')
const snapshotPath = path.join(outputDir, `all_repos-${stamp}.json`)
const reportPath = path.join(outputDir, `github-check-report-${stamp}.json`)
const report = buildReport(rawRepos, nextRepos, selectedRepos.length, failures, now)

fs.writeFileSync(snapshotPath, `${JSON.stringify(nextRepos, null, 2)}\n`)
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

if (options.apply) {
  const backupPath = path.resolve('backups', `pre-github-check-${stamp}.json`)
  fs.mkdirSync(path.dirname(backupPath), { recursive: true })
  fs.copyFileSync(dataPath, backupPath)
  fs.writeFileSync(dataPath, `${JSON.stringify(nextRepos, null, 2)}\n`)
  console.log(`- applied live data update: ${dataPath}`)
  console.log(`- pre-apply backup: ${backupPath}`)
} else {
  console.log(`- dry-run snapshot: ${snapshotPath}`)
  console.log(`- dry-run report: ${reportPath}`)
  console.log(`- live dataset was not changed`)
}

console.log(`- checked: ${selectedRepos.length}`)
console.log(`- failures: ${failures.length}`)
console.log(`- crossed 1K: ${report.statusCounts['Crossed 1K'] || 0}`)
console.log(`- near 1K: ${report.statusCounts['Near 1K'] || 0}`)
console.log(`- rising: ${report.statusCounts.Rising || 0}`)

function parseArgs(args) {
  const parsed = {
    apply: false,
    data: DEFAULT_DATA_PATH,
    outDir: 'data/github-checks',
    delayMs: 350,
    limit: Number.POSITIVE_INFINITY,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--apply') parsed.apply = true
    else if (arg === '--data') parsed.data = args[++index]
    else if (arg === '--out-dir') parsed.outDir = args[++index]
    else if (arg === '--limit') parsed.limit = Number(args[++index])
    else if (arg === '--delay-ms') parsed.delayMs = Number(args[++index])
    else if (arg === '--help') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (!Number.isFinite(parsed.delayMs) || parsed.delayMs < 0) {
    throw new Error('--delay-ms must be a non-negative number')
  }

  if (!Number.isFinite(parsed.limit) && parsed.limit !== Number.POSITIVE_INFINITY) {
    throw new Error('--limit must be a number')
  }

  return parsed
}

function printHelp() {
  console.log(`Usage: node scripts/check-github-repos.mjs [options]

Options:
  --limit <n>       Check only the first n repos. Useful for safe samples.
  --apply           Replace public/data/all_repos.json after writing a backup.
  --data <path>     Dataset path. Default: ${DEFAULT_DATA_PATH}
  --out-dir <path>  Snapshot/report output directory. Default: data/github-checks
  --delay-ms <n>    Delay between GitHub API calls. Default: 350

Environment:
  GITHUB_TOKEN or GH_TOKEN increases GitHub API rate limits.
`)
}

function readJsonArray(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!Array.isArray(value)) throw new Error(`${filePath} must contain a JSON array`)
  return value
}

function repoId(repo) {
  const parsed = parseGitHubRepo(repo.url || repo.full_name)
  return (repo.full_name || (parsed ? `${parsed.owner}/${parsed.name}` : repo.url || repo.name || '')).toLowerCase()
}

function parseGitHubRepo(value = '') {
  const asString = String(value)
  const urlMatch = asString.match(/github\.com\/([^/\s]+)\/([^/#?\s]+)(?:[/?#]|$)/i)
  if (urlMatch) return { owner: cleanPart(urlMatch[1]), name: cleanPart(urlMatch[2]) }

  const fullNameMatch = asString.match(/^([^/\s]+)\/([^/\s]+)$/)
  if (fullNameMatch) return { owner: cleanPart(fullNameMatch[1]), name: cleanPart(fullNameMatch[2]) }

  return null
}

function cleanPart(value) {
  return value.replace(/\.git$/i, '')
}

async function fetchGitHubRepo(owner, name, authToken) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'undrdr-github-check',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  })

  if (response.status === 404) {
    throw new Error('repo-no-longer-available')
  }

  if (response.status === 403) {
    const reset = response.headers.get('x-ratelimit-reset')
    const resetDate = reset ? new Date(Number(reset) * 1000).toISOString() : 'unknown'
    throw new Error(`github-rate-limited; reset=${resetDate}`)
  }

  if (!response.ok) {
    throw new Error(`github-api-${response.status}`)
  }

  return response.json()
}

function mergeGitHubMetadata(repo, metadata, checkedAt) {
  const previousStars = Number(repo.stars || 0)
  const stars = Number(metadata.stargazers_count || 0)
  const dailyStarDelta = stars - previousStars
  const weeklyStarDelta = deriveWeeklyDelta(repo, stars)
  const crossedOneKAt = repo.crossedOneKAt || (previousStars < 1000 && stars >= 1000 ? checkedAt : null)
  const status = inferStatus({
    stars,
    dailyStarDelta,
    weeklyStarDelta,
    archived: Boolean(metadata.archived || metadata.disabled),
    pushed_at: metadata.pushed_at,
    updated_at: metadata.updated_at,
  })

  return {
    ...repo,
    id: repo.id || `${metadata.owner?.login || repo.owner}/${metadata.name || repo.name}`.toLowerCase(),
    repoUrl: metadata.html_url || repo.repoUrl || repo.url,
    url: metadata.html_url || repo.url,
    owner: metadata.owner?.login || repo.owner,
    name: metadata.name || repo.name,
    full_name: metadata.full_name || repo.full_name,
    description: metadata.description || repo.description || '',
    previousStars,
    stars,
    forks: metadata.forks_count ?? repo.forks,
    watchers: metadata.watchers_count ?? repo.watchers,
    open_issues: metadata.open_issues_count ?? repo.open_issues,
    language: metadata.language ?? repo.language ?? null,
    topics: Array.isArray(metadata.topics) ? metadata.topics : repo.topics || [],
    license: metadata.license?.spdx_id || repo.license || null,
    created_at: metadata.created_at || repo.created_at,
    updated_at: metadata.updated_at || repo.updated_at,
    pushed_at: metadata.pushed_at || repo.pushed_at,
    firstSeenAt: repo.firstSeenAt || repo.created_at || checkedAt,
    lastCheckedAt: checkedAt,
    lastGitHubUpdatedAt: metadata.pushed_at || metadata.updated_at || checkedAt,
    crossedOneKAt,
    dailyStarDelta,
    weeklyStarDelta,
    status,
    unavailable: false,
    unavailableReason: null,
  }
}

function deriveWeeklyDelta(repo, stars) {
  if (Number.isFinite(repo.weeklyStarDelta)) return repo.weeklyStarDelta + (stars - Number(repo.stars || 0))
  return stars - Number(repo.previousStars ?? repo.stars ?? stars)
}

function markUnavailable(repo, checkedAt, reason) {
  return {
    ...repo,
    previousStars: Number(repo.stars || 0),
    dailyStarDelta: 0,
    weeklyStarDelta: Number(repo.weeklyStarDelta || 0),
    lastCheckedAt: checkedAt,
    status: reason === 'repo-no-longer-available' ? 'Archived/Inactive' : repo.status || inferStatus(repo),
    unavailable: true,
    unavailableReason: reason,
  }
}

function inferStatus(repo) {
  if (repo.archived || repo.disabled) return 'Archived/Inactive'
  if (Number(repo.stars || 0) >= 1000) return 'Crossed 1K'
  if (Number(repo.stars || 0) >= 900) return 'Near 1K'
  if (Number(repo.dailyStarDelta || 0) >= 3 || Number(repo.weeklyStarDelta || 0) >= 12 || daysSince(repo.pushed_at || repo.updated_at) <= 7) {
    return 'Rising'
  }
  return 'Underrated'
}

function validateNoDataLoss(before, after) {
  if (after.length !== before.length) {
    throw new Error(`Refusing to write: repo count changed from ${before.length} to ${after.length}`)
  }

  const beforeIds = new Set(before.map(repoId))
  const missing = after.filter((repo) => !beforeIds.has(repoId(repo)))
  if (missing.length) {
    throw new Error(`Refusing to write: repo identity changed for ${missing.length} records`)
  }
}

function buildReport(before, after, checkedCount, failuresList, checkedAt) {
  const beforeById = new Map(before.map((repo) => [repoId(repo), repo]))
  const statusCounts = {}
  const crossed = []
  const near = []
  const rising = []
  const unavailable = []

  for (const repo of after) {
    const status = repo.status || inferStatus(repo)
    statusCounts[status] = (statusCounts[status] || 0) + 1
    const previous = beforeById.get(repoId(repo))

    if (status === 'Crossed 1K') crossed.push(summary(repo, previous))
    if (status === 'Near 1K') near.push(summary(repo, previous))
    if (status === 'Rising') rising.push(summary(repo, previous))
    if (repo.unavailable) unavailable.push(summary(repo, previous))
  }

  return {
    checkedAt,
    source: dataPath,
    checkedCount,
    totalRepos: after.length,
    statusCounts,
    failures: failuresList,
    crossedOneK: crossed,
    nearOneK: near.sort((a, b) => b.stars - a.stars).slice(0, 25),
    rising: rising.sort((a, b) => b.dailyStarDelta - a.dailyStarDelta).slice(0, 25),
    unavailable,
  }
}

function summary(repo, previous) {
  return {
    full_name: repo.full_name,
    url: repo.url,
    stars: repo.stars,
    previousStars: repo.previousStars ?? previous?.stars ?? repo.stars,
    dailyStarDelta: repo.dailyStarDelta || 0,
    weeklyStarDelta: repo.weeklyStarDelta || 0,
    status: repo.status || inferStatus(repo),
  }
}

function daysSince(value) {
  if (!value) return 99999
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 99999
  return Math.max(0, Math.floor((Date.now() - time) / 86400000))
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
