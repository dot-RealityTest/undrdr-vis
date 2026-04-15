# UNDRDR — Under the Radar GitHub Discovery

GitHub repos that deserve more eyes. A bioluminescent graph of under-the-radar discovery — repos under 1,000 stars that are gaining momentum.

![UNDRDR Screenshot](https://www.akakika.com/undrdr/)

## What is this?

A curated, hand-picked collection of GitHub repositories that are under 1,000 stars but worth watching. Each repo is rated by "temperature" and displayed as an interactive force-directed graph clustered by programming language.

### Temperature Ratings

| Rating | Meaning |
|--------|---------|
| **BOSS** | Exceptional — something special |
| **HOT** | Gaining momentum, active community |
| **WARM** | Solid, niche audience |
| **COLD** | New or unproven, no signal yet |

## How it works

- **Force-directed graph** — repos cluster by language, size reflects temperature
- **Interactive** — hover for details, click to visit GitHub, drag nodes
- **Filter by temperature** — click legend items to highlight
- **Search** — type to filter by name, description, or language

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Canvas-based physics simulation (no D3)
- Zero dependencies beyond React

## Development

```bash
npm install
npm run dev
```

## Deployment

Built with Vite, deployed as static files. The main site at [akakika.com/undrdr](https://www.akakika.com/undrdr) serves the production build.

```bash
npm run build
# Output in dist/
```

## Data

Repos are curated manually. The demo data in `src/App.tsx` contains the current collection. To add repos, edit the `DEMO_REPOS` array.

Each repo entry:
```typescript
{
  url: 'https://github.com/owner/repo',
  name: 'repo-name',
  description: 'What it does',
  stars: 42,
  lang: 'Swift',
  temperature: 'hot',  // boss | hot | warm | cold
}
```

## License

MIT

---

Built by [aka kika](https://www.akakika.com) — finding tools 2 years before they go mainstream.
