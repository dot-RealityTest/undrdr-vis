# UND-RDR Submission Review

UND-RDR submissions arrive as GitHub issues labeled `undrdr-submission` and `needs-review`.

## Review Checklist

1. Open the submitted GitHub repo.
2. Confirm the repo is reachable and public.
3. Check whether it already exists in `public/data/all_repos.json`.
4. Check the current star count.
5. Prefer repos under 1,000 stars unless it is a useful graduated example.
6. Note the primary language, description, and useful topics.
7. Decide one outcome:
   - `accepted`: good fit for UND-RDR.
   - `needs-data`: promising, but missing signal or metadata.
   - `rejected`: duplicate, unavailable, spam, or not a fit.
   - `added-to-index`: already added to the dataset.

## Acceptance Notes

Good submissions are underrated, useful, specific, and discoverable. Favor projects with a clear purpose, recent activity, interesting technical angle, or strong niche usefulness.

Do not let submissions rewrite the dataset automatically. Accepted repos should go through a separate dataset update, validation, and deploy.

## Intake Protection

The live submit endpoint blocks:

- invalid GitHub URLs,
- repos already in the dataset,
- repos already waiting in an open `undrdr-submission` issue.

