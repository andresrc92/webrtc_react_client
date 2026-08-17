import type { DefectFinding, RobotStatus, WorkflowStage } from "../types";
import { stageToPhase } from "../workflow";

interface Props {
  robotStatus?: RobotStatus;
  defects: DefectFinding[];
  stage: WorkflowStage;
}

// Right column: the inspection mission. Robot status + mission progress +
// defects streaming in as the robot discovers them.
export function InspectionPanel({ robotStatus, defects, stage }: Props) {
  const phase = stageToPhase(stage);
  const active = phase === "inspection" || phase === "dispatch";
  const progress = clampPercent(robotStatus?.progress ?? 0);
  const statusLabel = robotStatus?.status ?? (active ? "working" : "standby");

  return (
    <section className={`panel ${active ? "panel--active" : ""}`}>
      <header className="panel__header">
        <h2>Inspection Mission</h2>
        <span className={`pill ${active ? "pill--active" : "pill--idle"}`}>
          {prettyStatus(statusLabel)}
        </span>
      </header>

      <div className="progress">
        <div className="progress__track">
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress__value">{progress}%</span>
      </div>

      <h3 className="subhead">
        Defect findings
        {defects.length > 0 && <span className="count">{defects.length}</span>}
      </h3>

      {defects.length === 0 ? (
        <p className="muted">
          {active ? "Scanning… findings will appear here as they surface." : "No findings yet."}
        </p>
      ) : (
        <ul className="defects">
          {defects.map((d, i) => (
            <li key={d.id ?? i} className={`defect defect--${d.severity ?? "unknown"}`}>
              <div className="defect__head">
                <span className="defect__type">{d.type}</span>
                {d.severity && <span className="defect__sev">{d.severity}</span>}
              </div>
              <span className="defect__loc">{d.location}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, " ");
}
