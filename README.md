# Global Energy & Maritime Intelligence Dashboard

An interactive FastAPI dashboard combining Global Energy Monitor assets with a
normalized port catalog and an analytical voyage-distance tool.

The current foundation prioritizes dry-bulk workflows and uses an HRP-inspired
navy, teal, cyan, and route-orange interface.

---

## Features

- **Official GEM trackers** pre-loaded (Jan–Mar 2026 releases)
- 3,669 normalized World Port Index records with country, harbor, depth, vessel,
  navigation, service, and facility fields where present
- Dry-bulk-first port map with category, country, search, and minimum-depth filters
- Source-aware hover cards and persistent click-through port detail drawer
- Geographically guarded enrichment from the GEM Global Coal Terminals Tracker
- Voyage distance, duration, route polyline, port swap, and map-to-route selection
- Filterable data tables (status, country, capacity, search)
- KPI cards (operating GW, units, countries)
- **Upload** Excel / CSV / JSON → becomes a new queryable tracker
- **Export** current filtered view as multi-sheet Excel
- **Chat**: plain-English questions
  - Primary: Grok (set `XAI_API_KEY`)
  - Optional: local LLM (LM Studio or Ollama OpenAI-compatible endpoint)
  - Built-in heuristic fallback when no LLM is configured

---

## Quick start (local)

### Easiest — one-click scripts

**macOS / Linux**
```bash
cd gem-dashboard
chmod +x start.sh
./start.sh
```

**Windows**
```
Double-click start.bat
```
(or open a terminal in the folder and run `start.bat`)

The script will:
1. Create a virtual environment (if needed)
2. Install dependencies
3. Start the server
4. Open http://localhost:8000 in your browser

### Manual start

```bash
cd gem-dashboard
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Open http://localhost:8000

### Environment variables

Copy `.env.example` values into your deployment environment. Important variables:

- `AISSTREAM_API_KEY`: optional live AIS vessel tracking. Never commit this value.
- `ALLOWED_ORIGINS`: comma-separated trusted browser origins.
- `XAI_API_KEY`: optional Grok chat integration.
- `LOCAL_LLM_URL`: optional local OpenAI-compatible model endpoint.

If an AIS credential was previously committed, revoke it at the provider and
replace it with a newly issued environment-only key.

### Optional: local LLM

1. Start LM Studio or Ollama with an OpenAI-compatible server (port 1234 by default).
2. In the dashboard chat tab, tick “Use local LLM” and confirm the URL.

---

## Deploy on Render.com

### Option A – Blueprint (recommended)

1. Push this folder to a GitHub repo.
2. In Render → New → Blueprint → connect the repo.
3. Render will read `render.yaml` and create the web service.
4. After deploy, go to Environment and add:
   - `XAI_API_KEY` = your xAI / Grok key (optional but recommended)

### Option B – Manual Docker

1. New → Web Service → connect repo.
2. Runtime: Docker
3. Plan: Free (or Starter)
4. Health check path: `/api/health`
5. Add env var `XAI_API_KEY` if desired.

The free tier sleeps after inactivity; first request may take ~30 s.

---

## Data included

| Tracker       | Rows   | Operating capacity (approx) |
|---------------|--------|-----------------------------|
| Coal Plants   | 14 509 | ~2 200 GW                   |
| Solar         | 103 940| ~1 268 GW                   |
| Wind          | 33 248 | ~1 128 GW                   |
| Hydropower    | 6 772  | ~1 275 GW                   |
| Nuclear       | 1 749  | ~401 GW                     |

Source: Global Energy Monitor trackers (January–March 2026 releases). Attribution required under CC BY 4.0.

The port layer uses the repository's bundled World Port Index extract and GEM
coal-terminal data. The normalizer accepts richer official WPI column aliases,
so a future official refresh can add fields without changing the front-end API.
Unknown values—including berth count—remain unknown and are never converted to
zero. Port-to-terminal links are enrichment candidates based on name and
distance, expose match confidence, and are not authoritative facility joins.

## Verification

```bash
python -m unittest discover -s tests -v
node --check static/js/app.js
node --check static/js/app-map.js
```

---

## Project layout

```
gem-dashboard/
├── app.py              # FastAPI backend + DuckDB
├── data/               # Pre-processed CSV.GZ trackers
├── static/             # Frontend (HTML/CSS/JS)
├── uploads/            # User-uploaded files
├── start.sh            # One-click start (macOS / Linux)
├── start.bat           # One-click start (Windows)
├── Dockerfile
├── render.yaml
├── requirements.txt
└── README.md
```

---

## Color palette (official GEM)

- Midnight `#002430` · Navy `#004A63` · Teal `#016B83`
- Orange `#FE4F2D` · Mint `#A5E9E4` · Warm White `#F2F2EB`
- Status: Green (operating), Orange (construction), Indigo (announced), Deep Red (cancelled), Grey (retired)

---

Built for deployment on Render.com · Data © Global Energy Monitor
