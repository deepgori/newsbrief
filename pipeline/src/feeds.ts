export interface Feed {
  source: string; // display name shown as "read more at <source>"
  url: string;
}

// Every URL here was checked to return a working RSS feed (Nov 2026).
// Region and category are decided per story by the summariser, so a feed
// doesn't need to be tagged; just add or remove lines here.
export const FEEDS: Feed[] = [
  // Australia: finance & business
  { source: "AFR", url: "https://www.afr.com/rss/feed.xml" },
  { source: "ABC News", url: "https://www.abc.net.au/news/feed/51892/rss.xml" }, // business
  { source: "SMH", url: "https://www.smh.com.au/rss/business.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/au/business/rss" },
  // RBA's own feed (rba.gov.au/rss/rss-cb-media-releases.xml) is left out: its
  // TLS chain uses a Sectigo root Node doesn't ship, and AFR/ABC cover RBA news.

  // Australia: general news
  { source: "ABC News", url: "https://www.abc.net.au/news/feed/51120/rss.xml" }, // top stories
  { source: "SMH", url: "https://www.smh.com.au/rss/feed.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/australia-news/rss" },
  { source: "SBS News", url: "https://www.sbs.com.au/news/topic/latest/feed" },
  { source: "ABC Sport", url: "https://www.abc.net.au/news/feed/2942460/rss.xml" },

  // Global: finance & economy
  { source: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" }, // top news
  { source: "CNBC", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html" }, // economy
  { source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { source: "BBC", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { source: "Financial Times", url: "https://www.ft.com/rss/home" },
  { source: "The Economist", url: "https://www.economist.com/finance-and-economics/rss.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/business/economics/rss" },

  // Global: general news
  { source: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
];
