FROM python:3.12-slim

WORKDIR /app

# System deps for openpyxl / pandas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure data & uploads dirs exist
RUN mkdir -p data uploads static

ENV PORT=8000
EXPOSE 8000

# Render sets $PORT
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
