import { useState } from "react";
import { detectionPhotoUrl } from "../api";
import type { DetectionSummary, SurveillanceAlert, WorkflowStage } from "../types";
import { stageToPhase } from "../workflow";

interface Props {
  alert: SurveillanceAlert;
  stage: WorkflowStage;
  /** Latest crack capture from the surveillance dog, if one exists. */
  detection?: DetectionSummary | null;
  /** Local placeholder shown when no surveillance capture arrives in time. */
  fallbackPhotoSrc?: string;
}

// What the surveillance dog saw. Stays visible for the whole workflow so the
// operator never loses the originating context — including the crack photo.
export function SurveillancePanel({ alert, stage, detection, fallbackPhotoSrc }: Props) {
  const hasAlert = Boolean(alert && (alert.anomaly_type || alert.source_robot || alert.tank_location));
  const active = stageToPhase(stage) === "surveillance";
  const photoSrc = detection?.reportId ? detectionPhotoUrl(detection.reportId) : fallbackPhotoSrc;

  return (
    <section className={`panel ${active ? "panel--active" : ""}`}>
      <header className="panel__header">
        <h2>Surveillance</h2>
        <span className={`pill ${hasAlert ? "pill--alert" : "pill--idle"}`}>
          {hasAlert ? "Alert raised" : "Monitoring"}
        </span>
      </header>

      {hasAlert ? (
        <div className="surveillance__body">
          {photoSrc && (
            <figure className="surveillance__photo">
              <DetectionImage
                key={photoSrc}
                src={photoSrc}
                alt="Crack capture from surveillance dog"
              />
              {detection && (
                <figcaption className="surveillance__caption">
                  {captionFor(detection)}
                </figcaption>
              )}
            </figure>
          )}

          <dl className="surveillance__meta">
            <div>
              <dt>Anomaly</dt>
              <dd>{alert.anomaly_type ?? "—"}</dd>
            </div>
            <div>
              <dt>Detected by</dt>
              <dd>{alert.source_robot ?? "—"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{alert.tank_location ?? "—"}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="muted">Surveillance dog on patrol. No anomalies reported.</p>
      )}
    </section>
  );
}

function DetectionImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="surveillance__photo-fallback">
        <span className="muted">Image unavailable</span>
      </div>
    );
  }
  return (
    <img
      className="surveillance__img"
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}

function captionFor(d: DetectionSummary): string {
  const who = d.robotId ?? "dog";
  const conf = confidencePct(d.confidence);
  const when = formatTime(d.timestamp);
  const parts = [`Captured by ${who}`];
  if (conf) parts.push(conf);
  if (when) parts.push(when);
  return parts.join(" · ");
}

function confidencePct(confidence?: string | null): string {
  if (confidence == null) return "";
  const value = Number(confidence);
  if (Number.isNaN(value)) return "";
  return `${Math.round(value * 100)}% conf`;
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString();
}
