# UND-RDR Email Intake

Public contact address:

```text
submit@undrdr.com
```

Google mailbox:

```text
submit@undrdr.com
```

The site shows this address in Submit and About. The protected form remains the primary intake path because it validates GitHub URLs, blocks duplicates, and creates review issues without changing the live dataset.

## Current DNS Status

As of the latest check, `undrdr.com` has:

- MX: Google Workspace records present
- SPF: present
- DMARC: present

Run:

```sh
npm run verify:email
```

## Mailbox Provider

Current provider:

```text
Google Workspace / Gmail
```

Current MX records:

```text
1  aspmx.l.google.com
5  alt1.aspmx.l.google.com
5  alt2.aspmx.l.google.com
10 alt3.aspmx.l.google.com
10 alt4.aspmx.l.google.com
```

## Submission Notifications

The live endpoint already supports three review delivery paths:

```env
SUBMISSIONS_GITHUB_TOKEN=
SUBMISSIONS_GITHUB_REPO=dot-RealityTest/undrdr-vis
SUBMISSIONS_GITHUB_LABELS=undrdr-submission,needs-review
SUBMISSIONS_WEBHOOK_URL=
RESEND_API_KEY=
SUBMISSIONS_TO_EMAIL=submit@undrdr.com
SUBMISSIONS_FROM_EMAIL="UND-RDR <submissions@undrdr.com>"
```

Recommended current setup:

1. Keep GitHub issues as the source of truth for accepted submissions.
2. Keep `submit@undrdr.com` as the public mailbox.
3. Run `npm run verify:email` after DNS or provider changes.
4. Send one manual email and one form submission after any intake change.

Do not let email submissions mutate `public/data/all_repos.json` directly. Accepted repos still go through `npm run submissions:add -- --issue <number>`.
