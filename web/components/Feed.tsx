"use client";

import { useMemo, useState } from "react";
import type { Story } from "@/lib/data";
import { StoryCard } from "./StoryCard";

interface Filter {
  label: string;
  match: (s: Story) => boolean;
}

const FINANCE = new Set(["economy", "markets", "business", "property"]);
const au = (s: Story) => s.region === "australia";

const PRESETS: Record<"top" | "finance", Filter[]> = {
  top: [
    { label: "All", match: () => true },
    { label: "Australia", match: au },
    { label: "World", match: (s) => s.region === "global" },
    { label: "Money", match: (s) => FINANCE.has(s.category) },
    { label: "Politics", match: (s) => s.category === "politics" },
    { label: "Tech", match: (s) => s.category === "tech" },
    { label: "Health & Science", match: (s) => s.category === "health" || s.category === "science" },
    { label: "Sport", match: (s) => s.category === "sport" },
    { label: "Entertainment", match: (s) => s.category === "entertainment" || s.category === "lifestyle" },
  ],
  finance: [
    { label: "All", match: () => true },
    { label: "Australia", match: au },
    { label: "Global", match: (s) => !au(s) },
    { label: "Economy", match: (s) => s.category === "economy" },
    { label: "Markets", match: (s) => s.category === "markets" },
    { label: "Companies & Deals", match: (s) => s.category === "business" },
    { label: "Property", match: (s) => s.category === "property" },
  ],
};

/**
 * Inshorts-style feed. On phones each story fills the screen and snaps as you
 * scroll; on larger screens it's a two-column grid.
 */
export function Feed({ stories, preset }: { stories: Story[]; preset: keyof typeof PRESETS }) {
  const filters = PRESETS[preset];
  const [active, setActive] = useState(0);
  const visible = useMemo(() => stories.filter(filters[active].match), [stories, filters, active]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-14 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
          {filters.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setActive(i)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                i === active
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mx-auto max-w-5xl px-4 py-16 text-center text-zinc-500">No stories here yet. Check back soon.</p>
      ) : (
        <div className="h-[calc(100dvh-7.25rem)] snap-y snap-mandatory overflow-y-auto md:h-auto md:snap-none md:overflow-visible">
          <div className="mx-auto max-w-5xl md:grid md:grid-cols-2 md:gap-5 md:px-4 md:py-6">
            {visible.map((s) => (
              <div key={s.id} className="h-[calc(100dvh-7.25rem)] snap-start border-b border-zinc-200 dark:border-zinc-800 md:h-auto md:border-0">
                <StoryCard story={s} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
