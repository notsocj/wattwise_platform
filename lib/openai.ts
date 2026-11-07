import "server-only";

/** Chat model used for all WattWise AI features; OpenAI calls stay server-side. */
export const OPENAI_CHAT_MODEL = "gpt-4o-mini";

/**
 * OpenAI list prices for OPENAI_CHAT_MODEL in USD per 1M tokens, used only for
 * the admin cost estimate. Update them with the model or when OpenAI reprices.
 */
export const OPENAI_PRICE_PER_MILLION_TOKENS = { input: 0.15, output: 0.6 } as const;
