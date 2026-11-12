import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DigestRecord, Story } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR ?? path.resolve(here, "../../data");

const STORIES_FILE = path.join(DATA_DIR, "stories.json");
const SEEN_FILE = path.join(DATA_DIR, "seen.json");
const DIGEST_DIR = path.join(DATA_DIR, "digests");

/** How long stories and seen-article ids are kept. */
const RETENTION_DAYS = 7;

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 1) + "\n");
}

const retentionCutoff = () => Date.now() - RETENTION_DAYS * 86400_000;

export const loadStories = () => readJson<Story[]>(STORIES_FILE, []);

export function saveStories(stories: Story[]) {
  const cutoff = retentionCutoff();
  const kept = stories
    .filter((s) => new Date(s.publishedAt).getTime() >= cutoff)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  writeJson(STORIES_FILE, kept);
  return kept.length;
}

/** Article id -> ISO time first seen. */
export const loadSeen = () => readJson<Record<string, string>>(SEEN_FILE, {});

export function saveSeen(seen: Record<string, string>) {
  const cutoff = retentionCutoff();
  const kept = Object.fromEntries(
    Object.entries(seen).filter(([, t]) => new Date(t).getTime() >= cutoff),
  );
  writeJson(SEEN_FILE, kept);
}

const digestFile = (date: string) => path.join(DIGEST_DIR, `${date}.json`);

export const digestExists = (date: string) => fs.existsSync(digestFile(date));

export function saveDigest(record: DigestRecord) {
  writeJson(digestFile(record.date), record);
}
