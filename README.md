# NewsBrief: Australian news in 60 words

An Inshorts-style news service for Australia with a dedicated finance section:

- **Daily 8am email briefing** (Sydney time) of the most important Australian and global finance, economy and business news.
- **Website** with a swipeable short-news feed (Top Stories / Finance / Morning Briefing).
- Built so a mobile app can sit on the same data later.

Runs entirely on GitHub Actions with free open-source models on Groq: no servers, no Make.com credits, and nothing to pay at current volumes.

## How it works

```
RSS feeds (AFR, ABC, SMH, Guardian, SBS, BBC, CNBC, FT, MarketWatch, Economist)
   │  every 2 hours (GitHub Actions)
   ▼
pipeline/src/ingest.ts
   • fetch feeds, drop articles already processed (data/seen.json)
   • an LLM (default: gpt-oss-120b on Groq) groups duplicates across publishers,
     discards non-news, writes headline + 40–60 word summary, assigns category,
     region, importance; a final pass over recent headlines folds leftover duplicates
   • merges into data/stories.json (rolling 7 days), commits to the repo
   │
   ├─▶ pipeline/src/digest.ts   at 8am Sydney: picks top stories per section,
   │                            emails via Gmail, records data/digests/DATE.json
   │
   └─▶ web/ (Next.js static export) rebuilt from data/ and deployed to GitHub Pages
```

## Setup

1. **Create a GitHub repo** and push this folder. (GitHub Pages on a private repo needs a paid plan; see "Hosting the site" below.)
2. **Gmail app password**: on the sending Gmail account turn on 2-Step Verification, then Google Account → Security → App passwords → create one.
3. **Repo secrets** (Settings → Secrets and variables → Actions → Secrets):
   | Secret | Value |
   |---|---|
   | `GROQ_API_KEY` | from console.groq.com → API Keys (free) |
   | `GMAIL_USER` | sending Gmail address |
   | `GMAIL_APP_PASSWORD` | the 16-character app password |
   | `DIGEST_RECIPIENTS` | comma-separated emails (sent as BCC) |
4. **Repo variables** (optional, same page → Variables):
   | Variable | Purpose |
   |---|---|
   | `LLM_PROVIDER` | `groq` (default) or `claude` (then also add an `ANTHROPIC_API_KEY` secret) |
   | `LLM_MODEL` | override the model (Groq default `openai/gpt-oss-120b`) |
   | `DEPLOY_PAGES` | `true` to build and deploy the website |
   | `SITE_URL` | linked at the bottom of the email |
5. If deploying the site: Settings → Pages → Source: **GitHub Actions**.
6. Actions tab → **News pipeline** → *Run workflow* to do the first ingest. Tick "Send the email digest now" to test the email immediately.

## Local development

```bash
npm install
export GROQ_API_KEY=...             # or: cp .env.example .env and fill in
npm run ingest                      # fetch + summarise into data/
npm run digest -- --dry-run         # write pipeline/out/digest-preview.html
npm run digest -- --force           # actually send (needs Gmail vars)
npm run dev                         # website on http://localhost:3000
```

Add or remove sources in `pipeline/src/feeds.ts`. Email sections and limits are in `pipeline/src/sections.ts`.

## Cost and limits

Only new articles go to the model (roughly 300–500 a day across all feeds, about 150–200k tokens a day). Each run logs its token usage.

- **Groq (default), free tier:** about 8k tokens/minute and roughly 200k tokens/day per model. The pipeline uses small batches, waits out per-minute limits, and when `gpt-oss-120b` hits its daily cap it switches to `gpt-oss-20b` (separate quota). If both run out, the run stops cleanly and the rest is picked up next run. Groq's paid Developer tier lifts the limits if you add more feeds.
- **Claude (`LLM_PROVIDER=claude`):** better deduplication and judgement; roughly $40–70/month on Opus 5.5 or $1–3 on Haiku 5.5.

GitHub Actions minutes are free for public repos; a private repo uses roughly 600–900 of the 2,000 free monthly minutes (Groq runs wait on rate limits).

## Hosting the site

The site is a static export (`web/out`), so it can go anywhere: GitHub Pages (built in, set `DEPLOY_PAGES=true`), Cloudflare Pages, Netlify, or Vercel (point it at `web/`; it redeploys on every data commit).

## Before a public launch

- **Content rights**: short AI summaries plus headline and link-back is the aggregator model, but publishers' terms differ, and images are hotlinked from publishers. Get advice and consider licensing feeds before launching commercially.
- **Storage**: `data/*.json` in git is fine for now. For accounts, personalisation and push notifications in the app, move stories to a database (e.g. Postgres/Supabase) and drop `output: "export"`.
- **Mobile app**: Expo/React Native can read the same stories JSON or database.
