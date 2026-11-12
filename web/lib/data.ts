import fs from "node:fs";
import path from "node:path";

// Mirrors pipeline/src/types.ts; keep the two in sync.
export type Category =
  | "economy" | "markets" | "business" | "property" | "politics" | "world" | "tech"
  | "health" | "science" | "sport" | "entertainment" | "lifestyle" | "other";
export type Region = "australia" | "global";

export interface Story {
  id: string;
  headline: string;
  summary: string;
  category: Category;
  region: Region;
  importance: number;
  sources: { name: string; url: string }[];
  imageUrl?: string;
  publishedAt: string;
  createdAt: string;
}

export interface DigestRecord {
  date: string;
  sentAt: string;
  recipients: number;
  sections: { title: string; storyIds: string[] }[];
}

export const FINANCE_CATEGORIES: Category[] = ["economy", "markets", "business", "property"];

/** When this build ran; the site is rebuilt after every pipeline update, so this is "last updated". */
// Set once in next.config.ts so every page (built in parallel workers) and
// /version.json share exactly the same value.
export const BUILT_AT = process.env.NEXT_PUBLIC_BUILT_AT ?? new Date(0).toISOString();

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), "../data");

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Ranking for "top" feeds: importance, decayed by age (computed at build). */
function score(s: Story, now: number) {
  const hours = (now - new Date(s.publishedAt).getTime()) / 3600_000;
  return s.importance - hours / 6 + Math.min(s.sources.length - 1, 3) * 0.5;
}

/** Stories from the last `hours`, best first. */
export function getStories({ hours = 72, limit = 400 } = {}): Story[] {
  const now = Date.now();
  const cutoff = now - hours * 3600_000;
  return readJson<Story[]>("stories.json", [])
    .filter((s) => new Date(s.publishedAt).getTime() >= cutoff)
    .sort((a, b) => score(b, now) - score(a, now))
    .slice(0, limit);
}

export function getLatestDigest(): { record: DigestRecord; sections: { title: string; stories: Story[] }[] } | null {
  const dir = path.join(DATA_DIR, "digests");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return null;
  }
  const latest = files.at(-1);
  if (!latest) return null;
  const record = readJson<DigestRecord | null>(`digests/${latest}`, null);
  if (!record) return null;
  const byId = new Map(readJson<Story[]>("stories.json", []).map((s) => [s.id, s]));
  return {
    record,
    sections: record.sections
      .map((sec) => ({ title: sec.title, stories: sec.storyIds.map((id) => byId.get(id)).filter((s): s is Story => !!s) }))
      .filter((sec) => sec.stories.length > 0),
  };
}
