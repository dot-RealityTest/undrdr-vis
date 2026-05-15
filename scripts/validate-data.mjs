import fs from 'node:fs'
import path from 'node:path'

const dataPath = path.resolve('public/data/all_repos.json')
const raw = fs.readFileSync(dataPath, 'utf8')
const repos = JSON.parse(raw)

if (!Array.isArray(repos)) {
  throw new Error('public/data/all_repos.json must be an array')
}

const requiredFields = ['name', 'full_name', 'url', 'stars']
const missing = []
const seen = new Map()

for (const [index, repo] of repos.entries()) {
  for (const field of requiredFields) {
    if (repo[field] === undefined || repo[field] === null || repo[field] === '') {
      missing.push(`${index}:${field}`)
    }
  }

  const id = String(repo.full_name || repo.url || '').toLowerCase()
  if (id) seen.set(id, (seen.get(id) || 0) + 1)
}

const duplicates = Array.from(seen.entries()).filter(([, count]) => count > 1)
const underOneK = repos.filter((repo) => Number(repo.stars) < 1000).length
const crossedOneK = repos.filter((repo) => Number(repo.stars) >= 1000).length

console.log(`UND-RDR data validation`)
console.log(`- file: ${dataPath}`)
console.log(`- repos: ${repos.length}`)
console.log(`- under 1K: ${underOneK}`)
console.log(`- crossed 1K: ${crossedOneK}`)
console.log(`- duplicate ids: ${duplicates.length}`)

if (missing.length) {
  throw new Error(`Missing required fields: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '...' : ''}`)
}

if (repos.length < 683) {
  throw new Error(`Expected at least 683 repos; found ${repos.length}`)
}

if (duplicates.length) {
  console.warn(`Duplicate repo ids detected: ${duplicates.slice(0, 10).map(([id]) => id).join(', ')}`)
}
