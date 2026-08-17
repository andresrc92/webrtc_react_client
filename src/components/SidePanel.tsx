import { useCallback, useState } from "react";
import { commandSurveillance, type SurveillanceAction } from "../api";
import { useRobotsFeed } from "../usePolling";
import type { FleetRobot } from "../types";
import { MapView, type MapMarker } from "./MapView";
import { FleetStrip } from "./FleetStrip";
import { Go2ImagePanel } from "./Go2ImagePanel";
import { CameraControls } from "./CameraControls";

// Live robot poses -> map markers, in the same world frame the fleet uses.
function fleetMarkers(robots: FleetRobot[]): MapMarker[] {
  return robots
    .filter((r) => r.position && r.position.x != null && r.position.y != null)
    .map((r) => ({
      id: r.robotId,
      world: { x: r.position!.x, y: r.position!.y },
      label: r.robotId,
      kind: "robot" as const,
    }));
}

// Right-hand operator rail: map overlay + Go2 fleet cards + latest Go2 camera
// capture (all from the frost backend :8000) and the sim camera controls (:8227).
export function SidePanel() {
  const { robots } = useRobotsFeed(1000);
  const [busyRobot, setBusyRobot] = useState<string | null>(null);

  const runSurveillance = useCallback(async (robotId: string, action: SurveillanceAction) => {
    setBusyRobot(robotId);
    try {
      await commandSurveillance(robotId, action);
    } catch {
      // Surface nothing here; the fleet feed reflects the resulting state.
    } finally {
      setBusyRobot(null);
    }
  }, []);

  return (
    <aside className="side-panel">
      <MapView markers={fleetMarkers(robots)} />
      <FleetStrip robots={robots} busyRobot={busyRobot} onCommand={runSurveillance} />
      <Go2ImagePanel />
      <CameraControls />
    </aside>
  );
}
