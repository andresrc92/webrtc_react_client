import type { WorkflowStage } from "../types";

interface Props {
  stage: WorkflowStage;
}

// Five-chapter horizontal stepper for the hybrid layout. Unlike the default
// four-phase stepper, this splits inspection and repair so the welding step
// reads as its own chapter (matching the hybrid design). Display-only — it does
// not change the backend stage model.
const STEPS = [
  { id: "surveillance", label: "Surveillance" },
  { id: "dispatch", label: "Dispatch" },
  { id: "inspection", label: "Inspection" },
  { id: "repair", label: "Repair" },
  { id: "report", label: "Report" },
] as const;

const STAGE_TO_INDEX: Record<string, number> = {
  idle: 0,
  crack_detected: 0,
  dispatched: 1,
  en_route: 1,
  inspecting: 2,
  waiting_approval: 2,
  welding: 3,
  completed: 4,
};

function statusFor(index: number, current: number): "done" | "active" | "todo" {
  if (index < current) return "done";
  if (index === current) return "active";
  return "todo";
}

export function HybridStepper({ stage }: Props) {
  const current = STAGE_TO_INDEX[stage] ?? 0;

  return (
    <ol className="hstepper">
      {STEPS.map((step, idx) => {
        const status = statusFor(idx, current);
        return (
          <li key={step.id} className={`hstep hstep--${status}`}>
            <div className="hstep__node">
              <span className="hstep__marker">{status === "done" ? "✓" : idx + 1}</span>
              {idx < STEPS.length - 1 && <span className="hstep__line" />}
            </div>
            <div className="hstep__text">
              <span className="hstep__label">{step.label}</span>
              <span className="hstep__status">
                {status === "done" ? "Completed" : status === "active" ? "In progress" : "Pending"}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
