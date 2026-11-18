import httpx


class LabAPI:
    """Own connection setup; leave business assertions in tests."""
    def __init__(self, base_url):
        self.http = httpx.Client(base_url=base_url.rstrip("/"), timeout=10)

    def health(self):
        return self.http.get("/api/lab/health")

    def products(self, **params):
        return self.http.get("/api/lab/products", params=params)

    def product(self, product_id):
        return self.http.get(f"/api/lab/products/{product_id}")

    def close(self):
        self.http.close()
