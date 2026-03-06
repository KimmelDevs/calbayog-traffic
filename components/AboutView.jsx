// components/AboutView.jsx
export default function AboutView() {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 32,
        maxWidth: 820,
      }}
    >
      <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.15em", marginBottom: 4 }}>
        ABOUT THIS SYSTEM
      </div>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#38bdf8",
          marginBottom: 4,
          letterSpacing: "0.03em",
        }}
      >
        Data-Driven Traffic Flow Prediction
      </h1>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 32 }}>
        Calbayog City, Samar — Powered by Long Short-Term Memory (LSTM) Neural Networks
      </div>

      <Block title="Overview">
        This system predicts and visualizes traffic flow patterns across key road segments in
        Calbayog City proper. It uses an LSTM-based deep learning model trained on historical
        traffic data to forecast vehicle volume by hour of day.
      </Block>

      <Block title="Objectives">
        <ol style={{ paddingLeft: 20, color: "#94a3b8", fontSize: 13, lineHeight: 2 }}>
          <li>Collect and preprocess traffic-related data from Calbayog City road network.</li>
          <li>Design and implement an LSTM-based predictive model for traffic flow.</li>
          <li>Evaluate model performance using prediction accuracy metrics.</li>
          <li>
            Develop a user-friendly interface to visualize predicted traffic flow trends for
            drivers, commuters, and city authorities.
          </li>
        </ol>
      </Block>

      <Block title="Technology Stack">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { tech: "Next.js", role: "React framework (frontend)" },
            { tech: "OpenStreetMap", role: "Open-source map tiles" },
            { tech: "Leaflet.js", role: "Interactive map rendering" },
            { tech: "LSTM (TensorFlow)", role: "Deep learning prediction model" },
            { tech: "MySQL", role: "Traffic data storage" },
            { tech: "React", role: "UI components" },
          ].map((t) => (
            <div
              key={t.tech}
              style={{
                background: "#0f172a",
                border: "1px solid #1e3a5f",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8" }}>{t.tech}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>{t.role}</div>
            </div>
          ))}
        </div>
      </Block>

      <Block title="LSTM Model">
        Long Short-Term Memory (LSTM) networks are a type of recurrent neural network (RNN)
        designed to learn long-term temporal dependencies in sequential data. For traffic
        prediction, LSTM captures patterns such as daily peaks (morning and evening rush hours)
        and weekly periodicity (weekday vs. weekend traffic).
        <br /><br />
        The model is trained on historical traffic volume data (vehicles per hour) for selected
        road segments in Calbayog City, and predicts the next 24 hours of traffic flow.
      </Block>

      <Block title="Scope & Limitations">
        <ul style={{ paddingLeft: 20, color: "#94a3b8", fontSize: 13, lineHeight: 2 }}>
          <li>Coverage limited to selected road segments in Calbayog City proper only.</li>
          <li>Model does not account for accidents, roadworks, or special events.</li>
          <li>Requires stable internet connection for map rendering.</li>
          <li>Prediction accuracy depends on quality and quantity of historical data.</li>
          <li>No mobile offline functionality in the current version.</li>
        </ul>
      </Block>

      <Block title="Research Context">
        This system was developed as part of an academic research project (Group 5) examining
        data-driven approaches to urban traffic management in Philippine cities. The study
        addresses the growing traffic congestion challenges in Calbayog City by applying
        state-of-the-art deep learning techniques to local road network data.
      </Block>

      <div
        style={{
          marginTop: 16,
          padding: "14px 16px",
          background: "#0f172a",
          border: "1px solid #1e3a5f",
          borderRadius: 8,
          fontSize: 10,
          color: "#334155",
          letterSpacing: "0.05em",
        }}
      >
        Group 5 — Calbayog City LSTM Traffic Prediction System — Academic Research Project
      </div>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 10,
          color: "#3b82f6",
          letterSpacing: "0.15em",
          marginBottom: 10,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#94a3b8",
          lineHeight: 1.8,
          borderLeft: "2px solid #1e3a5f",
          paddingLeft: 16,
        }}
      >
        {children}
      </div>
    </div>
  );
}
