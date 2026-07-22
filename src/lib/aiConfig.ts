/** Shared AI defaults — prefer Haiku for cost; Sonnet only when quality preset requests it. */
export const AI_MODEL_HAIKU = 'claude-haiku-4-5-20251001'
export const AI_MODEL_SONNET = 'claude-sonnet-4-6'

export const AI_DEFAULT_MODEL = AI_MODEL_HAIKU
export const AI_DEFAULT_MAX_TOKENS = 1536
export const AI_CHAT_MAX_TOKENS = 2048
export const AI_SUMMARY_MAX_TOKENS = 1024

/** Tasks ≤ this many minutes should be done immediately, not added to the list. */
export const THREE_MINUTE_RULE_THRESHOLD = 3
