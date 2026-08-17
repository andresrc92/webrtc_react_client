import type { TimelineEvent } from "../types";

interface Props {
  events: TimelineEvent[];
}

// Pose ticks move map markers but aren't story beats — keep them out of the strip.
const HIDDEN_EVENT_TYPES = new Set(["position_update"]);

// Full-width horizontal activity strip for the hybrid layout. Oldest → newest,
// left to right, so the eye follows the story across the bottom of the console.
export function HybridTimeline({ events }: Props) {
  const visible = events.filter((e) => !HIDDEN_EVENT_TYPES.has(e.type));

  return (
    <section className="htimeline">
      <div className="htimeline__head">
        <h2>Activity Timeline</h2>
        <span className="muted">{visible.length} events</span>
      </div>

      {visible.length === 0 ? (
        <p className="muted">No activity yet.</p>
      ) : (
        <ol className="htimeline__track">
          {visible.map((e, i) => (
            <li key={i} className="htimeline__item">
              <time className="htimeline__time">{formatTime(e.timestamp)}</time>
              <span className="htimeline__dot" />
              <span className="htimeline__type">{e.type.replace(/_/g, " ")}</span>
              <span className={`htimeline__actor actor--${e.actor}`}>{e.actor}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleTimeString();
}
