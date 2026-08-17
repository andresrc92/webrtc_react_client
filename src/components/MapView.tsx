import { MAP_META, pixelToWorld, worldToPercent, type WorldPoint } from "../map/mapMeta";

export type MarkerKind = "robot" | "defect" | "alert" | "goal" | "home" | "pending";

export interface MapMarker {
  id: string;
  world: WorldPoint;
  label?: string;
  kind?: MarkerKind;
}

// Per-robot plan path colors, distinguishable on the dark map.
const PLAN_COLORS: Record<string, string> = {
  go2_a: "#0e7490",
  go2_b: "#fb923c",
};
const DEFAULT_PLAN_COLOR = "#a78bfa";

interface Props {
  markers?: MapMarker[];
  clickMode?: boolean;
  onMapClick?: (world: WorldPoint) => void;
  pendingPin?: WorldPoint | null;
  plans?: Record<string, { x: number; y: number }[]>;
}

// Renders the shared facility map with world-coordinate overlays. Anything with
// a world (x, y) — robot poses, defect locations, the surveillance alert — can
// be dropped on here and it lands in the same frame the robots use.
export function MapView({
  markers = [],
  clickMode = false,
  onMapClick,
  pendingPin,
  plans = {},
}: Props) {
  function handleFrameClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!clickMode || !onMapClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * MAP_META.width;
    const py = ((e.clientY - rect.top) / rect.height) * MAP_META.height;
    onMapClick(pixelToWorld({ x: px, y: py }));
  }

  const planEntries = Object.entries(plans).filter(([, path]) => path.length >= 2);

  return (
    <section className="panel map">
      <header className="panel__header">
        <h2>Facility Map</h2>
        <span className="pill pill--idle">
          {MAP_META.resolution} m/px · origin [{MAP_META.origin[0]}, {MAP_META.origin[1]}]
        </span>
        {clickMode && (
          <span className="pill pill--active">
            {pendingPin ? "Click again to set heading" : "Click to set target"}
          </span>
        )}
      </header>

      <div className="map__stage">
        <div
          className={`map__frame${clickMode ? " map__frame--clickmode" : ""}`}
          style={{ aspectRatio: `${MAP_META.width} / ${MAP_META.height}` }}
          onClick={handleFrameClick}
        >
          <img className="map__img" src={MAP_META.image} alt="Facility occupancy map" />

          {planEntries.length > 0 && (
            <svg
              className="map__plan-overlay"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {planEntries.map(([robotId, path]) => {
                const pts = path
                  .map((pt) => {
                    const p = worldToPercent(pt);
                    return `${p.x},${p.y}`;
                  })
                  .join(" ");
                return (
                  <polyline
                    key={robotId}
                    points={pts}
                    fill="none"
                    stroke={PLAN_COLORS[robotId] ?? DEFAULT_PLAN_COLOR}
                    strokeWidth="0.8"
                    strokeOpacity="0.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
            </svg>
          )}

          <div className="map__overlay">
            {markers.map((m) => {
              const p = worldToPercent(m.world);
              const kind = m.kind ?? "robot";
              return (
                <div
                  key={m.id}
                  className={`marker marker--${kind}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  title={`${m.label ?? m.id} (${m.world.x.toFixed(2)}, ${m.world.y.toFixed(2)})`}
                >
                  {kind === "home" ? (
                    <svg
                      className="marker__home-icon"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 1L1 7h2v7h4v-4h2v4h4V7h2L8 1z" />
                    </svg>
                  ) : (
                    <span className="marker__dot" />
                  )}
                  {m.label && <span className="marker__label">{m.label}</span>}
                </div>
              );
            })}
            {pendingPin && (() => {
              const p = worldToPercent(pendingPin);
              return (
                <div
                  className="marker marker--pending"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  title={`Target: (${pendingPin.x.toFixed(2)}, ${pendingPin.y.toFixed(2)}) — click again to set heading`}
                >
                  <span className="marker__dot" />
                  <span className="marker__label">→ heading</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {markers.length === 0 && !pendingPin && (
        <p className="muted">
          No positioned entities yet. Robot poses and defect locations will appear here once they
          carry world coordinates.
        </p>
      )}
    </section>
  );
}
