import pytest
from playwright.sync_api import expect
pytestmark = pytest.mark.ui


@pytest.mark.smoke
def test_search(store):
    store.open()
    store.search("Orbit")
    expect(store.products.get_by_role("article")).to_have_count(1)
    expect(store.products.get_by_role("heading", name="Orbit headphones")).to_be_visible()


def test_empty_then_recover(store, page):
    store.open()
    store.search("no-match-xyz")
    expect(page.get_by_role("heading", name="No products match these filters.")).to_be_visible()
    store.search("Orbit")
    expect(store.products.get_by_role("article")).to_have_count(1)
