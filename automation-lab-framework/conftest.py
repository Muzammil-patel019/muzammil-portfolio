import os
import re
from pathlib import Path
from urllib.parse import urlparse
import pytest
from playwright.sync_api import sync_playwright
from lab_framework.client import LabAPI
from lab_framework.pages.store import StorePage


def pytest_addoption(parser):
    parser.addoption("--base-url", default=os.getenv("LAB_BASE_URL", "http://127.0.0.1:3000"))
    parser.addoption("--browser", default="chromium", choices=["chromium", "firefox", "webkit"])
    parser.addoption("--commerce", action="store_true", default=False)
    parser.addoption("--headed", action="store_true", default=False)


@pytest.fixture(scope="session")
def base_url(request):
    value = request.config.getoption("--base-url").rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.path:
        raise pytest.UsageError("--base-url must be an HTTP(S) origin with no path")
    return value


@pytest.fixture
def api(base_url):
    client = LabAPI(base_url)
    yield client
    client.close()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    setattr(item, "report_" + report.when, report)


@pytest.fixture(scope="session")
def browser(request):
    with sync_playwright() as p:
        browser_type = getattr(p, request.config.getoption("--browser"))
        options = {"headless": not request.config.getoption("--headed")}
        if browser_type.name == "chromium" and os.getenv("LAB_CHROMIUM_EXECUTABLE"):
            options["executable_path"] = os.environ["LAB_CHROMIUM_EXECUTABLE"]
        instance = browser_type.launch(**options)
        yield instance
        instance.close()


@pytest.fixture
def page(browser, request):
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    context.tracing.start(screenshots=True, snapshots=True, sources=True)
    page = context.new_page()
    yield page
    failed = any(getattr(request.node, "report_" + phase, None) and
                 getattr(request.node, "report_" + phase).failed for phase in ("setup", "call"))
    if failed:
        folder = Path("artifacts")
        folder.mkdir(exist_ok=True)
        name = re.sub(r"[^A-Za-z0-9_-]", "_", request.node.nodeid)[:180]
        try:
            page.screenshot(path=str(folder / (name + ".png")), full_page=True)
        finally:
            context.tracing.stop(path=str(folder / (name + ".zip")))
    else:
        context.tracing.stop()
    context.close()


@pytest.fixture
def store(page, base_url):
    return StorePage(page, base_url)

@pytest.fixture
def workspace(api, request):
    if not request.config.getoption("--commerce"):
        pytest.skip("Use --commerce to create and delete isolated fictional practice runs")
    response = api.http.post("/api/lab/workspaces")
    assert response.status_code == 201, response.text
    token = response.json()["workspaceToken"]
    api.http.headers["X-Lab-Workspace"] = token
    try:
        yield api
    finally:
        cleanup = api.http.delete("/api/lab/workspace/destroy")
        assert cleanup.status_code == 200, cleanup.text
