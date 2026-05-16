# UND-RDR Email Intake

Public contact address:

```text
submit@undrdr.com
```

The site now shows this address in Submit and About. The protected form remains the primary intake path because it validates GitHub URLs, blocks duplicates, and creates review issues without changing the live dataset.

## Current DNS Status

As of the latest check, `undrdr.com` has:

- MX: missing
- SPF: missing
- DMARC: present

Run:

```sh
npm run verify:email
```

## Mailbox Options

Use one of these before relying on direct email replies:

- GoDaddy mailbox or forwarding for `submit@undrdr.com`
- Google Workspace mailbox
- Forwarding service such as ImprovMX
- Resend inbound or outbound-only notifications

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
2. Create or forward `submit@undrdr.com`.
3. Add MX and SPF records from the chosen mail provider.
4. Run `npm run verify:email`.
5. Send one manual email and one form submission.

Do not let email submissions mutate `public/data/all_repos.json` directly. Accepted repos still go through `npm run submissions:add -- --issue <number>`.
