# 🚦 Calbayog City — LSTM Traffic Flow Prediction System

A data-driven web application for predicting and visualizing traffic flow in Calbayog City, Samar, Philippines. Built with Next.js, OpenStreetMap (Leaflet), and an LSTM-based prediction model.

---

## Features

- 🗺️ **Interactive Map** — OpenStreetMap with color-coded road segments showing live traffic status
- 📊 **Analytics Dashboard** — Bar charts, heatmaps, and model summary panels
- ⏱️ **Time Simulation** — Scrub through 24 hours or press Play to animate traffic predictions
- 🧠 **LSTM Prediction** — Simulated LSTM-style flow curves (replace with your trained model)
- ℹ️ **About Page** — Research context, tech stack, and system documentation

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone or copy this folder, then:
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

---

## Project Structure

```
calbayog-traffic/
├── components/
│   ├── Header.jsx          # Top navigation bar with live clock
│   ├── Sidebar.jsx         # Stats, time control, legend, road list
│   ├── TrafficMap.jsx      # Leaflet + OpenStreetMap map (client-side only)
│   ├── SegmentPanel.jsx    # Road detail panel with 24hr chart
│   ├── AnalyticsView.jsx   # Full analytics dashboard
│   └── AboutView.jsx       # About / research info page
├── lib/
│   └── trafficData.js      # Road segments, LSTM simulation, helpers
├── pages/
│   ├── _app.jsx            # Global app wrapper
│   ├── _document.jsx       # Custom HTML head (fonts, Leaflet CSS)
│   ├── index.jsx           # Main page
│   └── api/
│       └── predict.js      # REST API endpoint for predictions
├── styles/
│   └── globals.css         # Global styles and Leaflet overrides
├── public/                 # Static assets
├── next.config.js
└── package.json
```

---

## Connecting Your Real LSTM Model

The app currently uses a mathematical approximation of LSTM output. To connect your trained model:

### Option A: Python backend (recommended)

1. Serve your TensorFlow/Keras model via FastAPI or Flask:
   ```python
   # Example endpoint
   @app.get("/predict/{segment_id}/{hour}")
   def predict(segment_id: int, hour: int):
       flow = model.predict(...)
       return {"flow": flow}
   ```

2. Update `lib/trafficData.js` — replace `simulateLSTMFlow` with a `fetch` call:
   ```js
   export async function fetchLSTMFlow(segmentId, hour) {
     const res = await fetch(`http://localhost:8000/predict/${segmentId}/${hour}`);
     const data = await res.json();
     return data.flow;
   }
   ```

3. Update `pages/api/predict.js` to proxy requests to your Python backend.

### Option B: TensorFlow.js in-browser

Export your Keras model to TF.js format and load it directly in the browser:
```bash
pip install tensorflowjs
tensorflowjs_converter --input_format keras model.h5 public/tfjs_model/
```

---

## Road Segments

Currently monitored roads in Calbayog City proper:

| ID | Name | Base Flow |
|----|------|-----------|
| 1 | Maharlika Highway (North) | 320 veh/hr |
| 2 | Maharlika Highway (South) | 410 veh/hr |
| 3 | Mabini St – City Proper | 280 veh/hr |
| 4 | Rizal Boulevard | 195 veh/hr |
| 5 | Sto. Niño – Market Road | 460 veh/hr |
| 6 | Obrero Road | 150 veh/hr |
| 7 | Rosales Street | 220 veh/hr |
| 8 | San Joaquin Road | 175 veh/hr |

Add more segments in `lib/trafficData.js` under `ROAD_SEGMENTS`.

---

## Traffic Level Thresholds

| Level | Flow | Color |
|-------|------|-------|
| Light | < 200 veh/hr | 🟢 Green |
| Moderate | 200–349 | 🟡 Amber |
| Heavy | 350–499 | 🟠 Orange |
| Congested | ≥ 500 | 🔴 Red |

---

## Research Context

This system was developed for an academic research project (Group 5) titled:
> *"A Data-Driven Traffic Flow Prediction System in Calbayog City Using LSTM"*

**Technologies:** Next.js · OpenStreetMap · Leaflet.js · LSTM (TensorFlow) · MySQL
