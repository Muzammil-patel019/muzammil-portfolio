FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY component.cpp test_component.py ./
CMD ["python", "-m", "pytest", "-vv", "--junitxml=results/pytest.xml"]
