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

Vercel project:

- Project: `dot-realitytests-projects/undrdr`
- Default Vercel URL: `https://undrdr.vercel.app/`
- Inspect URL: `https://vercel.com/dot-realitytests-projects/undrdr`

The project has been created and linked locally. If this checkout is cloned elsewhere, link it again from this folder:

```bash
vercel link --yes --project undrdr
```

Do not link this folder to the existing akaKika project.

## Production Environment

Set these Vercel environment values for the `undrdr.com` project:

```env
VITE_SITE_URL=https://undrdr.com/
VITE_SITE_ORIGIN=https://undrdr.com
VITE_SITE_IMAGE_URL=https://undrdr.com/assets/undrdr-discovery-icon-bright.png
VITE_TARGET_DOMAIN=undrdr.com
VITE_SITE_EMAIL=submit@undrdr.com
```

Production environment variables are saved on the Vercel project.
Preview deployments from this local machine can pass the same values with `--build-env`.
Branch-specific Preview env vars can be added after the working branch exists on GitHub.

Do not switch DNS until the preview deployment works.

## Verify Preview

On `https://undrdr.vercel.app/` or a Vercel preview URL, check:

- App loads without console errors.
- `public/data/all_repos.json` loads and shows 683 repos.
- Header bright icon loads.
- Card click opens the GitHub repo in a new tab.
- Favorites still require mock login.
- Submit remains a mock queue.
- Data / Method section mentions the configured target correctly.

Current verified preview:

- `https://undrdr.vercel.app/#favorites`
- Canonical: `https://undrdr.com/`
- Repo count shown: `683 repositories`
- Data endpoint: `/data/all_repos.json` returns `200`
- Browser console errors: none

## Connect Domain

Domain attachment status:

- `undrdr.com` is added to the `undrdr` Vercel project.
- `www.undrdr.com` is added to the `undrdr` Vercel project.
- Both aliases point to the current deployment in Vercel.
- DNS is still managed at GoDaddy nameservers: `ns19.domaincontrol.com`, `ns20.domaincontrol.com`.
- `https://undrdr.com/` is live and serving UND-RDR from Vercel.
- `https://www.undrdr.com/` is live and serving UND-RDR from Vercel.

Set these DNS records at GoDaddy:

```text
Type  Name  Value
A     @     76.76.21.21
A     www   76.76.21.21
```

Remove or replace the current parked apex A records:

```text
A     @     3.33.130.190
A     @     15.197.148.33
```

Remove or replace the current `www` CNAME if GoDaddy will not allow an `A www` record while it exists:

```text
CNAME www   undrdr.com
```

Alternative Vercel DNS option:

```text
Nameserver  ns1.vercel-dns.com
Nameserver  ns2.vercel-dns.com
```

Verified live domain:

- `https://undrdr.com/#favorites`
- `https://www.undrdr.com/`
- Canonical: `https://undrdr.com/`
- Open Graph image: `https://undrdr.com/assets/undrdr-discovery-icon-bright.png`
- Repo count shown: `683 repositories`
- Data endpoint: `/data/all_repos.json` returns `200`
- Browser console errors: none

After launch:

- Keep `akakika.com/undrdr/` available as the old location.
- Verify canonical, Open Graph URL, Twitter image, and JSON-LD point to `https://undrdr.com/`.

## Post-Launch

- Create the real site email or alias.
- Replace mock submit with a real intake path.
- Add daily GitHub star-check automation.
- Decide whether `akakika.com/undrdr/` should redirect to `undrdr.com` or remain as a historical entry point.
