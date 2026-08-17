import type {
  CombinedReport,
  DefectFinding,
  DetectionSummary,
  DetectionsListResponse,
  FleetRobot,
  RobotsListResponse,
  WorkflowInstance,
  WorkflowsListResponse,
} from "./types";

// In dev, Vite proxies /api and /robots -> http://127.0.0.1:8000 (see vite.config.ts).
// In other setups, override with VITE_API_BASE at build time.
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export const WORKFLOW_TYPE = "oil_tank_crack";

const WORKFLOWS_URL = `${API_BASE}/api/workflows`;
const ROBOTS_URL = `${API_BASE}/robots`;
const DETECTIONS_URL = `${API_BASE}/detections`;

export type SurveillanceAction = "start" | "cancel" | "go_to_pose";
export type MockWeldingAction = "dispatch" | "fix" | "complete";

// Detection reports (e.g. intruders spotted by the dog). Defaults to the
// "person" type so the intruder panel only shows intrusion captures.
export async function listDetections(
  type = "person",
  signal?: AbortSignal,
): Promise<DetectionSummary[]> {
  const res = await fetch(`${DETECTIONS_URL}?type=${encodeURIComponent(type)}`, { signal });
  if (!res.ok) throw new Error(`list detections ${res.status}`);
  const body = (await res.json()) as DetectionsListResponse;
  return body.detections ?? [];
}

// Absolute URL for the captured JPEG the backend streams from S3.
export function detectionPhotoUrl(reportId: string): string {
  return `${DETECTIONS_URL}/${encodeURIComponent(reportId)}/photo`;
}

export async function listRobots(signal?: AbortSignal): Promise<FleetRobot[]> {
  const res = await fetch(ROBOTS_URL, { signal });
  if (!res.ok) throw new Error(`list robots ${res.status}`);
  const body = (await res.json()) as RobotsListResponse;
  return body.robots ?? [];
}

export async function commandSurveillance(
  robotId: string,
  action: SurveillanceAction,
  pose?: { x: number; y: number; theta: number },
): Promise<void> {
  const body: Record<string, unknown> = { action };
  if (pose !== undefined) body.pose = pose;
  const res = await fetch(`${ROBOTS_URL}/${encodeURIComponent(robotId)}/surveillance/cmd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`surveillance ${action} -> ${res.status}`);
}

export async function listWorkflows(
  type: string = WORKFLOW_TYPE,
  signal?: AbortSignal,
): Promise<WorkflowInstance[]> {
  const res = await fetch(`${WORKFLOWS_URL}?type=${encodeURIComponent(type)}`, { signal });
  if (!res.ok) throw new Error(`list workflows ${res.status}`);
  const body = (await res.json()) as WorkflowsListResponse;
  return body.workflows ?? [];
}

export async function getWorkflow(id: string, signal?: AbortSignal): Promise<WorkflowInstance> {
  const res = await fetch(`${WORKFLOWS_URL}/${id}`, { signal });
  if (!res.ok) throw new Error(`get workflow ${res.status}`);
  return (await res.json()) as WorkflowInstance;
}

export async function createWorkflow(
  type: string = WORKFLOW_TYPE,
  payload: Record<string, unknown> = {},
): Promise<WorkflowInstance> {
  const res = await fetch(WORKFLOWS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  });
  if (!res.ok) throw new Error(`create workflow ${res.status}`);
  return (await res.json()) as WorkflowInstance;
}

export async function postSignal(
  id: string,
  signal: string,
  payload: Record<string, unknown> = {},
  actor = "operator",
): Promise<WorkflowInstance> {
  const res = await fetch(`${WORKFLOWS_URL}/${id}/signals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signal, actor, payload }),
  });
  if (!res.ok) throw new Error(`signal ${signal} -> ${res.status}`);
  return (await res.json()) as WorkflowInstance;
}

// Trigger welding flow steps (real composite robot when sim_events is up):
// dispatch -> before photo, fix -> navigate_and_weld, complete -> final stage.
export async function triggerWeldingAction(
  workflowId: string,
  action: MockWeldingAction,
): Promise<void> {
  const res = await fetch(`${WORKFLOWS_URL}/${encodeURIComponent(workflowId)}/welding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`welding ${action} -> ${res.status}`);
}

// While a close-inspection approval is pending, the operator may request
// another review image. This deliberately uses the bundled fallback still
// instead of waiting on the robot camera.
export async function requestFallbackWelderPhoto(workflowId: string): Promise<void> {
  const image = await fetch("/patrol_fallback.jpg");
  if (!image.ok) throw new Error(`load fallback photo -> ${image.status}`);

  const photo = await blobAsBase64(await image.blob());
  const res = await fetch(`${WORKFLOWS_URL}/${encodeURIComponent(workflowId)}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "before",
      photo,
      actor: "operator",
      metadata: { source: "operator_fallback_reinspection", capture_id: crypto.randomUUID() },
    }),
  });
  if (!res.ok) throw new Error(`fallback welder photo -> ${res.status}`);
}

