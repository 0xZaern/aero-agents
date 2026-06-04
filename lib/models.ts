/**
 * Single source of truth for the model lineup. Counts shown on the site derive
 * from this list - add a model here and the "N models" / "N providers" numbers,
 * the provider tally, and the wheel all update automatically. No manual edits
 * elsewhere.
 *
 * Later this can be swapped for a fetch from the backend (e.g. an
 * /api/models endpoint) without touching the components: just make getModels()
 * async and return the same shape.
 */

export interface ModelEntry {
  name: string;
  provider: string;
}

export const MODELS: ModelEntry[] = [
  { name: "Claude Opus 4.8", provider: "Anthropic" },
  { name: "Claude Sonnet 4.6", provider: "Anthropic" },
  { name: "GPT-5.4", provider: "OpenAI" },
  { name: "GPT-5.4 Mini", provider: "OpenAI" },
  { name: "Gemini 3.1 Pro", provider: "Google" },
  { name: "Gemini 3.5 Flash", provider: "Google" },
  { name: "DeepSeek V4 Pro", provider: "DeepSeek" },
  { name: "DeepSeek V4 Flash", provider: "DeepSeek" },
  { name: "Llama 3.3", provider: "Meta" },
  { name: "Grok 4.20", provider: "xAI" },
  { name: "Kimi K2.6", provider: "Moonshot" },
  { name: "MiniMax M3", provider: "MiniMax" },
  { name: "GLM 5.1", provider: "Z.ai" },
  { name: "Qwen3 235B", provider: "Alibaba" },
  { name: "Qwen3 Coder 480B", provider: "Alibaba" },
  { name: "Mistral Small", provider: "Mistral" },
];

/** Unique providers, in first-seen order - derived, never hand-counted. */
export const PROVIDERS: string[] = Array.from(new Set(MODELS.map((m) => m.provider)));

/** Derived counts - use these in copy so numbers never go stale or disagree. */
export const MODEL_COUNT = MODELS.length;
export const PROVIDER_COUNT = PROVIDERS.length;
