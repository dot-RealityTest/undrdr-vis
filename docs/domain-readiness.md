# UND-RDR Domain Status

UND-RDR is live at `https://undrdr.com/`.

The previous akaKika location, `https://akakika.com/undrdr/`, is still reachable and should stay available while search results, bookmarks, and social previews settle.

## Current Defaults

The committed `.env` keeps production metadata pointed at the dedicated domain:

```env
VITE_SITE_URL=https://undrdr.com/
VITE_SITE_ORIGIN=https://undrdr.com
VITE_SITE_IMAGE_URL=https://undrdr.com/assets/undrdr-social-card.png
VITE_TARGET_DOMAIN=undrdr.com
VITE_SITE_EMAIL=submit@undrdr.com
```

The same values are stored in `.env.undrdr.example`, along with optional secrets for the submission issue queue.

## Live Checks

Verify these after any production deployment:

```sh
curl -I https://undrdr.com/
curl -I https://www.undrdr.com/
curl -I https://akakika.com/undrdr/
npm run validate:data
```

## What These Control

- `index.html` canonical URL, Open Graph URL, Twitter image, JSON-LD URL, and author origin.
- In-app Data / Method copy for the live domain.
- Submission copy and contact labels.
- Social card URLs used by link previews.

## Legacy Link Policy

Keep `https://akakika.com/undrdr/` available for now. The preferred next move is a gentle redirect to `https://undrdr.com/` after:

- `undrdr.com` and `www.undrdr.com` have stayed stable through several deploys,
- the GitHub issue submission queue has handled real submissions,
- social previews consistently use `https://undrdr.com/assets/undrdr-social-card.png`,
- no external embeds or posts still rely on the old akaKika page as the canonical URL.

Do not remove the akaKika route without either a redirect or a short archive page pointing people to `undrdr.com`.
