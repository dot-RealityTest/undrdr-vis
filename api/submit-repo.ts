/// <reference types="node" />

import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'

type SubmissionPayload = {
  repoUrl?: unknown
  reason?: unknown
  contact?: unknown
  website?: unknown
}

type RepoRecord = {
  name?: string
  full_name?: string
  url?: string
  owner?: string
}

type IntakeSubmission = {
  id: string
  repoUrl: string
  owner: string
  name: string
  fullName: string
  reason: string
  contact: string
  submittedAt: string
  source: string
  status: 'received'
}

type Delivery = 'github-issue' | 'webhook' | 'email' | 'validated-only'

const MAX_BODY_BYTES = 16_384
const MAX_REASON_LENGTH = 900
const MAX_CONTACT_LENGTH = 160
const DEFAULT_GITHUB_LABELS = ['undrdr-submission', 'needs-review']

function sendJson(response: ServerResponse, statusCode: number, data: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify(data))
}

function normalizeGithubRepoUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (host !== 'github.com' || parts.length < 2) return null

    const owner = parts[0]
    const name = parts[1].replace(/\.git$/i, '')
    const validSegment = /^[A-Za-z0-9_.-]+$/
    if (!validSegment.test(owner) || !validSegment.test(name)) return null

    return {
      owner,
      name,
      fullName: `${owner}/${name}`,
      key: `${owner}/${name}`.toLowerCase(),
      repoUrl: `https://github.com/${owner}/${name}`,
    }
  } catch {
    return null
  }
}

function normalizeExistingRepoKey(repo: RepoRecord) {
  const fromFullName = typeof repo.full_name === 'string' ? repo.full_name : ''
  const fromUrl = normalizeGithubRepoUrl(repo.url)?.fullName || ''
  const fromOwnerName = repo.owner && repo.name ? `${repo.owner}/${repo.name}` : ''
  return (fromFullName || fromUrl || fromOwnerName).toLowerCase()
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('body-too-large')
    chunks.push(buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

async function loadExistingRepoKeys() {
  const dataPath = join(process.cwd(), 'public', 'data', 'all_repos.json')
  const raw = await readFile(dataPath, 'utf8')
  const repos = JSON.parse(raw) as RepoRecord[]
  return new Set(repos.map(normalizeExistingRepoKey).filter(Boolean))
}

async function forwardToWebhook(submission: IntakeSubmission) {
  const webhookUrl = process.env.SUBMISSIONS_WEBHOOK_URL
  if (!webhookUrl) return false

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'undrdr.repo_submission', submission }),
  })

  if (!response.ok) throw new Error(`webhook-${response.status}`)
  return true
}

function getGitHubIssueConfig() {
  const token = process.env.SUBMISSIONS_GITHUB_TOKEN
  const targetRepo = process.env.SUBMISSIONS_GITHUB_REPO
  const labels = (process.env.SUBMISSIONS_GITHUB_LABELS || '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)

  if (!token || !targetRepo) return null
  return { token, targetRepo, labels: labels.length ? labels : DEFAULT_GITHUB_LABELS }
}

function gitHubHeaders(token: string) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'undrdr-submit-intake',
    'x-github-api-version': '2022-11-28',
  }
}

function gitHubRepoPath(targetRepo: string) {
  const [owner, repo] = targetRepo.split('/')
  if (!owner || !repo) throw new Error('github-repo-invalid')
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
}

async function findOpenSubmissionIssue(fullName: string) {
  const config = getGitHubIssueConfig()
  if (!config) return null

  const issuesUrl = new URL(`https://api.github.com/repos/${gitHubRepoPath(config.targetRepo)}/issues`)
  const primaryLabel = config.labels[0]
  issuesUrl.searchParams.set('state', 'open')
  issuesUrl.searchParams.set('per_page', '100')
  if (primaryLabel) issuesUrl.searchParams.set('labels', primaryLabel)

  const response = await fetch(issuesUrl, {
    headers: gitHubHeaders(config.token),
  })

  if (!response.ok) throw new Error(`github-issues-${response.status}`)

  const result = await response.json() as Array<{ html_url?: string; title?: string }>
  const issue = result.find((item) => item.title === `UND-RDR submission: ${fullName}`)
  return issue?.html_url || null
}

