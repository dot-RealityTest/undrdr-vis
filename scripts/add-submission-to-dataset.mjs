import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_DATA_PATH = 'public/data/all_repos.json'
const DEFAULT_REPO = process.env.SUBMISSIONS_GITHUB_REPO || 'dot-RealityTest/undrdr-vis'
const DEFAULT_ACCEPTED_LABEL = 'accepted'
const DEFAULT_ADDED_LABEL = 'added-to-index'

const options = parseArgs(process.argv.slice(2))
const dataPath = path.resolve(options.data || DEFAULT_DATA_PATH)
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || readGhToken()
const now = new Date().toISOString()

if (!options.issue) {
  throw new Error('Missing --issue <number>')
}

if (!token) {
  throw new Error('Missing GitHub token. Sign in with gh or set GITHUB_TOKEN.')
}

const issue = await fetchIssue(options.repo, options.issue, token)
const submittedRepo = options.repoUrl || extractRepoUrl(issue)
const parsed = parseGitHubRepo(submittedRepo)

if (!parsed) {
  throw new Error(`Could not find a GitHub repo URL in issue #${options.issue}`)
}

const repos = readJsonArray(dataPath)
const beforeCount = repos.length
const repoKey = `${parsed.owner}/${parsed.name}`.toLowerCase()
const existing = repos.find((repo) => repoId(repo) === repoKey)

if (existing) {
  throw new Error(`${repoKey} already exists in ${path.relative(process.cwd(), dataPath)}`)
}

const metadata = await fetchGitHubRepo(parsed.owner, parsed.name, token)
const nextRepo = buildRepoRecord(metadata, issue, now)
const nextRepos = [...repos, nextRepo]

validateAppendOnly(repos, nextRepos, nextRepo)

console.log(`UND-RDR accepted submission`)
console.log(`- issue: ${issue.html_url}`)
console.log(`- repo: ${nextRepo.full_name}`)
console.log(`- stars: ${nextRepo.stars}`)
console.log(`- language: ${nextRepo.language || 'Unknown'}`)
console.log(`- status: ${nextRepo.status}`)
console.log(`- mode: ${options.dryRun ? 'dry-run' : 'apply'}`)

if (options.dryRun) {
  const outDir = path.resolve(options.outDir || 'data/submission-dry-runs')
  fs.mkdirSync(outDir, { recursive: true })
  const stamp = now.replace(/[:.]/g, '-')
  const outPath = path.join(outDir, `all_repos-with-${nextRepo.id.replaceAll('/', '-')}-${stamp}.json`)
  fs.writeFileSync(outPath, `${JSON.stringify(nextRepos, null, 2)}\n`)
  console.log(`- dry-run dataset: ${outPath}`)
  console.log(`- live dataset was not changed`)
  process.exit(0)
}

const stamp = now.replace(/[:.]/g, '-')
const backupPath = path.resolve('backups', `pre-submission-add-${nextRepo.id.replaceAll('/', '-')}-${stamp}.json`)
fs.mkdirSync(path.dirname(backupPath), { recursive: true })
fs.copyFileSync(dataPath, backupPath)
fs.writeFileSync(dataPath, `${JSON.stringify(nextRepos, null, 2)}\n`)

runValidation()

await commentOnIssue(options.repo, options.issue, token, [
  `Added ${nextRepo.full_name} to UND-RDR.`,
  '',
  `- Stars: ${nextRepo.stars}`,
  `- Language: ${nextRepo.language || 'Unknown'}`,
  `- Status: ${nextRepo.status}`,
  `- Dataset count: ${beforeCount} -> ${nextRepos.length}`,
  '',
  `Backup created locally: \`${path.relative(process.cwd(), backupPath)}\``,
].join('\n'))

await addLabels(options.repo, options.issue, token, [options.addedLabel, options.acceptedLabel].filter(Boolean))

console.log(`- dataset updated: ${dataPath}`)
console.log(`- backup: ${backupPath}`)
console.log(`- validation: passed`)

