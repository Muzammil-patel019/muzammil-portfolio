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
