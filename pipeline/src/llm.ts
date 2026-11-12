/**
 * Provider-agnostic "give me JSON matching this schema" call.
 *
 *   LLM_PROVIDER=groq    (default) open models on Groq's free tier, e.g. openai/gpt-oss-120b
 *   LLM_PROVIDER=claude  Anthropic Claude
 *   LLM_MODEL=...        override the provider's default model
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export type Provider = "groq" | "claude";
export const PROVIDER: Provider = process.env.LLM_PROVIDER === "claude" ? "claude" : "groq";

const DEFAULT_MODEL: Record<Provider, string> = {
  groq: "openai/gpt-oss-120b",
  claude: "claude-opus-5-5",
};
export const MODEL = process.env.LLM_MODEL || DEFAULT_MODEL[PROVIDER];

/** Articles per request. Groq's free tier allows ~8k tokens/minute, so keep requests small. */
export const BATCH_SIZE = PROVIDER === "groq" ? 15 : 40;

export interface Usage {
  input: number;
  output: number;
}

export type JsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "refusal" | "unparseable"; detail: string };

/** Errors that won't fix themselves by retrying (bad key, daily quota): stop the run. */
export class FatalLLMError extends Error {}

/** How hard the model should think; "medium" for small, judgement-heavy calls. */
export type Effort = "low" | "medium";

export async function generateJson<S extends z.ZodType>(
  schema: S,
  system: string,
  user: string,
  usage: Usage,
  effort: Effort = "low",
): Promise<JsonResult<z.infer<S>>> {
  return PROVIDER === "claude"
    ? claude(schema, system, user, usage, effort)
    : groq(schema, system, user, usage, effort);
}

// ---------------------------------------------------------------- Groq ----

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_WAIT_MS = 90_000; // longer than this means a daily limit, not a per-minute one

/** Groq's free tier caps tokens per model per day (~200k); this model takes over when the main one runs out. */
const GROQ_FALLBACK = process.env.GROQ_FALLBACK_MODEL ?? "openai/gpt-oss-20b";
let groqModel = MODEL;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parses Groq's "1m26.4s" / "3.99s" / "250ms" durations. */
function parseDuration(s: string | null): number | undefined {
  if (!s) return undefined;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s) * 1000; // retry-after: seconds
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:([\d.]+)ms)?$/);
  if (!m) return undefined;
  const [, h, min, sec, ms] = m;
  return ((Number(h ?? 0) * 60 + Number(min ?? 0)) * 60 + Number(sec ?? 0)) * 1000 + Number(ms ?? 0);
}

async function groq<S extends z.ZodType>(schema: S, system: string, user: string, usage: Usage, effort: Effort): Promise<JsonResult<z.infer<S>>> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new FatalLLMError("GROQ_API_KEY is not set");

  const body = () => JSON.stringify({
    model: groqModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "result", strict: true, schema: z.toJSONSchema(schema) },
    },
    reasoning_effort: effort,
    temperature: 0.2,
    max_completion_tokens: 8000,
  });

  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body(),
      signal: AbortSignal.timeout(120_000),
    });

    if (res.status === 429 || res.status >= 500) {
      const wait =
        parseDuration(res.headers.get("retry-after")) ?? parseDuration(res.headers.get("x-ratelimit-reset-tokens")) ?? 15_000;
      if (wait > MAX_WAIT_MS) {
        // Daily quotas are per model: switch to the fallback model once.
        if (GROQ_FALLBACK && groqModel !== GROQ_FALLBACK) {
          console.warn(`  ! ${groqModel} daily quota reached; switching to ${GROQ_FALLBACK}`);
          groqModel = GROQ_FALLBACK;
          continue;
        }
        throw new FatalLLMError(`Groq rate limit resets in ${Math.round(wait / 1000)}s (daily quota?); stopping this run`);
      }
      console.log(`  … Groq ${res.status}, waiting ${Math.ceil(wait / 1000)}s`);
      await sleep(wait + 500);
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new FatalLLMError(`Groq auth failed (${res.status})`);

    const json = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
      error?: { message: string; code?: string };
    };
    if (!res.ok) {
      // e.g. json_validate_failed: the model's output didn't match the schema
      return { ok: false, reason: "unparseable", detail: `${res.status} ${json.error?.code ?? ""} ${json.error?.message ?? ""}`.trim() };
    }
    usage.input += json.usage?.prompt_tokens ?? 0;
    usage.output += json.usage?.completion_tokens ?? 0;

    const choice = json.choices?.[0];
    try {
      const parsed = schema.safeParse(JSON.parse(choice?.message?.content ?? ""));
      if (parsed.success) return { ok: true, data: parsed.data };
      return { ok: false, reason: "unparseable", detail: parsed.error.message.slice(0, 200) };
    } catch {
      return { ok: false, reason: "unparseable", detail: `finish_reason=${choice?.finish_reason}` };
    }
  }
  throw new Error("Groq: still rate limited after 6 attempts");
}

// -------------------------------------------------------------- Claude ----

let anthropic: Anthropic | undefined;

async function claude<S extends z.ZodType>(schema: S, system: string, user: string, usage: Usage, effort: Effort): Promise<JsonResult<z.infer<S>>> {
  anthropic ??= new Anthropic();
  try {
    const response = await anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort, format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: user }],
    });
    usage.input += response.usage.input_tokens;
    usage.output += response.usage.output_tokens;
    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "refusal", detail: response.stop_details?.category ?? "no category" };
    }
    if (!response.parsed_output) return { ok: false, reason: "unparseable", detail: `stop_reason=${response.stop_reason}` };
    return { ok: true, data: response.parsed_output as z.infer<S> };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new FatalLLMError(`Claude auth failed: ${err.message}`);
    }
    throw err;
  }
}
