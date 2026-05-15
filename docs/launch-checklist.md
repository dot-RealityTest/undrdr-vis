# UND-RDR Launch Checklist

This checklist is for moving the current standalone UND-RDR app from akaKika staging to `undrdr.com`.

## Preflight

- Keep `https://akakika.com/undrdr/` live during the move.
- Do not mutate `public/data/all_repos.json` during launch work.
- Run:

```bash
npm run lint
npm run build
npm run validate:data
```

Expected data check:

- `683` repos
- `660` under 1K
- `23` crossed 1K
- `0` duplicate IDs

## Vercel Project

This folder now has a standalone Vercel config:

- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback: all routes rewrite to `index.html`
- Data JSON is served with no-store caching
- Versioned assets are served with immutable caching

Create or link a Vercel project from this folder only after local checks pass:

```bash
vercel link
```

Use a new project name like `undrdr` so it does not replace the existing akaKika project.

## Production Environment

Set these Vercel environment values for the `undrdr.com` project:

```env
VITE_SITE_URL=https://undrdr.com/
VITE_SITE_ORIGIN=https://undrdr.com
VITE_SITE_IMAGE_URL=https://undrdr.com/assets/undrdr-discovery-icon-bright.png
VITE_TARGET_DOMAIN=undrdr.com
VITE_SITE_EMAIL=submit@undrdr.com
```

Do not switch DNS until the preview deployment works.

## Verify Preview

On the Vercel preview URL, check:

- App loads without console errors.
- `public/data/all_repos.json` loads and shows 683 repos.
- Header bright icon loads.
- Card click opens the GitHub repo in a new tab.
- Favorites still require mock login.
- Submit remains a mock queue.
- Data / Method section mentions the configured target correctly.

## Connect Domain

Only after preview verification:

- Add `undrdr.com` to the new Vercel project.
- Configure DNS as Vercel instructs.
- Keep `akakika.com/undrdr/` available as the old location.
- Verify canonical, Open Graph URL, Twitter image, and JSON-LD point to `https://undrdr.com/`.

## Post-Launch

- Create the real site email or alias.
- Replace mock submit with a real intake path.
- Add daily GitHub star-check automation.
- Decide whether `akakika.com/undrdr/` should redirect to `undrdr.com` or remain as a historical entry point.
