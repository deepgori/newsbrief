/**
 * Daily 8am (Sydney) email digest.
 *
 * GitHub Actions cron is UTC and Sydney has daylight saving, so the workflow
 * fires at both 21:00 and 22:00 UTC. This script only sends when it's 8am or
 * later in Sydney AND today's digest hasn't been recorded in data/digests/.
 *
 *   npm run digest                 # send if due
 *   npm run digest -- --force      # send now regardless of time / already-sent
 *   npm run digest -- --dry-run    # write a preview HTML file, send nothing
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { renderHtml, renderText, type Section } from "./email-template.js";
import { digestExists, loadStories, saveDigest } from "./store.js";
import { sydneyLongDate, sydneyNow } from "./time.js";
import type { Category, Region, Story } from "./types.js";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const DRY_RUN = args.has("--dry-run");
const SEND_HOUR = 8;

interface SectionSpec {
  title: string;
  regions: Region[];
  categories: Category[];
  limit: number;
  minImportance: number;
}

// Order = order in the email. A story appears in the first section it matches.
const SECTIONS: SectionSpec[] = [
  { title: "Australian Economy & Markets", regions: ["australia"], categories: ["economy", "markets"], limit: 8, minImportance: 4 },
  { title: "Australian Companies & Deals", regions: ["australia"], categories: ["business"], limit: 7, minImportance: 4 },
  { title: "Property", regions: ["australia"], categories: ["property"], limit: 5, minImportance: 4 },
  { title: "Global Economy & Markets", regions: ["global"], categories: ["economy", "markets", "business", "property"], limit: 8, minImportance: 5 },
  { title: "Other Top Headlines", regions: ["australia", "global"], categories: ["politics", "world", "tech", "health", "science", "other"], limit: 5, minImportance: 7 },
];

const rank = (a: Story, b: Story) =>
  b.importance - a.importance || b.sources.length - a.sources.length || b.publishedAt.localeCompare(a.publishedAt);

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

async function main() {
  const { date, hour } = sydneyNow();
  if (!FORCE && !DRY_RUN) {
    if (hour < SEND_HOUR) return console.log(`Not yet ${SEND_HOUR}am in Sydney (hour=${hour}); skipping.`);
    if (digestExists(date)) return console.log(`Digest for ${date} already sent; skipping.`);
  }

  const sections = buildSections(loadStories());
  const count = sections.reduce((n, s) => n + s.stories.length, 0);
  if (!count) throw new Error("No stories from the last 24 hours; has ingest been running?");

  const dateLabel = sydneyLongDate();
  const html = renderHtml(dateLabel, sections, process.env.SITE_URL);
  const text = renderText(dateLabel, sections);

  if (DRY_RUN) {
    const out = fileURLToPath(new URL("../out/digest-preview.html", import.meta.url));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    return console.log(`Dry run: ${count} stories in ${sections.length} sections. Preview: ${out}`);
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const recipients = (process.env.DIGEST_RECIPIENTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!user || !pass || !recipients.length) {
    throw new Error("Set GMAIL_USER, GMAIL_APP_PASSWORD and DIGEST_RECIPIENTS to send the digest.");
  }

  const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  await transport.sendMail({
    from: `"Morning Briefing" <${user}>`,
    to: user,
    bcc: recipients, // recipients don't see each other
    subject: `Morning Briefing: ${dateLabel}`,
    html,
    text,
  });

  saveDigest({
    date,
    sentAt: new Date().toISOString(),
    recipients: recipients.length,
    sections: sections.map((s) => ({ title: s.title, storyIds: s.stories.map((x) => x.id) })),
  });
  console.log(`Sent digest for ${date}: ${count} stories to ${recipients.length} recipient(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
