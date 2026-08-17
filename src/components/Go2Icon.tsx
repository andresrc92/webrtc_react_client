interface Props {
  className?: string;
}

// Stylized Unitree Go2 quadruped silhouette: low body, sensor head, four
// articulated legs. Purely decorative — used in the fleet strip so surveillance
// dogs read as dogs at a glance.
export function Go2Icon({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* body */}
      <rect x="14" y="14" width="30" height="12" rx="4" fill="currentColor" fillOpacity="0.18" />
      {/* head + sensor */}
      <path d="M44 16 L54 12 L54 22 L44 24 Z" fill="currentColor" fillOpacity="0.28" stroke="none" />
      <line x1="52" y1="10" x2="52" y2="5" />
      <circle cx="52" cy="4" r="1.6" fill="currentColor" stroke="none" />
      {/* front legs */}
      <path d="M40 26 L42 34 L38 40" />
      <path d="M33 26 L33 35 L29 40" />
      {/* rear legs */}
      <path d="M22 26 L20 35 L24 40" />
      <path d="M16 26 L14 34 L18 40" />
    </svg>
  );
}
