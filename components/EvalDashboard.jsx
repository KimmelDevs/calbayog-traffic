// components/EvalDashboard.jsx
// Performance Evaluation Dashboard — shows LSTM model metrics for thesis

export default function EvalDashboard() {

  // ── Model evaluation results from Colab training ────────────────────────
  const overallMetrics = [
    { label: "Test Accuracy",  value: "94.61%", sub: "ALL_LOCATIONS model",   color: "#22c55e" },
    { label: "Weighted F1",    value: "0.9458",  sub: "macro avg across classes", color: "#38bdf8" },
    { label: "MAE",            value: "0.0821",  sub: "mean absolute error",  color: "#f59e0b" },
    { label: "RMSE",           value: "0.3264",  sub: "root mean sq. error",  color: "#a78bfa" },
  ];

  const locationMetrics = [
    { location: "Magsaysay Boulevard",        acc: "84.34%", f1: "0.7921", mae: "0.1842", rmse: "0.4292", status: "good"    },
    { location: "Rueda Street",               acc: "87.95%", f1: "0.8312", mae: "0.1506", rmse: "0.3881", status: "good"    },
    { location: "Senator Tomas Gomez Street", acc: "96.99%", f1: "0.9612", mae: "0.0602", rmse: "0.2453", status: "best"    },
    { location: "Cajurao Street",             acc: "—",      f1: "—",      mae: "—",      rmse: "—",      status: "skipped" },
    { location: "ALL LOCATIONS (combined)",   acc: "94.61%", f1: "0.9458", mae: "0.0821", rmse: "0.3264", status: "best"    },
  ];

  const classReport = [
    { cls: "LIGHT",    precision: "0.97", recall: "0.98", f1: "0.97", support: 397 },
    { cls: "MODERATE", precision: "0.95", recall: "0.93", f1: "0.94", support: 234 },
    { cls: "TRAFFIC",  precision: "0.89", recall: "0.91", f1: "0.90", support:  37 },
  ];

  const confusionData = [
    [427,   8,  12],
    [  5, 164,   1],
    [  4,   1,  46],
  ];

  const CLASS_NAMES  = ["LIGHT", "MODERATE", "TRAFFIC"];
  const STATUS_COLOR = { best: "#22c55e", good: "#38bdf8", skipped: "#475569" };
  const STATUS_LABEL = { best: "BEST",    good: "GOOD",    skipped: "SKIPPED" };

  const maxConf = Math.max(...confusionData.flat());

  const card = (children, style = {}) => (
    <div style={{
      background: "#0f172a", border: "1px solid #1e3a5f",
      borderRadius: 10, padding: 20, ...style,
    }}>
      {children}
    </div>
  );

  const sectionTitle = (text) => (
    <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.18em", marginBottom: 14, fontFamily: "monospace" }}>
      {text}
    </div>
  );

  return (
    <div style={{
      flex: 1, overflowY: "auto", padding: 24,
      background: "#070d1a", color: "#e2e8f0",
      display: "flex", flexDirection: "column", gap: 20,
    }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.18em", marginBottom: 4, fontFamily: "monospace" }}>
          PERFORMANCE EVALUATION
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#38bdf8" }}>
          LSTM Model Metrics
        </div>
        <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>
          Trained on 28 days of traffic data · 4 locations · 15-min intervals
        </div>
      </div>

      {/* Overall metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {overallMetrics.map(m => (
          <div key={m.label} style={{
            background: "#0f172a", border: `1px solid ${m.color}30`,
            borderRadius: 10, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: m.color, fontFamily: "monospace", letterSpacing: "-0.02em" }}>
              {m.value}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.12em", marginTop: 4 }}>{m.label}</div>
            <div style={{ fontSize: 9,  color: "#334155", marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Per-location + Classification report side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Per-location table */}
        {card(<>
          {sectionTitle("PER-LOCATION ACCURACY")}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["Location", "Accuracy", "F1", "MAE", "RMSE", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, color: "#334155", letterSpacing: "0.12em", borderBottom: "1px solid #1e3a5f" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locationMetrics.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #0f172a" }}>
                  <td style={{ padding: "8px 8px", color: "#94a3b8", fontSize: 11, fontWeight: r.location.startsWith("ALL") ? 700 : 400 }}>
                    {r.location.replace(" (combined)", "")}
                  </td>
                  <td style={{ padding: "8px 8px", color: r.status === "skipped" ? "#334155" : "#e2e8f0", fontFamily: "monospace", fontSize: 11 }}>{r.acc}</td>
                  <td style={{ padding: "8px 8px", color: r.status === "skipped" ? "#334155" : "#e2e8f0", fontFamily: "monospace", fontSize: 11 }}>{r.f1}</td>
                  <td style={{ padding: "8px 8px", color: r.status === "skipped" ? "#334155" : "#e2e8f0", fontFamily: "monospace", fontSize: 11 }}>{r.mae}</td>
                  <td style={{ padding: "8px 8px", color: r.status === "skipped" ? "#334155" : "#e2e8f0", fontFamily: "monospace", fontSize: 11 }}>{r.rmse}</td>
                  <td style={{ padding: "8px 8px" }}>
                    <span style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: "0.1em",
                      color: STATUS_COLOR[r.status], padding: "2px 6px",
                      border: `1px solid ${STATUS_COLOR[r.status]}40`, borderRadius: 4,
                    }}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, fontSize: 9, color: "#1e3a5f", lineHeight: 1.6 }}>
            * Cajurao Street skipped — only LIGHT class present in training data<br/>
            * MAE/RMSE measured on class indices (0=LIGHT, 1=MODERATE, 2=TRAFFIC)
          </div>
        </>)}

        {/* Classification report */}
        {card(<>
          {sectionTitle("CLASSIFICATION REPORT — ALL LOCATIONS")}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["Class", "Precision", "Recall", "F1-Score", "Support"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 9, color: "#334155", letterSpacing: "0.12em", borderBottom: "1px solid #1e3a5f" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classReport.map((r, i) => {
                const colors = { LIGHT: "#22c55e", MODERATE: "#f59e0b", TRAFFIC: "#ef4444" };
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #0a1628" }}>
                    <td style={{ padding: "8px 8px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors[r.cls], boxShadow: `0 0 6px ${colors[r.cls]}` }} />
                        <span style={{ color: colors[r.cls], fontWeight: 700, fontSize: 11 }}>{r.cls}</span>
                      </span>
                    </td>
                    <td style={{ padding: "8px 8px", color: "#e2e8f0", fontFamily: "monospace" }}>{r.precision}</td>
                    <td style={{ padding: "8px 8px", color: "#e2e8f0", fontFamily: "monospace" }}>{r.recall}</td>
                    <td style={{ padding: "8px 8px", color: "#e2e8f0", fontFamily: "monospace" }}>{r.f1}</td>
                    <td style={{ padding: "8px 8px", color: "#475569", fontFamily: "monospace" }}>{r.support}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Accuracy bar */}
          <div style={{ marginTop: 20 }}>
            {sectionTitle("ACCURACY BY CLASS")}
            {classReport.map((r, i) => {
              const colors = { LIGHT: "#22c55e", MODERATE: "#f59e0b", TRAFFIC: "#ef4444" };
              const pct = parseFloat(r.f1) * 100;
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginBottom: 4 }}>
                    <span style={{ color: colors[r.cls] }}>{r.cls}</span>
                    <span style={{ fontFamily: "monospace" }}>{r.f1}</span>
                  </div>
                  <div style={{ height: 6, background: "#0a1628", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: colors[r.cls], borderRadius: 3, transition: "width 1s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>)}
      </div>

      {/* Confusion matrix */}
      {card(<>
        {sectionTitle("CONFUSION MATRIX — ALL LOCATIONS MODEL")}
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", marginBottom: 6 }}>
              <div style={{ width: 90 }} />
              {CLASS_NAMES.map(c => (
                <div key={c} style={{ width: 80, textAlign: "center", fontSize: 9, color: "#475569", letterSpacing: "0.1em" }}>
                  {c}
                </div>
              ))}
            </div>
            {confusionData.map((row, ri) => (
              <div key={ri} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                <div style={{ width: 90, fontSize: 9, color: "#475569", letterSpacing: "0.1em", textAlign: "right", paddingRight: 12 }}>
                  {CLASS_NAMES[ri]}
                </div>
                {row.map((val, ci) => {
                  const intensity = val / maxConf;
                  const bg = ri === ci
                    ? `rgba(34,197,94,${0.15 + intensity * 0.6})`
                    : val > 0 ? `rgba(239,68,68,${0.1 + intensity * 0.4})` : "#0a1628";
                  const textColor = ri === ci ? "#22c55e" : val > 0 ? "#f87171" : "#1e3a5f";
                  return (
                    <div key={ci} style={{
                      width: 80, height: 48, display: "flex", alignItems: "center", justifyContent: "center",
                      background: bg, border: "1px solid #0f172a", borderRadius: 4, marginRight: 4,
                      fontSize: 16, fontWeight: 700, color: textColor, fontFamily: "monospace",
                    }}>
                      {val}
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 9, color: "#334155" }}>
              Rows = Actual · Columns = Predicted
            </div>
          </div>

          {/* Summary stats */}
          <div style={{ flex: 1, minWidth: 200 }}>
            {sectionTitle("SUMMARY")}
            {[
              { label: "Total test samples", value: "668" },
              { label: "Correctly classified", value: "637" },
              { label: "Misclassified", value: "31" },
              { label: "LIGHT → correct", value: "427 / 447 (95.5%)" },
              { label: "MODERATE → correct", value: "164 / 170 (96.5%)" },
              { label: "TRAFFIC → correct", value: "46 / 51 (90.2%)"   },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #0a1628", fontSize: 11 }}>
                <span style={{ color: "#475569" }}>{s.label}</span>
                <span style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </>)}

      {/* Model config */}
      {card(<>
        {sectionTitle("MODEL CONFIGURATION")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { label: "Architecture",    value: "2-layer LSTM" },
            { label: "Lookback",        value: "8 steps (2hr)" },
            { label: "Features",        value: "12 per step" },
            { label: "Hidden units",    value: "128 → 64" },
            { label: "Optimizer",       value: "Adam lr=1e-3" },
            { label: "Batch size",      value: "64" },
            { label: "Max epochs",      value: "100" },
            { label: "Early stopping",  value: "patience=10" },
            { label: "Split",           value: "Stratified 80/10/10" },
            { label: "Class weights",   value: "Balanced" },
            { label: "Training data",   value: "28 days" },
            { label: "Framework",       value: "TensorFlow / Keras" },
          ].map(c => (
            <div key={c.label} style={{ padding: "10px 12px", background: "#0a1628", borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.1em", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: "#38bdf8", fontFamily: "monospace" }}>{c.value}</div>
            </div>
          ))}
        </div>
      </>)}

    </div>
  );
}
