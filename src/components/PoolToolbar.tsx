import * as React from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * PoolToolbar — search + role filters for the player drawer.
 *
 * A React island (client:load) built on shadcn/ui primitives. It owns no
 * game state: every change dispatches a `bm11:pool-filter` CustomEvent that
 * the page's vanilla draft script listens to, and it clears itself on
 * `bm11:pool-filter-reset` (new spin / start over). Filtering is UI-only —
 * eligibility and the draft model are untouched.
 */
const ROLE_FILTERS = [
  "All",
  "Openers",
  "Middle Order",
  "Wicketkeeper",
  "All-Rounders",
  "Spinners",
  "Fast Bowlers",
] as const;

export default function PoolToolbar() {
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState<string>("All");
  const timer = React.useRef<number | null>(null);

  const emit = React.useCallback((nq: string, nrole: string) => {
    window.dispatchEvent(
      new CustomEvent("bm11:pool-filter", { detail: { q: nq, role: nrole } })
    );
  }, []);

  React.useEffect(() => {
    const onReset = () => {
      setQ("");
      setRole("All");
    };
    window.addEventListener("bm11:pool-filter-reset", onReset);
    return () =>
      window.removeEventListener("bm11:pool-filter-reset", onReset);
  }, []);

  const onSearch = (v: string) => {
    setQ(v);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => emit(v, role), 160);
  };

  const onRole = (r: string) => {
    setRole(r);
    emit(q, r);
  };

  const clearSearch = () => {
    setQ("");
    emit("", role);
  };

  return (
    <div className="bm11-toolbar">
      <div className="bm11-toolbar-search">
        <Search className="bm11-toolbar-icon" aria-hidden="true" />
        <Input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search players…"
          aria-label="Search players in this draw"
          className="bm11-toolbar-input"
        />
        {q ? (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="bm11-toolbar-clear"
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div
        className="bm11-toolbar-filters"
        role="group"
        aria-label="Filter players by role"
      >
        {ROLE_FILTERS.map((r) => (
          <Button
            key={r}
            type="button"
            variant={role === r ? "default" : "outline"}
            size="sm"
            onClick={() => onRole(r)}
            aria-pressed={role === r}
            className={cn(
              "bm11-toolbar-chip",
              role === r && "bm11-toolbar-chip--active"
            )}
          >
            {r}
          </Button>
        ))}
      </div>
    </div>
  );
}
