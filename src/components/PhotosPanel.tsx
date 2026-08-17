import { useState } from "react";
import type { WorkflowStage } from "../types";
import { stageToPhase } from "../workflow";

interface Photos {
  before_url: string | null;
  after_url: string | null;
}

interface Props {
  photos?: Photos;
  stage: WorkflowStage;
  workflowId?: string;
}

// Welding robot's work photos: the "before" shot the operator reviews to approve
// the repair, and the "after" shot once welding completes.
export function PhotosPanel({ photos, stage, workflowId }: Props) {
  const before = publicPhotoUrl(photos?.before_url ?? null, workflowId, "before");
  const after = publicPhotoUrl(photos?.after_url ?? null, workflowId, "after");
  const phase = stageToPhase(stage);
  const active = phase === "inspection";
  const hasAny = Boolean(before || after);

  return (
    <section className={`panel ${active ? "panel--active" : ""}`}>
      <header className="panel__header">
        <h2>Welding Robot Photos</h2>
        <span className={`pill ${hasAny ? "pill--active" : "pill--idle"}`}>
          {hasAny ? "Captured" : "Awaiting"}
        </span>
      </header>

      <div className="photos">
        <PhotoSlot key={`before-${before}`} label="Before" url={before} />
        <PhotoSlot key={`after-${after}`} label="After" url={after} />
      </div>
    </section>
  );
}

function PhotoSlot({ label, url }: { label: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  const showImage = isRenderable(url) && !failed;

  return (
    <figure className="photo">
      <span className="photo__label">{label}</span>
      {showImage ? (
        <img
          className="photo__img"
          src={url!}
          alt={`${label} welding photo`}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="photo__placeholder">
          {url ? (
            <>
              <span>{failed ? "Image unavailable" : "Placeholder"}</span>
              <code>{url}</code>
            </>
          ) : (
            <span className="muted">Not captured yet</span>
          )}
        </div>
      )}
    </figure>
  );
}

// The backend currently emits placeholder://... URLs, which a browser can't load.
// Only render an <img> for schemes the browser can actually fetch.
function isRenderable(url: string | null): boolean {
  if (!url) return false;
  return /^(https?:|data:|blob:|\/)/.test(url);
}

// Older workflows stored moto S3 URLs (:5000) that browsers can't fetch (403).
// Prefer the stable FastAPI photo route when we know the workflow id.
function publicPhotoUrl(
  url: string | null,
  workflowId: string | undefined,
  kind: "before" | "after",
): string | null {
  if (!url) return null;
  if (workflowId && (/:5000\//.test(url) || /iac-maps\/workflow-photos\//.test(url))) {
    return `/api/workflows/${encodeURIComponent(workflowId)}/photos/${kind}`;
  }
  return url;
}
