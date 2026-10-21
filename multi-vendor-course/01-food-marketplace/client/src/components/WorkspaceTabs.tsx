import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";

export function WorkspaceTabs({
  items
}: {
  items: { to: string; label: string; end?: boolean }[];
}) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-ink/10 pb-px"
      aria-label="Workspace sections"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition",
              isActive
                ? "border-leaf text-forest"
                : "border-transparent text-ink/55 hover:text-ink"
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
