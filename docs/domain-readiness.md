# UND-RDR Domain Readiness

UND-RDR is still safe to run under `https://akakika.com/undrdr/`.
The app is now prepared for the later move to `https://undrdr.com/` through Vite public environment values.

## Current Defaults

The committed `.env` keeps production metadata pointed at the current akaKika location:

```env
VITE_SITE_URL=https://akakika.com/undrdr/
VITE_SITE_ORIGIN=https://akakika.com
VITE_SITE_IMAGE_URL=https://akakika.com/undrdr/assets/undrdr-discovery-icon-bright.png
VITE_TARGET_DOMAIN=undrdr.com
VITE_SITE_EMAIL=
```

## Domain Cutover

When `undrdr.com` is connected, deploy with these values:

```env
VITE_SITE_URL=https://undrdr.com/
VITE_SITE_ORIGIN=https://undrdr.com
VITE_SITE_IMAGE_URL=https://undrdr.com/assets/undrdr-discovery-icon-bright.png
VITE_TARGET_DOMAIN=undrdr.com
VITE_SITE_EMAIL=submit@undrdr.com
```

The same values are stored in `.env.undrdr.example`.

## What These Control

- `index.html` canonical URL, Open Graph URL, Twitter image, JSON-LD URL, and author origin.
- In-app Data / Method copy that explains whether UND-RDR is still under akaKika or targeting `undrdr.com`.
- Mock submission copy, so the future site email appears without editing component text.

## Before Switching

- Keep `https://akakika.com/undrdr/` live until `https://undrdr.com/` loads the app, data, icons, and cards correctly.
- Confirm `public/data/all_repos.json` still validates with no repo loss or duplicate IDs.
- Confirm social previews read the bright icon URL from the new domain.
- Only replace mock submissions after a real queue or email intake exists.
