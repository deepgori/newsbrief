import type { Section } from "./email-template.js";
import type { Category, Region, Story } from "./types.js";

interface SectionSpec {
  title: string;
  regions: Region[];
  categories: Category[];
  limit: number;
  minImportance: number;
}

// Order = order in the email. A story appears in the first section it matches.
export const SECTIONS: SectionSpec[] = [
  { title: "Australian Economy & Markets", regions: ["australia"], categories: ["economy", "markets"], limit: 8, minImportance: 4 },
  { title: "Australian Companies & Deals", regions: ["australia"], categories: ["business"], limit: 7, minImportance: 4 },
  { title: "Property", regions: ["australia"], categories: ["property"], limit: 5, minImportance: 4 },
  { title: "Global Economy & Markets", regions: ["global"], categories: ["economy", "markets", "business", "property"], limit: 8, minImportance: 5 },
  { title: "Other Top Headlines", regions: ["australia", "global"], categories: ["politics", "world", "tech", "health", "science", "other"], limit: 5, minImportance: 7 },
];

const rank = (a: Story, b: Story) =>
  b.importance - a.importance || b.sources.length - a.sources.length || b.publishedAt.localeCompare(a.publishedAt);

/** Pick the digest's stories from the last 24 hours, section by section. */
export function buildSections(stories: Story[], now = Date.now()): Section[] {
  const cutoff = now - 24 * 3600_000;
  const pool = stories.filter((s) => new Date(s.publishedAt).getTime() >= cutoff).sort(rank);
  const used = new Set<string>();
  return SECTIONS.map((spec) => {
    const picked = pool
      .filter(
        (s) =>
          !used.has(s.id) &&
          spec.regions.includes(s.region) &&
          spec.categories.includes(s.category) &&
          s.importance >= spec.minImportance,
      )
      .slice(0, spec.limit);
    picked.forEach((s) => used.add(s.id));
    return { title: spec.title, stories: picked };
  }).filter((s) => s.stories.length > 0);
}
