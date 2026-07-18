import "./env.js";

const parseBooleanFlag = (value: string | undefined, defaultValue: boolean) => {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

const parseNumber = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value ?? defaultValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
};

export const aiInsightsRequested = parseBooleanFlag(process.env.ENABLE_AI_INSIGHTS, false);
export const openAiApiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
export const openAiBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com";
export const openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.1-CIO";
export const aiRequestTimeoutMs = parseNumber(process.env.AI_REQUEST_TIMEOUT_MS, 20_000);
export const aiCacheTtlMinutes = parseNumber(process.env.AI_CACHE_TTL_MINUTES, 10);
export const aiInputFormat: "toon" | "json" =
  (process.env.AI_INPUT_FORMAT ?? "toon").trim().toLowerCase() === "json" ? "json" : "toon";
export const aiInsightsConfigured = Boolean(openAiApiKey);
export const aiInsightsEnabled = aiInsightsRequested && aiInsightsConfigured;

export const aiConfigReason = !aiInsightsRequested
  ? "AI insights are disabled by ENABLE_AI_INSIGHTS."
  : !aiInsightsConfigured
    ? "OPENAI_API_KEY is not configured."
    : undefined;
