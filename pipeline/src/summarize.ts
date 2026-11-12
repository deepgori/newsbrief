import { z } from "zod";
import { generateJson, type Usage } from "./llm.js";
import { CATEGORIES, REGIONS, type RawArticle } from "./types.js";

const StoryOut = z.object({
  article_refs: z
    .array(z.string())
    .describe("Refs (like 'a3') of every input article that reports this story."),
  existing_story_id: z
    .string()
    .nullable()
    .describe("If this is a story already listed under EXISTING STORIES, its id. Otherwise null."),
  headline: z.string(),
  summary: z.string(),
  category: z.enum(CATEGORIES),
  region: z.enum(REGIONS),
  importance: z.number().int().describe("1-10, see rubric."),
});

const BatchOut = z.object({
  stories: z.array(StoryOut),
  discarded_refs: z.array(z.string()).describe("Refs of items that are not news (see rules)."),
});

export type StoryDraft = Omit<z.infer<typeof StoryOut>, "article_refs"> & { articles: RawArticle[] };

const SYSTEM = `You are the news editor of a short-news service (60-word summaries, like Inshorts) for Australian readers. It has a strong finance and economics section, and also covers major general news from Australia and the world.

You receive raw RSS items (headline + short lede) from Australian and global publishers. Turn them into stories.

Rules:
1. Group items about the same underlying event or development into ONE story, even across publishers and even when the angle differs. A scandal, the share-price reaction to it, and analysis or opinion pieces about it are all ONE story.
2. Check EXISTING STORIES first. If an item is about a story already listed there, output it with existing_story_id set to that story's id (headline/summary will be ignored, keep them short). When in doubt, merge rather than create a near-duplicate.
3. Put an item in discarded_refs if it is not news: podcasts, videos-only pages, quizzes, puzzles, crosswords, horoscopes, recipes, shopping/deals, sponsored content, newsletter promos, live-blog shells with no substance, TV guides.
4. Every input ref must appear exactly once: in one story's article_refs, or in discarded_refs.

For each new story:
- headline: at most 12 words, plain and factual, no clickbait, no publisher name.
- summary: 40-60 words, neutral, Inshorts style, Australian English spelling. State the news directly; never name the publishers or write "reports say". Use ONLY facts stated in the items. Never add numbers, names, dates or background that the items don't give. If the items say little, write a shorter summary instead of padding.
- category: exactly one of these lowercase values: economy (macro data, RBA and central banks, inflation, jobs, budgets, tax), markets (ASX and share markets, bonds, currencies, commodities, crypto), business (companies, earnings, deals, M&A, executives, startups), property (housing, auctions, rents, commercial property), politics, world, tech, health, science, sport, entertainment, lifestyle, other.
- region: "australia" if it is mainly about Australia, Australian companies, markets or people; otherwise "global".
- importance (1-10) for an Australian reader who cares most about money, markets and the economy, then big national and world news:
  9-10: market-moving or nationally significant (RBA rate decision, CPI or jobs data, big ASX or Wall Street move, federal budget, major war escalation).
  6-8: notable economic data, major company results or deals, significant policy or political news, major world events.
  3-5: routine company news, general interest, state-level news.
  1-2: trivial, very local, celebrity or soft news.`;

/**
 * Models (gpt-oss especially) emit typographic spaces and hyphens, e.g.
 * "$33 billion", "pre‑election". Some mail clients render them badly;
 * normalise to plain characters. Curly quotes and dashes are left alone.
 */
export function plainText(s: string): string {
  return s
    .replace(/[  -   ]/g, " ") // no-break / thin / narrow spaces
    .replace(/[‐‑]/g, "-") // (non-breaking) hyphens
    .replace(/[​-‍⁠﻿]/g, "") // zero-width characters
    .replace(/ {2,}/g, " ")
    .trim();
}

function renderBatch(batch: RawArticle[], existing: { id: string; headline: string }[]) {
  const existingBlock = existing.length
    ? existing.map((s) => `${s.id} | ${s.headline}`).join("\n")
    : "(none)";
  const items = batch
    .map((a, i) => `[a${i}] (${a.source}) ${a.title}\n${a.description || "(no lede)"}`)
    .join("\n\n");
  return `EXISTING STORIES (published in the last 48 hours):\n${existingBlock}\n\nNEW ITEMS:\n\n${items}`;
}

