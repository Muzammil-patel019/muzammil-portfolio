# Automation Lab: your first tests

Start with two pytest API tests and one Playwright UI test. These tests use only fictional, read-only lab data. You do not need an owner account, API token or real payment information.

## Set up

Use Python 3.10 or later. Open a terminal in this extracted folder.

```sh
python -m venv .venv
```

Activate the environment:

- Windows PowerShell: `.venv\Scripts\Activate.ps1`
- macOS/Linux: `source .venv/bin/activate`

```sh
python -m pip install -r requirements.txt
python -m playwright install chromium
```

## Choose the application

For local development, clone https://github.com/Muzammil-patel019/muzammil-portfolio and run these from the repository root:

```sh
npm --prefix web ci
npm --prefix web run dev
```

Keep that terminal open. Tests default to http://127.0.0.1:3000.

To test the deployed website instead, set the origin only (no /lab suffix):

- Windows PowerShell: `$env:LAB_BASE_URL="https://www.muzammilpatel.com"`
- macOS/Linux: `export LAB_BASE_URL=https://www.muzammilpatel.com`

## Run and understand

```sh
python -m pytest tests/api -v
python -m pytest tests/ui -v
```

Read each test as Arrange -> Act -> Assert. Change an expected value deliberately, observe the failure and restore it. Use browser DevTools Network to compare a UI action with the corresponding API request.

Try adding tests for missing product 404, invalid page 400, and sorting every price. Keep tests independent. Avoid sleeps; use Playwright's locator assertions.

## Framework roadmap

1. Run these direct tests and understand each line.
2. Add a few independent tests for search, stock and invalid input.
3. Once setup repeats, introduce fixtures for the HTTP client and browser.
4. Extract a small API client and page objects when they reduce real duplication.
5. Add test data isolation, reports and CI as later application stages arrive.

This is a deliberately small starter, not a finished enterprise framework. Later login/cart/admin/reset features are planned and are not available in Stage 1.

If your environment supplies Chromium separately, set `LAB_CHROMIUM_EXECUTABLE` to its executable path. Otherwise the test uses the browser installed by Playwright.
