import { useCallback, useState } from "react";
import { commandSurveillance, type SurveillanceAction } from "../api";
import { useRobotsFeed, usePlansFeed } from "../usePolling";
import type { FleetRobot } from "../types";
import { MapView, type MapMarker } from "./MapView";
import { FleetStrip } from "./FleetStrip";
import { Go2ImagePanel } from "./Go2ImagePanel";
import { CameraControls } from "./CameraControls";
import { homeMarkers } from "../map/homeMarkers";
import type { WorldPoint } from "../map/mapMeta";

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
  const [goalPoses, setGoalPoses] = useState<Record<string, { x: number; y: number }>>({});
  const [aimingRobotId, setAimingRobotId] = useState<string | null>(null);
  const [pendingGoalClick, setPendingGoalClick] = useState<{ robotId: string; world: WorldPoint } | null>(
    null,
  );

  const dogRobotIds = robots.filter((r) => r.robotType !== "welding_robot").map((r) => r.robotId);
  const { plans } = usePlansFeed(dogRobotIds, 500);

  const runSurveillance = useCallback(
    async (robotId: string, action: SurveillanceAction, pose?: { x: number; y: number; theta: number }) => {
      setBusyRobot(robotId);
      try {
        await commandSurveillance(robotId, action, pose);
        if (action === "cancel") {
          setGoalPoses((prev) => {
            const next = { ...prev };
            delete next[robotId];
            return next;
          });
        }
        if (action === "go_to_pose" && pose) {
          setGoalPoses((prev) => ({ ...prev, [robotId]: { x: pose.x, y: pose.y } }));
        }
      } catch {
        // Surface nothing here; the fleet feed reflects the resulting state.
      } finally {
        setBusyRobot(null);
      }
    },
    [],
  );

  function handleAimToggle(robotId: string) {
    if (aimingRobotId === robotId) {
      setAimingRobotId(null);
      setPendingGoalClick(null);
    } else {
      setAimingRobotId(robotId);
      setPendingGoalClick(null);
    }
  }

  // Click-to-aim: first click drops a pending pin, second click sets heading
  // from the drag direction and fires the go_to_pose command.
  function handleMapClick(world: WorldPoint) {
    if (!aimingRobotId) return;
    if (!pendingGoalClick) {
      setPendingGoalClick({ robotId: aimingRobotId, world });
    } else {
      const dx = world.x - pendingGoalClick.world.x;
      const dy = world.y - pendingGoalClick.world.y;
      const theta = Math.round(Math.atan2(dy, dx) * (180 / Math.PI));
      void runSurveillance(pendingGoalClick.robotId, "go_to_pose", {
        x: pendingGoalClick.world.x,
        y: pendingGoalClick.world.y,
        theta,
      });
      setAimingRobotId(null);
      setPendingGoalClick(null);
    }
  }

  const markers: MapMarker[] = [
    ...homeMarkers(),
    ...fleetMarkers(robots),
    ...Object.entries(goalPoses).map(([robotId, pos]) => ({
      id: `goal-${robotId}`,
      world: pos,
      label: `${robotId} goal`,
      kind: "goal" as const,
    })),
  ];

  return (
    <aside className="side-panel">
      <MapView
        markers={markers}
        clickMode={!!aimingRobotId}
        onMapClick={handleMapClick}
        pendingPin={pendingGoalClick?.world ?? null}
        plans={plans}
      />
      <FleetStrip
        robots={robots}
        busyRobot={busyRobot}
        onCommand={runSurveillance}
        aimingRobotId={aimingRobotId}
        onAimToggle={handleAimToggle}
      />
      <Go2ImagePanel />
      <CameraControls />
    </aside>
  );
}
