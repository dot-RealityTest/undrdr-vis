# UND-RDR Data Schema

## Current Raw Dataset

The active dataset lives at:

- `public/data/all_repos.json`
- backup: `backups/all_repos-20260515-172853.json`

The root-level `all_repos.json` currently mirrors the same 683-repo dataset and was also backed up at `backups/root-all_repos-20260515-172853.json`.

Current raw fields observed:

```ts
type CurrentRepo = {
  name: string
  full_name: string
  description?: string
  stars: number
  forks?: number
  language?: string | null
  topics?: string[]
  tags?: string[]
  url: string
  owner?: string
  open_issues?: number
  license?: string | null
  updated_at?: string
  created_at?: string
  watchers?: number
  pushed_at?: string
  is_gem?: boolean
  category?: string
  wave?: string
  title?: string
}
```

The redesign does not change this raw format. UI-only derived fields are normalized in `src/App.tsx`.

## Recommended Automation Schema

Future daily checks should migrate toward this shape:

```ts
type UndrdrRepo = {
  id: string
  repoUrl: string
  owner: string
  name: string
  description: string
  stars: number
  previousStars: number
  language: string | null
  topics: string[]
  firstSeenAt: string
  lastCheckedAt: string
  lastGitHubUpdatedAt: string
  status: 'Underrated' | 'Rising' | 'Near 1K' | 'Crossed 1K' | 'Archived/Inactive'
  crossedOneKAt: string | null
  dailyStarDelta: number
  weeklyStarDelta: number
  source?: string
  reasonAdded?: string
}
```

## Validation

Run:

```bash
npm run validate:data
```

The validator confirms:

- the data file is an array
- required fields are present
- no repo count loss below the current 683 baseline
- duplicate repo ids are surfaced
- under-1K and crossed-1K counts are reported

## Daily GitHub Check

The first automation layer is available as a safe dry run:

```bash
npm run check:github:sample
```

For a full check:

```bash
GITHUB_TOKEN=... npm run check:github
```

By default this writes a timestamped snapshot and report under `data/github-checks/` and does not touch `public/data/all_repos.json`.

To apply the checked snapshot to the live dataset:

```bash
GITHUB_TOKEN=... npm run check:github -- --apply
```

The apply path first writes a pre-apply backup under `backups/`, then refuses to continue if repo count or repo identities are lost.
