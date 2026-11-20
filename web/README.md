# Automation Lab framework — build understanding first

Keep the original starter for comparison. This version extracts the setup repeated by those direct tests.

## Run

Use Python 3.10 or later. In this extracted folder run `python -m venv .venv`. Activate it with `.venv\Scripts\Activate.ps1` in Windows PowerShell or `source .venv/bin/activate` on macOS/Linux. Then:

```sh
python -m pip install -r requirements.txt
python -m playwright install chromium
python -m pytest -m api -v
python -m pytest -m ui -v
python -m pytest -m smoke -v
```

The app must be running locally on http://127.0.0.1:3000. Use `--base-url https://www.muzammilpatel.com` for the public catalogue. Pass an origin, not /lab. `--browser firefox` or `--browser webkit` selects another installed browser; `--headed` opens a window. LAB_CHROMIUM_EXECUTABLE optionally uses a system Chromium.

## Follow a test through the framework

1. pytest discovers `test_search` and sees its `store` argument.
2. The `store` fixture requests `page` and `base_url`.
3. A browser is shared for speed; each test gets a new context for isolation.
4. StorePage names meaningful actions and locators. Assertions stay visible in the test.
5. On failure, fixtures retain a screenshot and trace in artifacts/. Open a trace with `python -m playwright show-trace artifacts/FILE.zip`.
6. API tests use a fresh HTTPX client and parameterized cases. They inspect actual status codes and response bodies.

Use DevTools Network to compare browser requests with LabAPI calls. Deliberately change an assertion, examine the failure and restore it. Avoid sleeps and automatic retries that conceal defects.

## Add features deliberately

- Configuration belongs in CLI options/environment variables, never hardcoded credentials.
- Fixtures own lifecycle and cleanup; page objects own UI interactions; API clients own transport.
- Add a helper only when it makes tests easier to read.
- Keep artifacts private if you adapt this to a real application. These lab tests use fictional data only.

CI runs these against a local build, uploads JUnit results and retains failure traces/screenshots. No production credentials are needed for catalogue tests.

## Disposable commerce tests

Use `python -m pytest --commerce -m commerce -v` to opt in. Every test creates a new fictional run, logs in to a public demo role and deletes the run in teardown. These are not portfolio owner accounts. The workspace token owns the run; the role token controls operations inside it. Never use these demo credentials as a production authentication design.

## Data and failure scenarios

POST `/api/lab/workspaces` returns a 24-hour workspace token. Send it as X-Lab-Workspace, then sign in at POST `/api/lab/workspace/session`. The response returns a signed demo bearer token. Reset changes the run epoch and invalidates old sessions; sign-out revokes its session ID. Writes use optimistic revisions: concurrent changes return 409 instead of losing data.

X-Lab-Scenario accepts normal, slow (750 ms), unavailable (503), expired (401) and declined (checkout rejection). Scenarios apply to one request, never other runs. Do not add broad retries to hide them.

Checkout uses integer paise, server-side inventory checks and Idempotency-Key. SAVE10 removes floor(subtotal/10) paise. Orders keep price snapshots. Cancelling/refunding releases inventory once. The provider simulator accepts an admin token and the run's webhook key, deduplicates event IDs, and only settles pending orders. It makes no external payment calls.

## CI, accessibility and release practice

The repository's Automation Lab GitHub Actions workflow builds locally, runs tests, creates disposable memory-backed CI runs, and uploads JUnit/failure evidence. Local memory is explicitly a CI/development mode; Vercel uses Postgres and refuses that fallback. SQL policy tests separately execute the private capability gateway.

Run `python load_smoke.py` for ten sequential localhost-only requests. It refuses remote hosts and is not a benchmark. Browser checks also cover keyboard use, dialog close/focus, named controls, small viewports and dark mode. These checks do not claim a full WCAG audit.

Before release: run smoke/API/UI tests, inspect failed traces, review the diff, check the preview's catalogue and disposable purchase, merge only after checks pass, verify the correct Vercel commit is READY, and smoke-test the deployed endpoints. No test here deploys code or moves real money.

## Local Spend Analyzer

Open `/dashboard?tab=spend` after owner sign-in, or use `/dashboard?demo=1&tab=spend` with fictional data. Statement processing is entirely client-side: no statement-upload API, AI service, database writes, browser storage or server-side parsing. The existing dashboard still makes its normal authenticated overview requests, but the analyzer never includes statement contents in them. State stays in browser memory across dashboard tabs and is discarded on refresh, navigation, sign-out or Clear session.

Import CSV/TXT, XLSX or text-based PDF (20 MB/file, up to 150 PDF pages). Password-protected PDFs are unlocked on the device. The PDF.js worker is copied from the pinned dependency to the same-origin public directory by `npm ci`'s postinstall script; it never uses a CDN. Scanned PDFs/OCR are not supported. PDF layouts and category heuristics can be imperfect: column mapping, date order, amount sign convention, currency and preview must be checked before confirmation. Skipped rows are listed. Balance/summary rows are excluded. Duplicate suggestions are retained until explicitly excluded. Only the selected billed currency is totalled; there is no exchange-rate conversion.

All calculations use integer minor units. Total debits reconcile to spending plus charges plus transfers/card payments. Credits (including income and bill repayments) and charge reversals are separate; they are not blindly deducted from purchases. Posted tax/interest lines are identified from descriptions, with no assumed rate or APR. Transaction categories, charge types, amounts, dates and directions can be corrected locally.

Optional `.spendvault` downloads encrypt normalized transactions and filenames using AES-256-GCM with a random salt/IV and PBKDF2-SHA256 (250,000 iterations). Keep the backup and its passphrase; there is no recovery service or automatic cloud sync. Original statement bytes and PDF passwords are not in the backup. Plain CSV export is explicitly unencrypted and neutralizes spreadsheet formula prefixes. Avoid using real statements in demo screenshots or tests; committed fixtures are synthetic.

`npm test` covers amount/date parsing, reconciliation, ambiguous rows, PDF column alignment, currency separation and authenticated backup round-trips. `npm run test:browser -- spend.spec.ts dashboard.spec.ts` checks file imports with the real local PDF worker, password retries, XLSX, review, backup restore, memory clearing, mobile layout and absence of statement network writes.

Dashboard navigation separates Overview, Renewals, Spend Analyzer and All tools. The overview keeps the three financial summaries, agenda and outstanding requests; organizer totals and shortcuts live in All tools. Spend Analyzer uses Statements, Summary, Transactions and Backup views. Summary filters are expandable, and switching these views preserves in-memory statement data.

PDF extraction handles separate debit/credit tables and card amount columns, transaction/posting date pairs, spaced or dotted dates, slight text-baseline differences and wrapped rows. Reward/points and balance columns are excluded using header positions. Headerless layouts still require one unambiguous amount; ambiguous rows are skipped for review. Readable PDFs with unsupported layouts have a different error from PDFs with no readable text; a failed layout match is not treated as proof of a scan. ICICI-style fixtures are synthetic, not copies of real customer statements.