function parseArgs(args) {
  const parsed = {
    repo: DEFAULT_REPO,
    data: DEFAULT_DATA_PATH,
    dryRun: false,
    issue: null,
    repoUrl: '',
    outDir: 'data/submission-dry-runs',
    acceptedLabel: DEFAULT_ACCEPTED_LABEL,
    addedLabel: DEFAULT_ADDED_LABEL,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--issue') parsed.issue = Number(args[++index])
    else if (arg === '--repo') parsed.repo = args[++index]
    else if (arg === '--repo-url') parsed.repoUrl = args[++index]
    else if (arg === '--data') parsed.data = args[++index]
    else if (arg === '--dry-run') parsed.dryRun = true
    else if (arg === '--out-dir') parsed.outDir = args[++index]
    else if (arg === '--accepted-label') parsed.acceptedLabel = args[++index]
    else if (arg === '--added-label') parsed.addedLabel = args[++index]
    else if (arg === '--help') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (!Number.isInteger(parsed.issue) || parsed.issue <= 0) {
    throw new Error('--issue must be a positive issue number')
  }

  return parsed
}

function printHelp() {
  console.log(`Usage: npm run submissions:add -- --issue <number> [options]

Options:
  --issue <number>       GitHub issue number to add.
  --dry-run              Write a preview JSON file without changing live data.
  --repo <owner/repo>    Review queue repository. Default: ${DEFAULT_REPO}
  --repo-url <url>       Override repo URL instead of reading it from issue body.
  --data <path>          Dataset path. Default: ${DEFAULT_DATA_PATH}
  --out-dir <path>       Dry-run output directory. Default: data/submission-dry-runs

Environment:
  GITHUB_TOKEN or GH_TOKEN is used for GitHub API access. If absent, the script
  tries to read the active gh CLI token.
`)
}

function readGhToken() {
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

function readJsonArray(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!Array.isArray(value)) throw new Error(`${filePath} must contain a JSON array`)
  return value
}

function repoId(repo) {
  const parsed = parseGitHubRepo(repo.url || repo.repoUrl || repo.full_name)
  return (repo.id || repo.full_name || (parsed ? `${parsed.owner}/${parsed.name}` : repo.url || repo.name || '')).toLowerCase()
}

function parseGitHubRepo(value = '') {
  const asString = String(value).trim()
  const urlMatch = asString.match(/github\.com\/([^/\s]+)\/([^/#?\s]+)(?:[/?#]|$)/i)
  if (urlMatch) return { owner: cleanPart(urlMatch[1]), name: cleanPart(urlMatch[2]) }

  const fullNameMatch = asString.match(/^([^/\s]+)\/([^/\s]+)$/)
  if (fullNameMatch) return { owner: cleanPart(fullNameMatch[1]), name: cleanPart(fullNameMatch[2]) }

  return null
}

function cleanPart(value) {
  return value.replace(/\.git$/i, '')
}

function extractRepoUrl(issue) {
  const body = issue.body || ''
  const repoLine = body.split('\n').find((line) => /repo:/i.test(line))
  const fromLine = repoLine?.match(/https:\/\/github\.com\/[^\s)]+/i)?.[0]
  const fromBody = body.match(/https:\/\/github\.com\/[^\s)]+/i)?.[0]
  return fromLine || fromBody || ''
}

async function fetchIssue(targetRepo, issueNumber, authToken) {
  const response = await fetch(`https://api.github.com/repos/${repoPath(targetRepo)}/issues/${issueNumber}`, {
    headers: githubHeaders(authToken),
  })

  if (!response.ok) throw new Error(`github-issue-${response.status}`)
  return response.json()
}

async function fetchGitHubRepo(owner, name, authToken) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
    headers: githubHeaders(authToken),
  })

  if (response.status === 404) throw new Error('submitted repo is not reachable')
  if (!response.ok) throw new Error(`github-repo-${response.status}`)
  return response.json()
}

