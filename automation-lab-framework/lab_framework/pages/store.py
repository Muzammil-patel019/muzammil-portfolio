class StorePage:
    """User actions and locators, not hidden sleeps or test assertions."""
    def __init__(self, page, base_url):
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.products = page.get_by_role("region", name="Products", exact=True)

    def open(self):
        self.page.goto(f"{self.base_url}/lab")

    def search(self, term):
        self.page.get_by_label("Search products", exact=True).fill(term)
        self.page.get_by_role("button", name="Search", exact=True).click()

    def category(self, name):
        self.page.get_by_role("group", name="Product categories").get_by_role(
            "button", name=name, exact=True
        ).click()
