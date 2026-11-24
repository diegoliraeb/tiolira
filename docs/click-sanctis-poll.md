# Click Sanctis part 2 poll

Public page: /pt/enquete-click-sanctis; results: same URL + #resultados.
API: GET/POST /api/polls/click-sanctis. POST requires matching Origin and a signed HttpOnly anonymous browser cookie, 1–5 unique approved candidate IDs, 2 KB maximum JSON. Existing persistent per-IP and per-voter rate limits apply. No catalog, subscriptions, or payment changes.

Storage: polls/click-sanctis-parte-2.json through existing store.mjs (Postgres or private Blob). A single compare-and-swap update stores each ballot atomically. Repeated submissions preserve the original ballot. Responses expose aggregate results and the requesting browser's selections only, never voter identifiers. No name, email or phone requested. Cookie is SameSite=Lax, Secure on Vercel, one-year lifetime. Anonymous browser deduplication is not verified identity: a person clearing cookies or switching devices can vote again. It is a low-friction community poll, not a secure election.

Candidates are randomized on page load; search ignores accents. Results refresh every 30 seconds while visible. Equal vote totals share a rank and use alphabetical display order; ties at the top-ten cutoff are flagged. Results remain provisional. No deadline was supplied; poll remains open. An organizer decision is required for a cutoff tie when closing the poll; the page does not falsely choose a tie winner.

Validation 2026-11-22:
- 5 focused tests pass (candidate validation, idempotency/privacy, ties, signatures, concurrent persistence).
- Local HTTP checks pass for Origin rejection, invalid selections, persistence, and retry idempotency.
- Mobile 390px browser check: five choices, sixth disabled, confirmation/results, reload retains ballot, accent-insensitive search.
- Production webpack build passes. Local node_modules is an external symlink; webpack avoids Turbopack's symlink root restriction. Vercel installs normal dependencies.
- Full suite: 370 pass, 4 fail (including one parent suite). Same 4 fail on untouched baseline 32eeb35: expired cart recovery fixture, print estimate fixture, sitemap expected count. Unrelated baseline failures were not modified.
- All test ballots are in /private/tmp/sanctis-preview-data, not production.

## Closure — 2026-11-24
The organizer requested closure. POLL_CLOSED disables all POST voting with 409 before identity or storage access. GET preserves the full aggregate count and exposes closed/closedOn; closed results need no voter cookie. The public page opens directly to final results, with the ten selected entries highlighted and no voting controls. Existing ballots remain unchanged. Sharing and page metadata now describe final results.
