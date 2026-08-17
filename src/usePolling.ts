import { useCallback, useEffect, useRef, useState } from "react";
import { createWorkflow, fetchLatestWorkflow, listDetections, listRobots } from "./api";
import type { DetectionSummary, FleetRobot, WorkflowInstance } from "./types";

export interface WorkflowFeed {
  workflow: WorkflowInstance | null;
  connected: boolean;
  error: string | null;
  lastUpdated: number | null;
  startNew: () => Promise<void>;
}

// Resolves the active workflow instance (latest, or freshly created), then polls
// it on an interval. If a request fails we mark the console disconnected but keep
// the last good state on screen so the operator isn't staring at a blank panel.
export function useWorkflowFeed(intervalMs = 1000): WorkflowFeed {
  const [workflow, setWorkflow] = useState<WorkflowInstance | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const activeId = useRef<string | null>(null);
  const resolvedOnce = useRef(false);

  const startNew = useCallback(async () => {
    const created = await createWorkflow();
    activeId.current = created.workflowId;
    resolvedOnce.current = true;
    setWorkflow(created);
    setLastUpdated(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function tick() {
      try {
        // Re-resolve the latest workflow each tick so the console follows a
        // newly created one (e.g. from the sim driver). Only create one if the
        // backend is empty and we haven't resolved before, to avoid spawning a
        // new workflow on every poll.
        let next = await fetchLatestWorkflow(!resolvedOnce.current, controller.signal);
        // UX: on a fresh UI session, don't boot into an old completed run.
        // If the latest workflow is already completed, start a new one so the
        // operator sees a clean initial surveillance state.
        if (!resolvedOnce.current && next?.stage === "completed") {
          next = await createWorkflow();
        }
        if (cancelled) return;
        if (next) {
          resolvedOnce.current = true;
          activeId.current = next.workflowId;
          setWorkflow(next);
          setLastUpdated(Date.now());
        } else if (resolvedOnce.current) {
          // Backend was cleared (or all workflows deleted). Drop stale UI state
          // so we don't keep showing an old Step-3 / Fix screen.
          activeId.current = null;
          setWorkflow(null);
          setLastUpdated(Date.now());
        }
        setConnected(true);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setConnected(false);
        setError(err instanceof Error ? err.message : "unknown error");
      }
    }

    tick();
    const timer = window.setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return { workflow, connected, error, lastUpdated, startNew };
}

export interface RobotsFeed {
  robots: FleetRobot[];
  connected: boolean;
}

// Polls the fleet endpoint so the map and fleet controls reflect live robot
// state. Kept separate from the workflow feed because fleet state is global and
// exists even when no oil_tank_crack workflow is active.
export function useRobotsFeed(intervalMs = 1000): RobotsFeed {
  const [robots, setRobots] = useState<FleetRobot[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function tick() {
      try {
        const next = await listRobots(controller.signal);
        if (cancelled) return;
        setRobots(next);
        setConnected(true);
      } catch {
        if (cancelled) return;
        setConnected(false);
      }
    }

    tick();
    const timer = window.setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return { robots, connected };
}

export interface DetectionsFeed {
  detections: DetectionSummary[];
  connected: boolean;
}

// Polls the detections endpoint so intruder captures from the dog appear in the
// operator console as soon as they're reported. Independent of the workflow feed
// because intrusions are their own alert stream.
export function useDetectionsFeed(type = "person", intervalMs = 1000): DetectionsFeed {
  const [detections, setDetections] = useState<DetectionSummary[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function tick() {
      try {
        const next = await listDetections(type, controller.signal);
        if (cancelled) return;
        setDetections(next);
        setConnected(true);
      } catch {
        if (cancelled) return;
        setConnected(false);
      }
    }

    tick();
    const timer = window.setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [type, intervalMs]);

  return { detections, connected };
}
