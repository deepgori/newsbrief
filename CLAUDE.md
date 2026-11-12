# CLAUDE.md

Inshorts-style Australian news service: RSS → LLM summaries (Groq open models by default) → daily 8am email + static website. See README.md for architecture and setup.

## Layout
- `pipeline/`: Node + TypeScript, run with `tsx` (no build step). ESM: use `.js` extensions in relative imports and `import.meta.url`, never `__dirname`.
  - `ingest.ts` (entry) → `fetch.ts` (feeds via `fetch()` + rss-parser `parseString`) → `summarize.ts` (prompts + zod schemas, batch summaries and the final duplicate pass) → `llm.ts` (provider layer: Groq via its OpenAI-compatible API with strict `json_schema`, or Claude via `betaZodOutputFormat`) → `store.ts`.
  - `digest.ts` (entry): section selection, Gmail send, writes `data/digests/DATE.json`. `--dry-run`, `--force`.
- `web/`: Next.js 16 App Router, `output: "export"`, Tailwind v4. Reads `../data` at build time (`web/lib/data.ts`; override with `DATA_DIR`). This Next version differs from older training data: check `node_modules/next/dist/docs/` before using unfamiliar APIs.
- `data/`: committed by the GitHub Action. Don't hand-edit; `stories.json` and `seen.json` keep 7 days.

## Conventions
- `Story` type lives in `pipeline/src/types.ts` and is mirrored in `web/lib/data.ts`: change both.
- Times: store ISO UTC; "today" and the 8am gate use Australia/Sydney (`pipeline/src/time.ts`).
- Summaries must use only facts in the feed text; keep that rule in the system prompt.
- Provider/model from `LLM_PROVIDER` (`groq` default, or `claude`) and `LLM_MODEL`. Groq free tier is ~8k tokens/min and ~200k/day per model, so keep prompts lean; `llm.ts` handles 429 waits and the fallback model.

## Commands
- `npm run ingest` / `npm run digest -- --dry-run` / `npm run dev` / `npm run build:web` (from repo root)
- `npx tsc --noEmit -p pipeline`: typecheck the pipeline