/**
 * Demo crack on Tank_6 @ 90° (+Y rim), map frame.
 * Must match frost_bringup wp_2 face_target / intruder_reporter_bridge
 * `_CRACK_MAP_XY` / defect_detector fallback — not the dog's stand pose.
 */
export const DEMO_CRACK_MAP_LOCATION = { x: 78.0, y: 32.2, theta: 0 } as const;

/** Post the canned crack still as a real /detections event (Slack/SMS/email). */
export async function postFallbackCrackDetection(opts: {
  robotId: string;
  location?: { x?: number; y?: number; theta?: number } | null;
}): Promise<{ reportId: string; notifiedForge: boolean; skipped: boolean }> {
  const image = await fetch("/patrol_fallback.jpg");
  if (!image.ok) throw new Error(`load fallback photo -> ${image.status}`);
  const photo = await blobAsBase64(await image.blob());
  const location = opts.location ?? DEMO_CRACK_MAP_LOCATION;
  const res = await fetch(DETECTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      robotId: opts.robotId,
      detectionType: "crack",
      tankId: "Tank_6",
      tankLocation: "Tank_6",
      // Must be a patrol-policy crack type (see forge policies/crack_weld_repair.rego).
      anomalyType: "crack",
      confidence: 1.0,
      photo,
      location: {
        x: location.x ?? DEMO_CRACK_MAP_LOCATION.x,
        y: location.y ?? DEMO_CRACK_MAP_LOCATION.y,
        theta: location.theta ?? DEMO_CRACK_MAP_LOCATION.theta,
      },
      source: "operator_console_fallback",
    }),
  });
  if (!res.ok) throw new Error(`fallback crack detection -> ${res.status}`);
  return (await res.json()) as {
    reportId: string;
    notifiedForge: boolean;
    skipped: boolean;
  };
}

function blobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read fallback photo"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("read fallback photo"));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** @deprecated Use triggerWeldingAction */
export async function triggerMockWeldingAction(
  workflowId: string,
  action: MockWeldingAction,
): Promise<void> {
  return triggerWeldingAction(workflowId, action);
}

// Return the most recently created oil_tank_crack workflow. When none exist,
// optionally create one (createIfEmpty) — otherwise return null. Polling calls
// this every tick so the console auto-follows the newest workflow (e.g. one
// spawned by the sim driver) instead of staying pinned to the first it saw.
export async function fetchLatestWorkflow(
  createIfEmpty: boolean,
  signal?: AbortSignal,
): Promise<WorkflowInstance | null> {
  const workflows = await listWorkflows(WORKFLOW_TYPE, signal);
  if (workflows.length === 0) {
    return createIfEmpty ? await createWorkflow() : null;
  }
  return [...workflows].sort((a, b) => createdMs(b) - createdMs(a))[0];
}

function createdMs(w: WorkflowInstance): number {
  const t = Date.parse(w.createdAt);
  return Number.isNaN(t) ? 0 : t;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "n/a";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function severityRank(severity?: string): number {
  switch (severity) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

// Scripted/templated recommendation (per ticket: keep it templated for C2).
function buildRecommendation(tankId: string, defects: DefectFinding[]): string {
  if (defects.length === 0) {
    return `No actionable defects found on ${tankId}. No maintenance required at this time.`;
  }
  const primary = [...defects].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  return `Schedule maintenance for ${primary.type} on ${tankId} ${primary.location}.`;
}

// Built client-side from the workflow instance. There is no oil_tank_crack
// report endpoint on the backend yet (the existing /reports/{id} is the fleet
// sweep report), so the UI assembles the combined report itself.
export function buildReportFromWorkflow(workflow: WorkflowInstance): CombinedReport {
  const data = workflow.data ?? {};
  const alert = data.alert ?? {};
  const defects = data.inspection_defects ?? [];
  const summary = data.inspection_summary ?? {};
  const tankId = summary.tank_id ?? alert.tank_location ?? "unknown tank";

  const detectionEvent = workflow.timeline?.find(
    (e) => e.type === "created" || e.type === "crack_detected",
  );

  return {
    generated_at: new Date().toISOString(),
    surveillance: {
      event_type: alert.anomaly_type ?? "anomaly",
      detected_at: alert.detected_at ?? detectionEvent?.timestamp ?? workflow.createdAt ?? "unknown",
      detected_by: alert.source_robot ?? "surveillance dog",
      tank_location: alert.tank_location ?? "unknown",
    },
    inspection: {
      tank_id: tankId,
      duration: formatDuration(summary.duration_seconds),
      defects,
    },
    recommendation: buildRecommendation(tankId, defects),
  };
}
