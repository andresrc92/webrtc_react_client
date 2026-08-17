import { useState } from "react";
import type { FleetRobot } from "../types";
import type { SurveillanceAction } from "../api";
import { Go2Icon } from "./Go2Icon";

interface PoseInput {
  x: string;
  y: string;
  theta: string;
}

// Default home = sim spawn position for each robot.
const DEFAULT_HOME: Record<string, PoseInput> = {
  go2_a: { x: "-40", y: "-15", theta: "0" },
  go2_b: { x: "43", y: "27", theta: "180" },
};

interface Props {
  robots: FleetRobot[];
  busyRobot: string | null;
  onCommand: (robotId: string, action: SurveillanceAction, pose?: { x: number; y: number; theta: number }) => void;
}

// Horizontal fleet strip under the map: Go2 dogs + welding robot when present.
export function FleetStrip({ robots, busyRobot, onCommand }: Props) {
  const ordered = [...robots].sort((a, b) => a.robotId.localeCompare(b.robotId));
  const [poseInputs, setPoseInputs] = useState<Record<string, PoseInput>>({});
  const [homeInputs, setHomeInputs] = useState<Record<string, PoseInput>>({});

  function getPose(robotId: string): PoseInput {
    return poseInputs[robotId] ?? { x: "", y: "", theta: "" };
  }

  function setPose(robotId: string, field: keyof PoseInput, value: string) {
    setPoseInputs((prev) => ({
      ...prev,
      [robotId]: { ...getPose(robotId), ...prev[robotId], [field]: value },
    }));
  }

  function getHome(robotId: string): PoseInput {
    return homeInputs[robotId] ?? DEFAULT_HOME[robotId] ?? { x: "0", y: "0", theta: "0" };
  }

  function setHome(robotId: string, field: keyof PoseInput, value: string) {
    setHomeInputs((prev) => ({
      ...prev,
      [robotId]: { ...getHome(robotId), ...prev[robotId], [field]: value },
    }));
  }

  function handleGoToPose(robotId: string) {
    const p = getPose(robotId);
    const x = parseFloat(p.x);
    const y = parseFloat(p.y);
    const theta = parseFloat(p.theta || "0");
    if (isNaN(x) || isNaN(y)) return;
    onCommand(robotId, "go_to_pose", { x, y, theta });
  }

  function handleGoHome(robotId: string) {
    const h = getHome(robotId);
    const x = parseFloat(h.x);
    const y = parseFloat(h.y);
    const theta = parseFloat(h.theta || "0");
    if (isNaN(x) || isNaN(y)) return;
    onCommand(robotId, "go_to_pose", { x, y, theta });
  }

  return (
    <section className="fleetstrip">
      <div className="fleetstrip__head">
        <h2>Inspection Fleet</h2>
        <span className={`pill ${ordered.length > 0 ? "pill--active" : "pill--idle"}`}>
          {ordered.length} online
        </span>
      </div>

      {ordered.length === 0 ? (
        <p className="muted">No robots reporting yet. They appear once they send a heartbeat.</p>
      ) : (
        <div className="fleetstrip__cards">
          {ordered.map((robot) => {
            const busy = busyRobot === robot.robotId;
            const active = isActive(robot.status);
            const isWelder = robot.robotType === "welding_robot";
            return (
              <article key={robot.robotId} className="fleetcard">
                <Go2Icon className="fleetcard__icon" />
                <div className="fleetcard__body">
                  <span className="fleetcard__id">{robot.robotId}</span>
                  <span className="fleetcard__status">
                    <span className={`dot ${active ? "dot--ok" : "dot--idle"}`} />
                    {prettyStatus(robot.status)}
                    {isWelder ? " · welder" : ""}
                  </span>
                  <span className="fleetcard__pose">{formatPosition(robot.position)}</span>
                  {!isWelder && (
                    <>
                      <div className="fleetcard__actions">
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => onCommand(robot.robotId, "start")}
                          disabled={busy}
                        >
                          Start
                        </button>
                        <button
                          className="btn btn--sm"
                          onClick={() => onCommand(robot.robotId, "cancel")}
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="fleetcard__goto">
                        <input
                          className="fleetcard__pose-input"
                          type="number"
                          placeholder="x"
                          value={getPose(robot.robotId).x}
                          onChange={(e) => setPose(robot.robotId, "x", e.target.value)}
                          step="0.1"
                        />
                        <input
                          className="fleetcard__pose-input"
                          type="number"
                          placeholder="y"
                          value={getPose(robot.robotId).y}
                          onChange={(e) => setPose(robot.robotId, "y", e.target.value)}
                          step="0.1"
                        />
                        <input
                          className="fleetcard__pose-input"
                          type="number"
                          placeholder="θ°"
                          value={getPose(robot.robotId).theta}
                          onChange={(e) => setPose(robot.robotId, "theta", e.target.value)}
                          step="5"
                        />
                        <button
                          className="btn btn--sm"
                          onClick={() => handleGoToPose(robot.robotId)}
                          disabled={busy || !getPose(robot.robotId).x || !getPose(robot.robotId).y}
                        >
                          Go
                        </button>
                      </div>
                      <div className="fleetcard__goto">
                        <input
                          className="fleetcard__pose-input"
                          type="number"
                          placeholder="x"
                          value={getHome(robot.robotId).x}
                          onChange={(e) => setHome(robot.robotId, "x", e.target.value)}
                          step="0.1"
                        />
                        <input
                          className="fleetcard__pose-input"
                          type="number"
                          placeholder="y"
                          value={getHome(robot.robotId).y}
                          onChange={(e) => setHome(robot.robotId, "y", e.target.value)}
                          step="0.1"
                        />
                        <input
                          className="fleetcard__pose-input"
                          type="number"
                          placeholder="θ°"
                          value={getHome(robot.robotId).theta}
                          onChange={(e) => setHome(robot.robotId, "theta", e.target.value)}
                          step="5"
                        />
                        <button
                          className="btn btn--sm"
                          onClick={() => handleGoHome(robot.robotId)}
                          disabled={busy}
                        >
                          Home
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function isActive(status?: string): boolean {
  const s = (status ?? "").toLowerCase();
  return s.includes("mission") || s.includes("route") || s.includes("active") || s.includes("inspect") || s.includes("weld");
}

function prettyStatus(status?: string): string {
  return (status ?? "unknown").replace(/_/g, " ");
}

function formatPosition(position?: FleetRobot["position"]): string {
  if (!position || position.x == null || position.y == null) return "no pose";
  return `(${position.x.toFixed(1)}, ${position.y.toFixed(1)})`;
}
