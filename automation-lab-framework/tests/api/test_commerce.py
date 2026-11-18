import uuid
import pytest
pytestmark = [pytest.mark.api, pytest.mark.commerce]


def login(api, role):
    response = api.http.post("/api/lab/workspace/session", json={
        "email": f"{role}@lab.test", "password": "Practice123!"
    })
    assert response.status_code == 200, response.text
    api.http.headers["Authorization"] = "Bearer " + response.json()["sessionToken"]


def test_checkout_replay_and_refund(workspace):
    login(workspace, "customer")
    added = workspace.http.post("/api/lab/workspace/cart", json={"productId": "p-001", "quantity": 2})
    assert added.status_code == 200
    headers = {"Idempotency-Key": str(uuid.uuid4())}
    body = {"coupon": "SAVE10", "payment": "approved"}
    created = workspace.http.post("/api/lab/workspace/orders", json=body, headers=headers)
    assert created.status_code == 201, created.text
    order = created.json()["data"]
    assert order["totalMinor"] == 629820
    replay = workspace.http.post("/api/lab/workspace/orders", json=body, headers=headers)
    assert replay.status_code == 200
    assert replay.json()["data"]["id"] == order["id"]
    forbidden = workspace.http.patch(f'/api/lab/workspace/orders/{order["id"]}', json={"action": "refund"})
    assert forbidden.status_code == 403
    login(workspace, "admin")
    refunded = workspace.http.patch(f'/api/lab/workspace/orders/{order["id"]}', json={"action": "refund"})
    assert refunded.status_code == 200
    state = workspace.http.get("/api/lab/workspace/state").json()
    assert state["products"][0]["stock"] == 12


def test_reset_invalidates_signed_session(workspace):
    login(workspace, "customer")
    reset = workspace.http.post("/api/lab/workspace/reset", json={})
    assert reset.status_code == 200
    response = workspace.http.get("/api/lab/workspace/state")
    assert response.status_code == 401


def test_inventory_requires_admin(workspace):
    login(workspace, "support")
    forbidden = workspace.http.patch("/api/lab/workspace/products/p-001", json={"stock": 1})
    assert forbidden.status_code == 403
    login(workspace, "admin")
    changed = workspace.http.patch("/api/lab/workspace/products/p-001", json={"stock": 1})
    assert changed.status_code == 200
    assert changed.json()["data"]["stock"] == 1


def test_provider_event_replay(workspace):
    login(workspace, "customer")
    assert workspace.http.post("/api/lab/workspace/cart", json={"productId": "p-001", "quantity": 1}).status_code == 200
    response = workspace.http.post("/api/lab/workspace/orders", json={"payment": "pending"}, headers={"Idempotency-Key": str(uuid.uuid4())})
    assert response.status_code == 201
    order_id = response.json()["data"]["id"]
    login(workspace, "admin")
    state = workspace.http.get("/api/lab/workspace/state").json()
    payload = {"eventId": str(uuid.uuid4()), "orderId": order_id, "status": "paid"}
    headers = {"X-Lab-Webhook-Key": state["webhookSecret"]}
    first = workspace.http.post("/api/lab/workspace/webhooks", json=payload, headers=headers)
    assert first.status_code == 200
    repeated = workspace.http.post("/api/lab/workspace/webhooks", json=payload, headers=headers)
    assert repeated.status_code == 200
    assert repeated.json()["duplicate"] is True
    wrong = workspace.http.post("/api/lab/workspace/webhooks", json=payload, headers={"X-Lab-Webhook-Key": "wrong"})
    assert wrong.status_code == 403
