# UND-RDR

UND-RDR is a living discovery site for underrated GitHub repositories before they become famous.

Live site: [https://undrdr.com](https://undrdr.com)

It tracks a protected dataset of 683 open source repositories, most discovered while they were under 1,000 stars. The site turns that dataset into a fast, curated browsing system for finding fresh, rising, almost-famous, and graduated projects.

## What It Does

- Browse underrated GitHub projects without digging through a random list.
- Search by repo, owner, description, language, topic, and status.
- Filter by language, topic, and discovery status.
- Sort by curated signal, stars, newest, rising, recently updated, and closest to 1K.
- Track sections for New, Rising, Near 1K, Crossed 1K, Topics, Watchlist, Submit, Data, and About.
- Open repo cards directly on GitHub.
- Submit new repos into a protected GitHub issue review queue.
- Run daily GitHub checks that open review PRs instead of silently changing production data.

## Discovery Statuses

| Status | Meaning |
| --- | --- |
| Underrated | Still under 1,000 stars |
| Rising | Growing quickly or showing strong momentum |
| Near 1K | Close to crossing the 1,000-star threshold |
| Crossed 1K | Graduated from underrated |
| Archived/Inactive | Unavailable, archived, disabled, or stale |

## Data Protection

The core dataset lives at:

```text
public/data/all_repos.json
```

The redesign protects this file as the source of truth:

- raw repo data is not rewritten by the public UI,
- submissions do not directly mutate the dataset,
- accepted submissions go through a reviewer command,
- daily GitHub refreshes open PRs for review,
- validation checks repo count, required fields, and duplicate ids.

Current validation snapshot:

```text
repos: 683
under 1K: 660
crossed 1K: 23
duplicate ids: 0
```

## Submission Workflow

Public submissions go through the live endpoint:

```text
/api/submit-repo
```

The endpoint:

- accepts full GitHub repo URLs,
- blocks invalid URLs,
- blocks repos already in the dataset,
- blocks repos already waiting in an open review issue,
- creates a GitHub issue labeled `undrdr-submission` and `needs-review`,
- never changes the live dataset directly.

Public contact is `submit@undrdr.com`. DNS and mailbox readiness are tracked in:

```text
docs/email-intake.md
```

Reviewer guide:

```text
SUBMISSIONS.md
```

Preview an accepted issue:

```sh
npm run submissions:add -- --issue 12 --dry-run
```

Apply an accepted issue:

```sh
npm run submissions:add -- --issue 12
```

The script fetches GitHub metadata, refuses duplicates, writes a backup, appends one normalized repo record, validates data, comments on the issue, and labels it `accepted` plus `added-to-index`.

## Daily Automation

The GitHub Actions workflow at:

```text
.github/workflows/github-repo-check.yml
```

runs daily and can also be triggered manually. It checks all repos, updates stars/status signals, validates the dataset, and opens an update PR from:

```text
automation/github-repo-snapshot
```

It does not push dataset changes directly to `main`.

## Local Development

Install dependencies:

```sh
npm install
```

Run the app:

```sh
npm run dev
```

Build:

```sh
npm run build
```

Validate the dataset:

```sh
npm run validate:data
```

Run a sample GitHub metadata check:

```sh
npm run check:github:sample
```

Run the full GitHub metadata check locally as a dry run:

```sh
npm run check:github
```

Apply a full local GitHub metadata refresh:

```sh
npm run check:github:apply
```

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Main discovery UI and client-side interactions |
| `src/App.css` | Visual system, responsive layout, cards, mobile polish |
| `api/submit-repo.ts` | Protected repo submission intake |
| `public/data/all_repos.json` | Protected source dataset |
| `public/data/update-report.json` | Latest GitHub check report |
| `scripts/check-github-repos.mjs` | Daily metadata refresh logic |
| `scripts/add-submission-to-dataset.mjs` | Accepted submission workflow |
| `scripts/validate-data.mjs` | Dataset validation |
| `docs/data-schema.md` | Recommended data schema |
| `docs/domain-readiness.md` | Domain migration notes |
| `docs/launch-checklist.md` | Launch and move checklist |

## Domain

UND-RDR is live at:

```text
https://undrdr.com
```

The project previously lived under `akaKika.com/undrdr`. Keep legacy redirects alive while search, social previews, and external links settle.

## Tech Stack

- React
- TypeScript
- Vite
- Pixi.js
- Vercel
- GitHub Actions

## Product Direction

UND-RDR should feel like a curated discovery system: clean, fast, editorial, data-first, and useful. It should help people move from one interesting GitHub project to the next without overwhelming them.
