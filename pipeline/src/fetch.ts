import { createHash } from "node:crypto";
import Parser from "rss-parser";
import { FEEDS, type Feed } from "./feeds.js";
import type { RawArticle } from "./types.js";

type MediaAttr = { $?: { url?: string; medium?: string; type?: string } };
type ItemExtras = {
  mediaThumbnail?: MediaAttr;
  mediaContent?: MediaAttr[];
  dcDate?: string;
};

const USER_AGENT = "Mozilla/5.0 (compatible; AusNewsDigest/0.1)";
const FETCH_TIMEOUT_MS = 20_000;

// rss-parser is used only for XML parsing; its own HTTP client leaks sockets
// on redirects/timeouts, so we download with fetch() instead.
const parser = new Parser<Record<string, never>, ItemExtras>({
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent", { keepArray: true }],
      ["dc:date", "dcDate"],
    ],
  },
});

/** Only consider articles published within this window. */
const MAX_AGE_HOURS = 36;

export function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    // Feeds append tracking params (?ref=rss, ?at_medium=RSS, utm_*): drop the
    // whole query so the same article from two feeds gets the same id.
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

export const sha1 = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

function clean(text: string | undefined, max: number): string {
  if (!text) return "";
  const stripped = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > max ? stripped.slice(0, max).trimEnd() + "…" : stripped;
}

function pickImage(item: Parser.Item & ItemExtras): string | undefined {
  if (item.enclosure?.url && (item.enclosure.type ?? "image").startsWith("image")) {
    return item.enclosure.url;
  }
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  const media = item.mediaContent?.find((m) => m.$?.url && (m.$.medium ?? "image") === "image");
  return media?.$?.url;
}

async function fetchFeed(feed: Feed): Promise<RawArticle[]> {
  const res = await fetch(feed.url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = await parser.parseString(await res.text());
  const cutoff = Date.now() - MAX_AGE_HOURS * 3600_000;
  const out: RawArticle[] = [];
  for (const item of parsed.items) {
    if (!item.link || !item.title) continue;
    const dateStr = item.isoDate ?? item.pubDate ?? item.dcDate;
    const published = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(published.getTime()) || published.getTime() < cutoff) continue;
    const url = normaliseUrl(item.link);
    out.push({
      id: sha1(url),
      url,
      title: clean(item.title, 300),
      description: clean(item.contentSnippet ?? item.content ?? item.summary, 600),
      source: feed.source,
      publishedAt: published.toISOString(),
      imageUrl: pickImage(item),
    });
  }
  return out;
}

/** Fetch every feed; a broken feed is logged and skipped, never fatal. */
export async function fetchAllFeeds(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const byId = new Map<string, RawArticle>();
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.warn(`  ! feed failed: ${FEEDS[i].url}: ${String(r.reason).slice(0, 120)}`);
      return;
    }
    for (const a of r.value) if (!byId.has(a.id)) byId.set(a.id, a);
  });
  return [...byId.values()];
}
