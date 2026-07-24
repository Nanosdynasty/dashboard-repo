# Global Energy Transition Dashboard

**GEM-style multi-tracker web app** powered by Global Energy Monitor data (Coal Plants, Solar, Wind, Hydro, Nuclear).

Clean interactive UI · Map + filters · Excel export · Upload extra data · Natural-language analysis (Grok or local LLM via LM Studio / Ollama).

---

## Features

- **Official GEM trackers** pre-loaded (Jan–Mar 2026 releases)
- Interactive Leaflet map with status-colored markers
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

### Optional: real Grok

```bash
export XAI_API_KEY=your_xai_key          # macOS/Linux
set XAI_API_KEY=your_xai_key             # Windows (cmd)
```

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
