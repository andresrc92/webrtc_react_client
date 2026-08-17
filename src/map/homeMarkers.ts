import type { MapMarker } from "../components/MapView";

// Map-frame spawn positions for each Go2 (matches initial_pose in multi_robot_nav.launch.py).
export const HOME_POSITIONS: Record<string, { x: number; y: number }> = {
  go2_a: { x: 0, y: 0 },
  go2_b: { x: 83, y: 42 },
};

export function homeMarkers(): MapMarker[] {
  return Object.entries(HOME_POSITIONS).map(([robotId, pos]) => ({
    id: `home-${robotId}`,
    world: pos,
    label: robotId,
    kind: "home" as const,
  }));
}
