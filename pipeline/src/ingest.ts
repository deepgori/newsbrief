/**
 * Fetch all feeds -> drop articles we've already processed -> have the LLM
 * group, categorise, rank and summarise the new ones -> merge into
 * data/stories.json. Safe to run as often as you like; only new articles cost
 * tokens.
 */
import { fetchAllFeeds, sha1 } from "./fetch.js";
import { BATCH_SIZE, FatalLLMError, MODEL, PROVIDER, type Usage } from "./llm.js";
import { loadSeen, loadStories, saveSeen, saveStories } from "./store.js";
import { findDuplicateGroups, summarizeBatch } from "./summarize.js";
import type { Story } from "./types.js";

/** Upper bound on articles summarised per run, to cap cost/quota (first run, outages). */
const MAX_PER_RUN = Number(process.env.MAX_ARTICLES_PER_RUN || (PROVIDER === "groq" ? 250 : 400));
/** Recent headlines sent with each batch for cross-run dedupe (costs input tokens). */
const EXISTING_CONTEXT = PROVIDER === "groq" ? 80 : 200;

async function main() {
  const startedAt = new Date().toISOString();
  const seen = loadSeen();
  const stories = loadStories();
  const byId = new Map(stories.map((s) => [s.id, s]));

  console.log("Fetching feeds…");
  const all = await fetchAllFeeds();
  const fresh = all
    .filter((a) => !seen[a.id])
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  console.log(`  ${all.length} articles in feeds, ${fresh.length} new`);
  if (!fresh.length) return;

  const toProcess = fresh.slice(0, MAX_PER_RUN);
  // Anything over the cap is the oldest; mark it seen so it doesn't pile up.
  for (const a of fresh.slice(MAX_PER_RUN)) seen[a.id] = startedAt;

  // Headlines the model can match new articles against (cross-run dedupe).
  const recentCutoff = Date.now() - 48 * 3600_000;
  const existing = stories
    .filter((s) => new Date(s.publishedAt).getTime() >= recentCutoff)
    .slice(0, EXISTING_CONTEXT)
    .map((s) => ({ id: s.id, headline: s.headline }));

  const usage: Usage = { input: 0, output: 0 };
  let created = 0;
  let merged = 0;
  let fatal: Error | undefined;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    console.log(`Summarising ${i + 1}-${i + batch.length} of ${toProcess.length} with ${PROVIDER}/${MODEL}…`);
    let result;
    try {
      result = await summarizeBatch(batch, existing, usage);
    } catch (err) {
      // Bad key or exhausted quota: stop, but keep what's done so far.
      if (err instanceof FatalLLMError) {
        fatal = err;
        break;
      }
      console.error(`  ! batch failed, will retry next run: ${String(err).slice(0, 200)}`);
      continue;
    }

    for (const d of result.drafts) {
      // One link per publisher: the first (newest) article we saw from them.
      const sources: Story["sources"] = [];
      for (const a of d.articles) {
        if (!sources.some((x) => x.name === a.source)) sources.push({ name: a.source, url: a.url });
      }
      const target = d.existing_story_id ? byId.get(d.existing_story_id) : undefined;
      if (target) {
        for (const s of sources) {
          if (!target.sources.some((x) => x.name === s.name)) target.sources.push(s);
        }
        target.imageUrl ??= d.articles.find((a) => a.imageUrl)?.imageUrl;
        merged++;
        continue;
      }
      const story: Story = {
        id: sha1(d.articles[0].id + d.headline),
        headline: d.headline,
        summary: d.summary,
        category: d.category,
        region: d.region,
        importance: d.importance,
        sources,
        imageUrl: d.articles.find((a) => a.imageUrl)?.imageUrl,
        publishedAt: d.articles.map((a) => a.publishedAt).sort()[0],
        createdAt: startedAt,
      };
      byId.set(story.id, story);
      existing.unshift({ id: story.id, headline: story.headline });
      if (existing.length > EXISTING_CONTEXT) existing.pop();
      created++;
    }
    for (const id of result.handled) seen[id] = startedAt;
  }

  // Batches only see each other through the headline list, so near-duplicates
  // slip through. One pass over all recent headlines catches them.
  let deduped = 0;
  if (created > 0 && !fatal) {
    const recent = [...byId.values()]
      .filter((s) => new Date(s.publishedAt).getTime() >= recentCutoff)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 150);
    try {
      for (const group of await findDuplicateGroups(recent, usage)) {
        deduped += mergeGroup(group.map((id) => byId.get(id)!), byId);
      }
    } catch (err) {
      if (err instanceof FatalLLMError) fatal = err;
      else console.warn(`  ! duplicate pass failed: ${String(err).slice(0, 200)}`);
    }
  }

  const total = saveStories([...byId.values()]);
  saveSeen(seen);
  console.log(
    `Done: ${created} new stories, ${merged} merged into existing, ${deduped} duplicates folded; ${total} stories stored. ` +
      `Tokens: ${usage.input} in / ${usage.output} out.`,
  );
  if (fatal) {
    console.error(`Stopped early: ${fatal.message}. Remaining articles will be picked up next run.`);
    process.exitCode = 1;
  }
}

/**
 * Fold duplicate stories into the one with the most sources (ties: the
 * earliest created, so ids already linked from a sent digest tend to survive).
 * Returns how many stories were removed.
 */
function mergeGroup(group: Story[], byId: Map<string, Story>): number {
  const [keep, ...rest] = [...group].sort(
    (a, b) => b.sources.length - a.sources.length || a.createdAt.localeCompare(b.createdAt),
  );
  for (const dup of rest) {
    for (const s of dup.sources) {
      if (!keep.sources.some((x) => x.name === s.name)) keep.sources.push(s);
    }
    keep.importance = Math.max(keep.importance, dup.importance);
    if (dup.publishedAt < keep.publishedAt) keep.publishedAt = dup.publishedAt;
    keep.imageUrl ??= dup.imageUrl;
    byId.delete(dup.id);
  }
  return rest.length;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