/**
 * Summarise one batch of articles. If the response can't be parsed (e.g. it
 * hit max_tokens), split the batch in half and retry each half once.
 */
export async function summarizeBatch(
  batch: RawArticle[],
  existing: { id: string; headline: string }[],
  usage: Usage,
  depth = 0,
): Promise<{ drafts: StoryDraft[]; handled: Set<string> }> {
  const result = await generateJson(BatchOut, SYSTEM, renderBatch(batch, existing), usage);

  if (!result.ok && result.reason === "refusal") {
    console.warn(`  ! batch of ${batch.length} declined (${result.detail}); skipping`);
    return { drafts: [], handled: new Set(batch.map((a) => a.id)) };
  }

  if (!result.ok) {
    if (depth < 1 && batch.length > 1) {
      console.warn(`  ! unparseable output (${result.detail}); splitting batch`);
      const mid = Math.ceil(batch.length / 2);
      const [a, b] = [
        await summarizeBatch(batch.slice(0, mid), existing, usage, depth + 1),
        await summarizeBatch(batch.slice(mid), existing, usage, depth + 1),
      ];
      return { drafts: [...a.drafts, ...b.drafts], handled: new Set([...a.handled, ...b.handled]) };
    }
    throw new Error(`Could not parse summariser output (${result.detail})`);
  }
  const parsed = result.data;

  const refToArticle = (ref: string) => batch[Number(ref.replace(/^a/, ""))];
  const handled = new Set<string>();
  const drafts: StoryDraft[] = [];

  for (const ref of parsed.discarded_refs) {
    const a = refToArticle(ref);
    if (a) handled.add(a.id);
  }
  for (const { article_refs, ...rest } of parsed.stories) {
    const articles = article_refs.map(refToArticle).filter((a): a is RawArticle => !!a && !handled.has(a.id));
    if (!articles.length) continue;
    articles.forEach((a) => handled.add(a.id));
    drafts.push({
      ...rest,
      headline: plainText(rest.headline),
      summary: plainText(rest.summary),
      importance: Math.min(10, Math.max(1, rest.importance)),
      articles,
    });
  }

  const missed = batch.length - handled.size;
  if (missed > 0) console.warn(`  ! ${missed} item(s) not accounted for by the model; will retry next run`);
  return { drafts, handled };
}

// ------------------------------------------------------- duplicate pass ----

const DuplicateGroups = z.object({
  groups: z
    .array(z.array(z.string()))
    .describe("Each group lists the ids of stories that report the same news. Only groups of 2 or more."),
});

const DEDUPE_SYSTEM = `You are a news editor removing duplicate stories from a news feed.

You get a list of recent story headlines with ids. Several stories may describe the same underlying news development, written by different batches or publishers. Return groups of ids that should be merged into one story.

Same story: the same event or development, even from different angles. Reports of one event often differ slightly in numbers, place names or emphasis because they were written at different times. Examples of ONE story:
- "Nvidia board weighs ousting CEO" / "Nvidia shares plunge as board eyes CEO change"
- "NAB to repay $170 million after payroll error" / "NAB admits $169m underpayment to staff"
- "Building collapse in Brooklyn kills two" / "New York building collapse kills one, injures ten"
Different stories: separate events that merely involve the same company, person or topic, such as a company's earnings and its CEO scandal.

Most stories have no duplicate; leave those out.`;

/** One request over all recent headlines; returns groups of story ids to merge. */
export async function findDuplicateGroups(
  stories: { id: string; headline: string }[],
  usage: Usage,
): Promise<string[][]> {
  if (stories.length < 2) return [];
  const list = stories.map((s) => `${s.id} | ${s.headline}`).join("\n");
  const result = await generateJson(DuplicateGroups, DEDUPE_SYSTEM, `STORIES:\n${list}`, usage, "medium");
  if (!result.ok) {
    console.warn(`  ! duplicate pass skipped (${result.detail})`);
    return [];
  }
  const known = new Set(stories.map((s) => s.id));
  const used = new Set<string>();
  return result.data.groups
    .map((g) => [...new Set(g)].filter((id) => known.has(id) && !used.has(id)))
    .filter((g) => g.length >= 2)
    .map((g) => (g.forEach((id) => used.add(id)), g));
}
