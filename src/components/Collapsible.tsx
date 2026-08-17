import { useCallback, useState, type ReactNode } from "react";

// Collapse state for a side-panel section. Panels start expanded.
export function useCollapsible(defaultOpen = true): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  return [collapsed, toggle];
}

interface Props {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Header class so this works over both .panel__header and .fleetstrip__head. */
  className?: string;
  /** Status content (e.g. a pill) kept visible even while collapsed. */
  children?: ReactNode;
}

// Clickable panel header with a rotating chevron. The title + status stay
// visible when collapsed; only the panel body hides.
export function CollapsibleHeader({
  title,
  collapsed,
  onToggle,
  className = "panel__header",
  children,
}: Props) {
  return (
    <header
      className={`${className} collapsible__header${collapsed ? " collapsible__header--collapsed" : ""}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={!collapsed}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="collapsible__title">
        <span
          className={`collapsible__chevron${collapsed ? "" : " collapsible__chevron--open"}`}
          aria-hidden="true"
        >
          ▶
        </span>
        <h2>{title}</h2>
      </div>
      {children}
    </header>
  );
}
