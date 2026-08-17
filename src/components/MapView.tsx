import { MAP_META, worldToPercent, type WorldPoint } from "../map/mapMeta";

export type MarkerKind = "robot" | "defect" | "alert" | "goal";

export interface MapMarker {
  id: string;
  world: WorldPoint;
  label?: string;
  kind?: MarkerKind;
}

interface Props {
  markers?: MapMarker[];
}

// Renders the shared facility map with world-coordinate overlays. Anything with
// a world (x, y) — robot poses, defect locations, the surveillance alert — can
// be dropped on here and it lands in the same frame the robots use.
export function MapView({ markers = [] }: Props) {
  return (
    <section className="panel map">
      <header className="panel__header">
        <h2>Facility Map</h2>
        <span className="pill pill--idle">
          {MAP_META.resolution} m/px · origin [{MAP_META.origin[0]}, {MAP_META.origin[1]}]
        </span>
      </header>

      <div className="map__stage">
        <div
          className="map__frame"
          style={{ aspectRatio: `${MAP_META.width} / ${MAP_META.height}` }}
        >
          <img className="map__img" src={MAP_META.image} alt="Facility occupancy map" />
          <div className="map__overlay">
            {markers.map((m) => {
              const p = worldToPercent(m.world);
              return (
                <div
                  key={m.id}
                  className={`marker marker--${m.kind ?? "robot"}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  title={`${m.label ?? m.id} (${m.world.x.toFixed(2)}, ${m.world.y.toFixed(2)})`}
                >
                  <span className="marker__dot" />
                  {m.label && <span className="marker__label">{m.label}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {markers.length === 0 && (
        <p className="muted">
          No positioned entities yet. Robot poses and defect locations will appear here once they
          carry world coordinates.
        </p>
      )}
    </section>
  );
}
