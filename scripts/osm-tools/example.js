import { useState, useEffect, useRef } from "react";

// Demo data - simulates what the radius query would return
const DEMO_RESULTS = {
  "Abilene, TX": {
    address: "1200 N 1st St, Abilene, TX 79601",
    lat: 32.4487,
    lng: -99.7331,
    radius_mi: 5,
    queue: {
      total: 23,
      active: 14,
      withdrawn: 6,
      completed: 3,
      total_mw: 4820,
      active_mw: 3200,
      nearest_sub: {
        name: "Abilene South 345kV",
        distance_mi: 2.1,
        projects_targeting: 8,
      },
    },
    county: { name: "Taylor County", type: "producer", net_mw: 1840 },
    data_centers: { existing: 1, announced: 3, under_construction: 2 },
  },
  "Dallas, TX": {
    address: "500 S Ervay St, Dallas, TX 75201",
    lat: 32.7767,
    lng: -96.797,
    radius_mi: 5,
    queue: {
      total: 41,
      active: 28,
      withdrawn: 9,
      completed: 4,
      total_mw: 8940,
      active_mw: 6100,
      nearest_sub: {
        name: "Cedar Hill 345kV",
        distance_mi: 4.3,
        projects_targeting: 12,
      },
    },
    county: { name: "Dallas County", type: "consumer", net_mw: -3200 },
    data_centers: { existing: 8, announced: 5, under_construction: 4 },
  },
  "Midland, TX": {
    address: "200 N Main St, Midland, TX 79701",
    lat: 31.9973,
    lng: -102.0779,
    radius_mi: 5,
    queue: {
      total: 7,
      active: 5,
      withdrawn: 1,
      completed: 1,
      total_mw: 1200,
      active_mw: 980,
      nearest_sub: {
        name: "Basin 345kV",
        distance_mi: 3.8,
        projects_targeting: 3,
      },
    },
    county: { name: "Midland County", type: "producer", net_mw: 4200 },
    data_centers: { existing: 0, announced: 1, under_construction: 0 },
  },
};

const CONGESTION_LEVELS = [
  { max: 5, label: "Low", color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  {
    max: 15,
    label: "Moderate",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
  },
  {
    max: 30,
    label: "High",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
  },
  {
    max: Infinity,
    label: "Critical",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.12)",
  },
];

function getCongestion(active) {
  return CONGESTION_LEVELS.find((l) => active <= l.max);
}

function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span>{display.toLocaleString()}</span>;
}

function PulsingDot({ color, size = 8 }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: color,
          animation: "pulse 2s ease-in-out infinite",
        }}
      />
      <span
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: color,
          opacity: 0.4,
          animation: "ping 2s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </span>
  );
}

