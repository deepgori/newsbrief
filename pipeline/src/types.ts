export const CATEGORIES = [
  "economy", // macro data, RBA/central banks, inflation, jobs, budgets, tax
  "markets", // ASX, equities, bonds, currencies, commodities, crypto
  "business", // companies, earnings, deals, M&A, management, startups
  "property", // housing market, auctions, rents, commercial property
  "politics",
  "world",
  "tech",
  "health",
  "science",
  "sport",
  "entertainment",
  "lifestyle",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const FINANCE_CATEGORIES: readonly Category[] = ["economy", "markets", "business", "property"];

export const REGIONS = ["australia", "global"] as const;
export type Region = (typeof REGIONS)[number];

/** One item as it came out of an RSS feed, normalised. */
export interface RawArticle {
  id: string; // sha1 of the normalised URL
  url: string;
  title: string;
  description: string;
  source: string; // publisher display name, e.g. "AFR"
  publishedAt: string; // ISO
  imageUrl?: string;
}

/** A deduplicated, summarised story: what the site and email show. */
export interface Story {
  id: string;
  headline: string;
  summary: string;
  category: Category;
  region: Region;
  importance: number; // 1-10
  sources: { name: string; url: string }[];
  imageUrl?: string;
  publishedAt: string; // earliest article publish time
  createdAt: string; // when we first summarised it
}

export interface DigestRecord {
  date: string; // Sydney date, YYYY-MM-DD
  sentAt: string;
  recipients: number;
  sections: { title: string; storyIds: string[] }[];
}
