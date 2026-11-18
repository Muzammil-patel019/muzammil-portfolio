"""Deliberately bounded LOCAL smoke traffic, not a benchmark or production load test."""
import os
import time
from urllib.parse import urlparse
import httpx

base = os.getenv("LAB_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
if urlparse(base).hostname not in ("localhost", "127.0.0.1", "::1"):
    raise SystemExit("This learning script only runs against localhost.")
with httpx.Client(base_url=base, timeout=5) as client:
    durations = []
    for _ in range(10):
        start = time.perf_counter()
        response = client.get("/api/lab/health")
        response.raise_for_status()
        durations.append((time.perf_counter() - start) * 1000)
        time.sleep(0.5)
print(f"10 local requests passed. Mean {sum(durations)/len(durations):.1f}ms. Not a capacity measurement.")
