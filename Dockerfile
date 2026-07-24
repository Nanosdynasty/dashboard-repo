FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc unzip \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pull tracker CSVs from the bundled zip if they are missing
RUN mkdir -p data uploads static/js static/css && \
    if [ -f "gem-dashboard (1).zip" ]; then \
      unzip -o "gem-dashboard (1).zip" -d /tmp/dash && \
      for f in coal_terminals.csv world_ports.csv coal_terminals.csv.gz world_ports.csv.gz summaries.json; do \
        if [ -f "/tmp/dash/gem-dashboard/data/$f" ]; then \
          cp -f "/tmp/dash/gem-dashboard/data/$f" "data/$f"; \
        fi; \
      done && \
      rm -rf /tmp/dash; \
    fi && \
    echo "=== data dir ===" && ls -la data/

ENV PORT=8000
EXPOSE 8000

CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
