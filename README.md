# SkyRoute AI — Agentic Flight Route Advisor

**SkyRoute AI** is an agentic AI flight route advisor for pilots. It analyzes real-time weather along multiple possible flight paths between any two locations globally and recommends the safest and most efficient one.

Built with a dark cockpit-dashboard aesthetic, real-time Open-Meteo atmospheric telemetry, and a multi-turn Google Gemini ReAct agent loop with function calling.

---

## 🛠️ Tech Stack

- **Frontend**: React 19 (Vite) + Tailwind CSS + Lucide Icons
- **Interactive Map**: Leaflet.js (CartoDB Dark Matter aviation tiles) with custom waypoint markers & flight path polylines
- **Backend**:
  - Node.js / Express (container-native entry point for AI Studio)
  - Python Flask (in `/backend` with pandas, rapidfuzz, geopy, requests, and google-generativeai for Replit / standalone Python deployment)
- **Geocoding & Airports**: OurAirports global database with fuzzy matching
- **Atmospheric Data**: Open-Meteo live forecast API (global, free, no API key required)
- **Agentic AI**: Google Gemini API (`gemini-2.0-flash` / `gemini-2.5-flash`) executing an autonomous **ReAct** (Reason ➔ Act ➔ Observe ➔ Repeat) loop using function calling:
  - `get_waypoint_detail(route_name, waypoint_index)`
  - `compare_routes(route_a, route_b)`

---

## 🔑 Environment Variables & Secrets

Add the following secret in your environment settings (e.g. **Replit Secrets** or **AI Studio Settings > Secrets**):

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key used for the agentic function-calling ReAct loop. |

> **Note**: If `GEMINI_API_KEY` is not set or hits free-tier rate limits, SkyRoute AI gracefully falls back to deterministic meteorological rule analysis so operations never crash or stall.

---

## 🚀 How It Works

1. **Place Name Resolution**: Resolves natural city names (e.g., "Chennai", "Delhi", "London", "Tokyo") or ICAO/IATA codes into the nearest major airport using fuzzy matching. Ambiguous names offer immediate selectable suggestions.
2. **Multi-Corridor Generation**: Generates 3 candidate paths using great-circle spherical geodesics:
   - **Direct Route**: Shortest great-circle path.
   - **Northern Deviation**: Corridors with northward lateral deflection.
   - **Southern Deviation**: Corridors with southward lateral deflection.
3. **Live Atmospheric Telemetry**: Pulls live temperature (°C), relative humidity (%), wind speed (km/h), and wind direction (degrees) at 15 waypoints along all 3 corridors via Open-Meteo.
4. **Flight Dynamics**:
   - Compares route bearing vs wind direction to compute headwind/tailwind vectors.
   - Calculates effective ground speed and estimated flight time.
   - Assigns risk scores (**Low**, **Medium**, **High**) based on wind shear, turbulence, and icing risks.
5. **Agentic ReAct Loop**:
   - Gemini receives the 3 candidate paths and reasons step-by-step.
   - Autonomously invokes tools (`get_waypoint_detail`, `compare_routes`) to interrogate specific waypoints and compare alternatives.
   - Synthesizes a final pilot-friendly recommendation with transparent reasoning traces.

---

## 📂 Project Structure

```
├── backend/
│   ├── app.py                # Flask entry point (/api/find-route, /api/airports)
│   ├── geocode.py            # Place name -> Airport resolution with rapidfuzz & pandas
│   ├── routes.py             # Great-circle candidate route & waypoint generation (geopy)
│   ├── weather.py            # Open-Meteo API integration & risk scoring
│   ├── agent.py              # Gemini ReAct loop with function calling tools
│   ├── requirements.txt      # Python dependencies (flask, pandas, rapidfuzz, geopy, etc.)
│   └── airports.csv          # Global airport data from OurAirports
├── src/
│   ├── components/
│   │   ├── Navbar.tsx             # Cockpit topbar with live UTC aviator clock
│   │   ├── InputForm.tsx          # Screen 1: From/To, swap, collapsible advanced options
│   │   ├── AgentStatusFeed.tsx    # Screen 2: Real-time agent status & radar sweep
│   │   ├── ResultsDashboard.tsx   # Screen 3: 60/40 cockpit map and route cards
│   │   ├── MapView.tsx            # Leaflet map with colored polylines and weather popups
│   │   ├── RouteCard.tsx          # Route card with risk badges & expandable "Why?"
│   │   └── AgentReasoningLog.tsx  # Expandable ReAct trace audit log
│   ├── App.tsx                    # Screen controller & state management
│   ├── types.ts                   # TypeScript interfaces & types
│   └── index.css                  # Cockpit theme styling
├── server.ts                 # Full-stack Express server
└── package.json
```

---

## 💻 Running the App

### Node.js / React (AI Studio & Local Dev)
```bash
npm install
npm run dev
```

### Python Flask Backend (Standalone / Replit)
```bash
cd backend
pip install -r requirements.txt
python app.py
```
