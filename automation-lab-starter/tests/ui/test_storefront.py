"""Start with one browser test before extracting page objects."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv("LAB_BASE_URL", "http://127.0.0.1:3000").rstrip("/")


def test_product_search():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.getenv("LAB_CHROMIUM_EXECUTABLE")
        )
        try:
            page = browser.new_page()
            page.goto(f"{BASE}/lab")
            page.get_by_label("Search products", exact=True).fill("Orbit")
            page.get_by_role("button", name="Search", exact=True).click()
            catalogue = page.get_by_role("region", name="Products", exact=True)
            expect(catalogue.get_by_role("article")).to_have_count(1)
            expect(catalogue.get_by_role("heading", name="Orbit headphones")).to_be_visible()
        finally:
            browser.close()
