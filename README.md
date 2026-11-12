# NewsBrief: Australian news in 60 words

An Inshorts-style news service for Australia with a dedicated finance section:

- **Daily 8am briefing** (Sydney time) of the most important Australian and global finance, economy and business news, published on the site and optionally emailed.
- **Website** with a swipeable short-news feed (Top Stories / Finance / Morning Briefing).
- Built so a mobile app can sit on the same data later.

Runs entirely on GitHub Actions with free open-source models on Groq, and updates the live site about every 10 minutes: no servers, no Make.com credits, and nothing to pay at current volumes.

## How it works

```
RSS feeds (AFR, ABC, SMH, Guardian, SBS, BBC, CNBC, FT, MarketWatch, Economist)
   │  every ~10 minutes (GitHub Actions)
   ▼
pipeline/src/ingest.ts
   • fetch feeds, drop articles already processed (data/seen.json)
   • an LLM (default: gpt-oss-120b on Groq) groups duplicates across publishers,
     discards non-news, writes headline + 40–60 word summary, assigns category,
     region, importance; a final pass over recent headlines folds leftover duplicates
   • merges into data/stories.json (rolling 7 days), commits to the repo
   │
   ├─▶ pipeline/src/digest.ts   at 8am Sydney: picks top stories per section,
   │                            records data/digests/DATE.json (Briefing page),
   │                            and emails it via Gmail if configured
   │
   └─▶ web/ (Next.js static export) built in the same run and uploaded to Netlify;
       open pages notice the new version (/version.json) and offer a refresh
```

## Setup

1. **Create a GitHub repo** and push this folder. Keep it **public** for ~10-minute updates: public repos get unlimited Actions minutes, private ones only 2,000/month (enough for roughly every 30–45 minutes).
2. **Gmail app password** (only if you want the email): on the sending Gmail account turn on 2-Step Verification, then Google Account → Security → App passwords → create one.
3. **Repo secrets** (Settings → Secrets and variables → Actions → Secrets):
   | Secret | Value |
   |---|---|
   | `GROQ_API_KEY` | from console.groq.com → API Keys (free) |
   | `NETLIFY_AUTH_TOKEN` | Netlify → User settings → Applications → Personal access tokens; the site ID is in the workflow |
   | `GMAIL_USER` | *optional*: sending Gmail address |
   | `GMAIL_APP_PASSWORD` | *optional*: the 16-character app password |
   | `DIGEST_RECIPIENTS` | *optional*: comma-separated emails (sent as BCC) |

   The three Gmail secrets are only needed for the email; without them the briefing is published on the site only.
4. **Repo variables** (optional, same page → Variables):
   | Variable | Purpose |
   |---|---|
   | `LLM_PROVIDER` | `groq` (default) or `claude` (then also add an `ANTHROPIC_API_KEY` secret) |
   | `LLM_MODEL` | override the model (Groq default `openai/gpt-oss-120b`) |
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

GitHub Actions minutes are unlimited for public repos. To stay inside Groq's free quota at a 10-minute cadence, ingest waits until at least 5 new articles have arrived (or the oldest has waited 25 minutes), and the cross-batch duplicate pass runs at most hourly.

## Hosting the site

Live at https://newsbrief-au.netlify.app. The workflow builds the static site (`web/out`) and uploads it with Netlify's deploy API, so Netlify's own builds are switched off (they'd use up the 300 free build minutes/month within days). Any static host works the same way.

## Before a public launch

- **Content rights**: short AI summaries plus headline and link-back is the aggregator model, but publishers' terms differ, and images are hotlinked from publishers. Get advice and consider licensing feeds before launching commercially.
- **Storage**: `data/*.json` in git is fine for now. For accounts, personalisation and push notifications in the app, move stories to a database (e.g. Postgres/Supabase) and drop `output: "export"`.
- **Mobile app**: Expo/React Native can read the same stories JSON or database.
