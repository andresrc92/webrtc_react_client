// Shape of the data the operator console consumes.
//
// The backend now exposes a generic workflow API: each workflow is an instance
// with an id, a top-level `stage`, a domain-specific `data` blob, and a
// `timeline`. We model that raw shape (WorkflowInstance) and read the
// oil_tank_crack fields out of `data`.
//
// Fields under "INSPECTION (proposed)" are what this UI expects once the
// inspection phase lands in the oil_tank_crack workflow definition. They're
// optional so the UI renders cleanly today and lights up as the backend grows.
// These are the fields to confirm with backend/sim (Andres).

export interface TimelineEvent {
  timestamp: string;
  actor: string;
  type: string;
  details: Record<string, unknown>;
}

// World coordinates in the shared map frame (meters), per public/map/map.yaml.
export interface WorldPosition {
  x: number;
  y: number;
  theta?: number;
}

// A robot as returned by the fleet endpoint GET /robots.
export interface FleetRobot {
  robotId: string;
  status?: string;
  mapId?: string;
  robotType?: string;
  position?: WorldPosition | null;
  lastSeen?: number;
  /** Set by FROST after Start so post-idle crack frames still ingest. */
  crackArmed?: boolean;
}

export interface RobotsListResponse {
  robots: FleetRobot[];
}

export interface SurveillanceAlert {
  source_robot?: string;
  tank_location?: string;
  anomaly_type?: string;
  detected_at?: string;
  position?: WorldPosition;
}

export interface RobotStatus {
  status: string;
  progress: number;
  position?: WorldPosition;
}

// One defect the inspection robot reports as it surveys the tank.
export interface DefectFinding {
  id?: string;
  type: string;
  location: string;
  severity?: "low" | "medium" | "high" | string;
  timestamp?: string;
  position?: WorldPosition;
}

export interface InspectionSummary {
  tank_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
}

export type WorkflowStage =
  | "crack_detected"
  | "dispatched"
  | "en_route"
  | "inspecting"
  | "waiting_approval"
  | "welding"
  | "completed"
  | string;

// Domain data for the oil_tank_crack workflow, stored under instance.data.
export interface OilTankCrackData {
  // EXISTING (live today)
  alert?: SurveillanceAlert;
  welding_robot_status?: RobotStatus;
  approval?: string;
  photos?: { before_url: string | null; after_url: string | null };

  // INSPECTION (proposed — optional until backend adds them)
  inspection_robot_status?: RobotStatus;
  inspection_defects?: DefectFinding[];
  inspection_summary?: InspectionSummary;
}

// Raw workflow instance as returned by GET /api/workflows/{id}.
export interface WorkflowInstance {
  workflowId: string;
  type: string;
  stage: WorkflowStage;
  data: OilTankCrackData;
  timeline: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowsListResponse {
  count: number;
  workflows: WorkflowInstance[];
}

// A detection report surfaced by GET /detections (e.g. intruder/person photos
// captured by the surveillance dog). The image is served at photoUrl.
export interface DetectionSummary {
  reportId: string;
  detectionType: string;
  workflowId?: string | null;
  robotId?: string | null;
  summary?: string;
  location?: WorldPosition | null;
  confidence?: string | null;
  timestamp?: number;
  photoUrl: string;
}

export interface DetectionsListResponse {
  count: number;
  detections: DetectionSummary[];
}

// Combined end-of-workflow report (3 sections per the ticket).
export interface CombinedReport {
  generated_at: string;
  surveillance: {
    event_type: string;
    detected_at: string;
    detected_by: string;
    tank_location: string;
  };
  inspection: {
    tank_id: string;
    duration: string;
    defects: DefectFinding[];
  };
  recommendation: string;
}