async function forwardToGitHubIssue(submission: IntakeSubmission) {
  const config = getGitHubIssueConfig()
  if (!config) return null

  const body = [
    'New UND-RDR repository submission.',
    '',
    `- Repo: ${submission.repoUrl}`,
    `- Reason: ${submission.reason || 'No reason provided'}`,
    `- Contact: ${submission.contact || 'Not provided'}`,
    `- Submitted: ${submission.submittedAt}`,
    `- Intake ID: ${submission.id}`,
    '',
    'The live dataset was not changed by this submission.',
  ].join('\n')

  const response = await fetch(`https://api.github.com/repos/${gitHubRepoPath(config.targetRepo)}/issues`, {
    method: 'POST',
    headers: gitHubHeaders(config.token),
    body: JSON.stringify({
      title: `UND-RDR submission: ${submission.fullName}`,
      body,
      labels: config.labels,
    }),
  })

  if (!response.ok) throw new Error(`github-issue-${response.status}`)

  const issue = await response.json() as { html_url?: string }
  return issue.html_url || null
}

async function forwardToResend(submission: IntakeSubmission) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.SUBMISSIONS_TO_EMAIL
  const from = process.env.SUBMISSIONS_FROM_EMAIL || 'UND-RDR <submissions@undrdr.com>'
  if (!apiKey || !to) return false

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: `UND-RDR submission: ${submission.fullName}`,
      text: [
        `Repo: ${submission.repoUrl}`,
        `Reason: ${submission.reason || 'No reason provided'}`,
        `Contact: ${submission.contact || 'Not provided'}`,
        `Submitted: ${submission.submittedAt}`,
        `ID: ${submission.id}`,
      ].join('\n'),
    }),
  })

  if (!response.ok) throw new Error(`resend-${response.status}`)
  return true
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    sendJson(response, 405, { ok: false, error: 'method_not_allowed', message: 'Use POST to submit a repository.' })
    return
  }

  try {
    const body = await readRequestBody(request)
    const payload = JSON.parse(body || '{}') as SubmissionPayload

    if (payload.website) {
      sendJson(response, 200, { ok: true, status: 'ignored' })
      return
    }

    const normalized = normalizeGithubRepoUrl(payload.repoUrl)
    if (!normalized) {
      sendJson(response, 400, {
        ok: false,
        error: 'invalid_repo_url',
        message: 'Paste a full GitHub repo URL, like https://github.com/owner/repo.',
      })
      return
    }

    const existingRepoKeys = await loadExistingRepoKeys()
    if (existingRepoKeys.has(normalized.key)) {
      sendJson(response, 409, {
        ok: false,
        error: 'duplicate_repo',
        message: `${normalized.fullName} is already in UND-RDR.`,
        repoUrl: normalized.repoUrl,
      })
      return
    }

    const pendingIssueUrl = await findOpenSubmissionIssue(normalized.fullName)
    if (pendingIssueUrl) {
      sendJson(response, 409, {
        ok: false,
        error: 'pending_submission',
        message: `${normalized.fullName} is already waiting for review.`,
        repoUrl: normalized.repoUrl,
        reviewUrl: pendingIssueUrl,
      })
      return
    }

    const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, MAX_REASON_LENGTH) : ''
    const contact = typeof payload.contact === 'string' ? payload.contact.trim().slice(0, MAX_CONTACT_LENGTH) : ''
    const submittedAt = new Date().toISOString()
    const id = createHash('sha256')
      .update(`${normalized.key}:${submittedAt}:${randomUUID()}`)
      .digest('hex')
      .slice(0, 16)

    const submission: IntakeSubmission = {
      id,
      repoUrl: normalized.repoUrl,
      owner: normalized.owner,
      name: normalized.name,
      fullName: normalized.fullName,
      reason,
      contact,
      submittedAt,
      source: 'undrdr.com',
      status: 'received',
    }

    let delivery: Delivery = 'validated-only'
    let reviewUrl: string | null = null
    const issueUrl = await forwardToGitHubIssue(submission)
    if (issueUrl) {
      delivery = 'github-issue'
      reviewUrl = issueUrl
    } else if (await forwardToWebhook(submission)) {
      delivery = 'webhook'
    } else if (await forwardToResend(submission)) {
      delivery = 'email'
    }

    console.info('UND-RDR repo submission received', {
      id: submission.id,
      repo: submission.fullName,
      delivery,
    })

    sendJson(response, 202, {
      ok: true,
      submission,
      delivery,
      reviewUrl,
      message: delivery === 'github-issue'
        ? 'Repository received for review. A review issue was created. The live dataset was not changed.'
        : 'Repository received for review. The live dataset was not changed.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    if (message === 'body-too-large') {
      sendJson(response, 413, { ok: false, error: 'body_too_large', message: 'Submission is too large.' })
      return
    }

    if (message.includes('JSON')) {
      sendJson(response, 400, { ok: false, error: 'invalid_json', message: 'Submission could not be read.' })
      return
    }

    console.error('UND-RDR submission failed', error)
    sendJson(response, 500, {
      ok: false,
      error: 'submission_failed',
      message: 'Submission could not be received. Try again later.',
    })
  }
}
