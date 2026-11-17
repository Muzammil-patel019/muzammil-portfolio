"""First tests: keep the arrange, act and assert steps visible."""
import os
import httpx

BASE = os.getenv("LAB_BASE_URL", "http://127.0.0.1:3000").rstrip("/")


def test_health():
    response = httpx.get(f"{BASE}/api/lab/health", timeout=10)
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["environment"] == "practice"


def test_category_filter():
    response = httpx.get(
        f"{BASE}/api/lab/products", params={"category": "desk"}, timeout=10
    )
    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["total"] == 4
    assert all(product["category"] == "desk" for product in body["data"])
