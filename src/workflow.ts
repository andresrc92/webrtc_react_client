import type { WorkflowStage } from "./types";

// High-level operator phases. These collapse the finer-grained backend stages
// into the four chapters of the story the viewer should follow:
// surveillance -> dispatch -> inspection -> report.
export type Phase = "surveillance" | "dispatch" | "inspection" | "report";

export const PHASES: { id: Phase; label: string; blurb: string }[] = [
  { id: "surveillance", label: "Surveillance", blurb: "Dog patrol watching the tank farm" },
  { id: "dispatch", label: "Dispatch", blurb: "Inspection robot en route" },
  { id: "inspection", label: "Inspection", blurb: "Surveying tank for defects" },
  { id: "report", label: "Report", blurb: "Findings + recommendation" },
];

const STAGE_TO_PHASE: Record<string, Phase> = {
  idle: "surveillance",
  crack_detected: "surveillance",
  dispatched: "dispatch",
  en_route: "dispatch",
  inspecting: "inspection",
  waiting_approval: "inspection",
  welding: "inspection",
  completed: "report",
};

export function stageToPhase(stage: WorkflowStage): Phase {
  return STAGE_TO_PHASE[stage] ?? "surveillance";
}

export function phaseIndex(phase: Phase): number {
  return PHASES.findIndex((p) => p.id === phase);
}

// True once we've left pure surveillance — used to call out the handoff moment.
export function hasHandedOffToInspection(stage: WorkflowStage): boolean {
  return phaseIndex(stageToPhase(stage)) >= phaseIndex("dispatch");
}
