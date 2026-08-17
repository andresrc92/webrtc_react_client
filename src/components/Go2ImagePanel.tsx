import { useState } from "react";
import { detectionPhotoUrl } from "../api";
import { useDetectionsFeed } from "../usePolling";
import { CollapsibleHeader, useCollapsible } from "./Collapsible";

interface Props {
  /** Optional detection type filter ("person" / "crack"). Omit to show any. */
  type?: string;
}

// The latest image reported by the Go2 surveillance dog. Polls the detections
// feed on the frost backend (:8000) and shows the most recent capture, served
// as a JPEG from GET /detections/{id}/photo. By default it shows the newest
// capture of ANY type — the dog reports "person" (intruder) and "crack"
// (defect) detections, so filtering to one type would leave the panel blank
// (and "not updating") whenever the other type is what's actually happening.
export function Go2ImagePanel({ type }: Props) {
  const { detections, connected } = useDetectionsFeed(type, 1000);
  const [collapsed, toggle] = useCollapsible();

  const latest = [...detections].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))[0];
  const photoSrc = latest?.reportId ? detectionPhotoUrl(latest.reportId) : null;

  return (
    <section className="panel">
      <CollapsibleHeader title="Go2 Camera" collapsed={collapsed} onToggle={toggle}>
        <span className={`pill ${latest ? "pill--alert" : connected ? "pill--active" : ""}`}>
          {latest ? "Capture" : connected ? "Monitoring" : "Offline"}
        </span>
      </CollapsibleHeader>

      {!collapsed &&
        (photoSrc ? (
          <figure className="go2img">
            <Go2Image key={photoSrc} src={photoSrc} alt="Latest capture from surveillance dog" />
            <figcaption className="go2img__caption">{captionFor(latest)}</figcaption>
          </figure>
        ) : (
          <p className="muted">No captures reported yet. Images appear here as the dog reports them.</p>
        ))}
    </section>
  );
}

function Go2Image({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="go2img__fallback">
        <span className="muted">Image unavailable</span>
      </div>
    );
  }
  return <img className="go2img__img" src={src} alt={alt} onError={() => setFailed(true)} />;
}

function captionFor(d: {
  robotId?: string | null;
  detectionType?: string;
  confidence?: string | null;
  timestamp?: number;
}): string {
  const who = d.robotId ?? "dog";
  const parts = [d.detectionType ? `${d.detectionType} · ${who}` : `Captured by ${who}`];
  const conf = confidencePct(d.confidence);
  if (conf) parts.push(conf);
  const when = d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : "";
  if (when) parts.push(when);
  return parts.join(" · ");
}

function confidencePct(confidence?: string | null): string {
  if (confidence == null) return "";
  const value = Number(confidence);
  if (Number.isNaN(value)) return "";
  return `${Math.round(value * 100)}% conf`;
}
