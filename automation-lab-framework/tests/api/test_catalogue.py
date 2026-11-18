import pytest
pytestmark = pytest.mark.api


@pytest.mark.smoke
def test_health(api):
    response = api.health()
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.parametrize("category", ["desk", "tech", "everyday"])
def test_category_contract(api, category):
    response = api.products(category=category)
    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["total"] == 4
    assert len(body["data"]) == 4
    assert all(p["category"] == category for p in body["data"])


@pytest.mark.parametrize("params", [{"page": 0}, {"pageSize": 25}, {"category": "unknown"}])
def test_invalid_query(api, params):
    response = api.products(**params)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_QUERY"


def test_prices_are_sorted(api):
    response = api.products(sort="price-asc", pageSize=24)
    assert response.status_code == 200
    prices = [p["priceMinor"] for p in response.json()["data"]]
    assert len(prices) == 12
    assert prices == sorted(prices)


def test_missing_product(api):
    response = api.product("missing")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PRODUCT_NOT_FOUND"
