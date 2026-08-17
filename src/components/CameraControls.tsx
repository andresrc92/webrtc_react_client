import { useState } from "react";
import {
  CAMERA_TARGETS,
  cameraBack,
  focusPrim,
  followPrim,
  stopFollow,
  topView,
} from "../cameraApi";
import { CollapsibleHeader, useCollapsible } from "./Collapsible";

// Camera control buttons that drive the sim viewport via sim_events_server.py
// (:8227). Mirrors the server's built-in panel: focus/follow on the Go2 dogs,
// welder and crack, plus top-down and undo.
export function CameraControls() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, toggle] = useCollapsible();

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "camera command failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <CollapsibleHeader title="Camera Control" collapsed={collapsed} onToggle={toggle}>
        <span className={`pill ${error ? "pill--alert" : "pill--active"}`}>
          {error ? "Error" : "Sim :8227"}
        </span>
      </CollapsibleHeader>

      {!collapsed && (
      <div className="camctl">
        <span className="camctl__group-label">Focus</span>
        <div className="camctl__row">
          <button className="btn btn--sm" disabled={busy} onClick={() => run(() => focusPrim(CAMERA_TARGETS.go2a.primPath, CAMERA_TARGETS.go2a.distance))}>
            Go2 A
          </button>
          <button className="btn btn--sm" disabled={busy} onClick={() => run(() => focusPrim(CAMERA_TARGETS.go2b.primPath, CAMERA_TARGETS.go2b.distance))}>
            Go2 B
          </button>
          <button className="btn btn--sm" disabled={busy} onClick={() => run(() => focusPrim(CAMERA_TARGETS.welder.primPath, CAMERA_TARGETS.welder.distance))}>
            Welder
          </button>
          <button className="btn btn--sm" disabled={busy} onClick={() => run(() => focusPrim(CAMERA_TARGETS.crack.primPath, CAMERA_TARGETS.crack.distance))}>
            Crack
          </button>
        </div>

        <span className="camctl__group-label">Follow</span>
        <div className="camctl__row">
          <button className="btn btn--sm" disabled={busy} onClick={() => run(() => followPrim(CAMERA_TARGETS.go2a.primPath))}>
            Go2 A
          </button>
          <button className="btn btn--sm" disabled={busy} onClick={() => run(() => followPrim(CAMERA_TARGETS.go2b.primPath))}>
            Go2 B
          </button>
          <button className="btn btn--sm" disabled={busy} onClick={() => run(stopFollow)}>
            Stop
          </button>
        </div>

        <span className="camctl__group-label">View</span>
        <div className="camctl__row">
          <button className="btn btn--sm" disabled={busy} onClick={() => run(topView)}>
            Top Down
          </button>
          <button className="btn btn--sm" disabled={busy} onClick={() => run(cameraBack)}>
            Back
          </button>
        </div>
      </div>
      )}

      {!collapsed && error && <p className="muted camctl__error">{error}</p>}
    </section>
  );
}