function githubHeaders(authToken) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${authToken}`,
    'user-agent': 'undrdr-submission-review',
    'x-github-api-version': '2022-11-28',
  }
}

function repoPath(targetRepo) {
  const [owner, repo] = targetRepo.trim().split('/')
  if (!owner || !repo) throw new Error(`Invalid GitHub repo: ${targetRepo}`)
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
}

function buildRepoRecord(metadata, issue, checkedAt) {
  const stars = Number(metadata.stargazers_count || 0)
  const fullName = metadata.full_name
  const id = fullName.toLowerCase()
  const topics = Array.isArray(metadata.topics) ? metadata.topics : []
  const reason = extractReason(issue.body || '')

  return {
    name: metadata.name,
    full_name: fullName,
    description: metadata.description || '',
    stars,
    forks: metadata.forks_count || 0,
    language: metadata.language || null,
    topics,
    url: metadata.html_url,
    owner: metadata.owner?.login || fullName.split('/')[0],
    open_issues: metadata.open_issues_count || 0,
    license: metadata.license?.spdx_id || null,
    updated_at: metadata.updated_at || null,
    created_at: metadata.created_at || null,
    watchers: metadata.watchers_count ?? stars,
    pushed_at: metadata.pushed_at || null,
    is_gem: false,
    category: inferCategory(metadata, topics),
    wave: 'submitted',
    title: metadata.name,
    tags: topics.slice(0, 12),
    id,
    githubFullName: fullName,
    repoUrl: metadata.html_url,
    previousStars: stars,
    firstSeenAt: checkedAt,
    lastCheckedAt: checkedAt,
    lastGitHubUpdatedAt: metadata.pushed_at || metadata.updated_at || checkedAt,
    crossedOneKAt: stars >= 1000 ? checkedAt : null,
    dailyStarDelta: 0,
    weeklyStarDelta: 0,
    status: inferStatus({
      stars,
      archived: Boolean(metadata.archived || metadata.disabled),
      pushed_at: metadata.pushed_at,
      updated_at: metadata.updated_at,
    }),
    unavailable: false,
    unavailableReason: null,
    submittedFromIssue: issue.html_url,
    submittedReason: reason,
  }
}

function extractReason(body) {
  const line = body.split('\n').find((item) => /^-\s*Reason:/i.test(item.trim()))
  return line ? line.replace(/^-\s*Reason:\s*/i, '').trim() : ''
}

function inferCategory(metadata, topics) {
  const text = [metadata.description, metadata.language, ...topics].join(' ').toLowerCase()
  if (text.includes('mcp')) return 'MCP Server'
  if (text.includes('agent')) return 'Agent Builder'
  if (text.includes('macos') || text.includes('swift')) return 'Mac Tool'
  if (text.includes('llm') || text.includes('ai')) return 'AI Tool'
  if (text.includes('cli')) return 'CLI Tool'
  return 'Submitted'
}

function inferStatus(repo) {
  if (repo.archived || repo.disabled) return 'Archived/Inactive'
  if (daysSince(repo.pushed_at || repo.updated_at) > 365) return 'Archived/Inactive'
  if (Number(repo.stars || 0) >= 1000) return 'Crossed 1K'
  if (Number(repo.stars || 0) >= 900) return 'Near 1K'
  if (Number(repo.dailyStarDelta || 0) >= 3 || Number(repo.weeklyStarDelta || 0) >= 12) return 'Rising'
  return 'Underrated'
}

function daysSince(value) {
  if (!value) return 99999
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 99999
  return Math.max(0, Math.floor((Date.now() - time) / 86400000))
}

function validateAppendOnly(before, after, addedRepo) {
  if (after.length !== before.length + 1) {
    throw new Error(`Refusing to write: expected ${before.length + 1} repos, found ${after.length}`)
  }

  const beforeIds = new Set(before.map(repoId))
  const afterIds = after.map(repoId)
  const duplicates = afterIds.filter((id, index) => afterIds.indexOf(id) !== index)
  if (duplicates.length) throw new Error(`Refusing to write duplicate repo ids: ${duplicates.slice(0, 10).join(', ')}`)

  for (const id of beforeIds) {
    if (!afterIds.includes(id)) throw new Error(`Refusing to write: missing existing repo ${id}`)
  }

  if (!afterIds.includes(repoId(addedRepo))) {
    throw new Error(`Refusing to write: added repo ${repoId(addedRepo)} missing from output`)
  }
}

function runValidation() {
  execFileSync('npm', ['run', 'validate:data'], { stdio: 'inherit' })
}

async function commentOnIssue(targetRepo, issueNumber, authToken, body) {
  const response = await fetch(`https://api.github.com/repos/${repoPath(targetRepo)}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: { ...githubHeaders(authToken), 'content-type': 'application/json' },
    body: JSON.stringify({ body }),
  })

  if (!response.ok) throw new Error(`github-comment-${response.status}`)
}

async function addLabels(targetRepo, issueNumber, authToken, labels) {
  if (!labels.length) return

  const response = await fetch(`https://api.github.com/repos/${repoPath(targetRepo)}/issues/${issueNumber}/labels`, {
    method: 'POST',
    headers: { ...githubHeaders(authToken), 'content-type': 'application/json' },
    body: JSON.stringify({ labels }),
  })

  if (!response.ok) throw new Error(`github-label-${response.status}`)
}