function ConstraintCard({ data, onClose, visible }) {
  const congestion = getCongestion(data.queue.active);
  const subCongestion = getCongestion(data.queue.nearest_sub.projects_targeting);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: 24,
        right: 24,
        maxWidth: 420,
        backgroundColor: "rgba(10, 12, 18, 0.95)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 0,
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
        color: "#e2e8f0",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        zIndex: 100,
        overflow: "hidden",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PulsingDot color={congestion.color} size={10} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: congestion.color,
            }}
          >
            {congestion.label} congestion
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.3)",
            cursor: "pointer",
            fontSize: 18,
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Address */}
      <div style={{ padding: "16px 20px 8px" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          {data.radius_mi} mi radius
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.4 }}>
          {data.address}
        </div>
      </div>

      {/* Main metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1,
          margin: "12px 20px",
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Queue pressure */}
        <div style={{ padding: "16px", backgroundColor: congestion.bg }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            Active queue
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: congestion.color, lineHeight: 1 }}>
            <AnimatedNumber value={data.queue.active} />
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            {data.queue.total} total · <AnimatedNumber value={data.queue.active_mw} /> MW
          </div>
        </div>

        {/* Nearest sub */}
        <div style={{ padding: "16px", backgroundColor: subCongestion.bg }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            Nearest sub
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.3 }}>
            {data.queue.nearest_sub.name}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            {data.queue.nearest_sub.distance_mi} mi · {data.queue.nearest_sub.projects_targeting} projects
          </div>
        </div>

        {/* County type */}
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            County
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                backgroundColor:
                  data.county.type === "producer"
                    ? "rgba(34,197,94,0.12)"
                    : "rgba(239,68,68,0.12)",
                color:
                  data.county.type === "producer" ? "#22c55e" : "#ef4444",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {data.county.type}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            {data.county.name} · {data.county.net_mw > 0 ? "+" : ""}
            {data.county.net_mw.toLocaleString()} MW net
          </div>
        </div>

        {/* Data centers */}
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            Data centers
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>
            <AnimatedNumber
              value={
                data.data_centers.existing +
                data.data_centers.announced +
                data.data_centers.under_construction
              }
            />
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            {data.data_centers.existing} live · {data.data_centers.under_construction} building · {data.data_centers.announced} announced
          </div>
        </div>
      </div>

      {/* Queue breakdown bar */}
      <div style={{ padding: "4px 20px 16px" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Queue breakdown
        </div>
        <div
          style={{
            display: "flex",
            height: 6,
            borderRadius: 3,
            overflow: "hidden",
            gap: 2,
          }}
        >
          <div
            style={{
              flex: data.queue.active,
              backgroundColor: congestion.color,
              borderRadius: 3,
              transition: "flex 0.6s ease",
            }}
          />
          <div
            style={{
              flex: data.queue.withdrawn,
              backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 3,
              transition: "flex 0.6s ease",
            }}
          />
          <div
            style={{
              flex: data.queue.completed,
              backgroundColor: "#22c55e",
              borderRadius: 3,
              transition: "flex 0.6s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          <span>
            <span style={{ color: congestion.color }}>●</span> {data.queue.active} active
          </span>
          <span>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>●</span> {data.queue.withdrawn} withdrawn
          </span>
          <span>
            <span style={{ color: "#22c55e" }}>●</span> {data.queue.completed} completed
          </span>
        </div>
      </div>

      {/* Footer prompt */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
          ERCOT queue data Dec 2025
        </span>
        <button
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            padding: "5px 10px",
            cursor: "pointer",
            letterSpacing: "0.05em",
          }}
        >
          Something wrong? →
        </button>
      </div>
    </div>
  );
}

// Main demo app
export default function ERCOTDemo() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  const demoLocations = Object.keys(DEMO_RESULTS);

  useEffect(() => {
    if (query.length > 0) {
      const matches = demoLocations.filter((l) =>
        l.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  const handleSearch = (location) => {
    setSearching(true);
    setCardVisible(false);
    setQuery(location);
    setSuggestions([]);

    // Simulate search delay
    setTimeout(() => {
      setResult(DEMO_RESULTS[location]);
      setSearching(false);
      setTimeout(() => setCardVisible(true), 100);
    }, 600);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        backgroundColor: "#0a0c12",
        position: "relative",
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
        overflow: "hidden",
      }}
    >
      {/* Fake map background with grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow when result shows */}
      {result && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${getCongestion(result.queue.active).color}15 0%, transparent 70%)`,
            opacity: cardVisible ? 1 : 0,
            transition: "opacity 1s ease",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Search bar */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          right: 24,
          maxWidth: 420,
          zIndex: 200,
        }}
      >
        <div
          style={{
            position: "relative",
            backgroundColor: "rgba(10, 12, 18, 0.9)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: suggestions.length > 0 ? "12px 12px 0 0" : 12,
            overflow: "visible",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              gap: 10,
            }}
          >
            {searching ? (
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid rgba(255,255,255,0.1)",
                  borderTopColor: "#ef4444",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions.length > 0) {
                  handleSearch(suggestions[0]);
                }
              }}
              placeholder="Type an address in ERCOT territory..."
              style={{
                flex: 1,
                padding: "14px 0",
                backgroundColor: "transparent",
                border: "none",
                outline: "none",
                color: "#e2e8f0",
                fontSize: 13,
                fontFamily: "inherit",
                letterSpacing: "0.01em",
              }}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setResult(null);
                  setCardVisible(false);
                  inputRef.current?.focus();
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.3)",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: 4,
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div
            style={{
              backgroundColor: "rgba(10, 12, 18, 0.95)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderTop: "none",
              borderRadius: "0 0 12px 12px",
            }}
          >
            {suggestions.map((loc) => (
              <button
                key={loc}
                onClick={() => handleSearch(loc)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 16px 10px 42px",
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: 13,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = "rgba(255,255,255,0.04)")
                }
                onMouseLeave={(e) =>
                  (e.target.style.backgroundColor = "transparent")
                }
              >
                <span style={{ color: "rgba(255,255,255,0.2)", marginRight: 8 }}>↗</span>
                {loc}
              </button>
            ))}
          </div>
        )}

        {/* Demo hint */}
        {!query && !result && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", alignSelf: "center" }}>
              Try:
            </span>
            {demoLocations.map((loc) => (
              <button
                key={loc}
                onClick={() => handleSearch(loc)}
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.4)",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 6,
                  padding: "5px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = "rgba(255,255,255,0.15)";
                  e.target.style.color = "rgba(255,255,255,0.6)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = "rgba(255,255,255,0.06)";
                  e.target.style.color = "rgba(255,255,255,0.4)";
                }}
              >
                {loc}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Title watermark */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          opacity: result ? 0.03 : 0.06,
          transition: "opacity 0.6s ease",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          ERCOT
        </div>
        <div
          style={{
            fontSize: 14,
            color: "#fff",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            marginTop: 8,
          }}
        >
          Constraint Profile
        </div>
      </div>

      {/* Constraint Card */}
      {result && (
        <ConstraintCard
          data={result}
          visible={cardVisible}
          onClose={() => {
            setCardVisible(false);
            setTimeout(() => setResult(null), 400);
          }}
        />
      )}

      {/* Corner branding */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          fontSize: 10,
          color: "rgba(255,255,255,0.15)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Infrastructure Research
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  );
}