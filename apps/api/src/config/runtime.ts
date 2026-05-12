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

export const mockFlowEnabled = parseBooleanFlag(process.env.ENABLE_MOCK_FLOW, false);
export const dataMode = mockFlowEnabled ? "seeded" : "supabase";

export const realDataNotReadyMessage =
  "Supabase data mode is enabled, but this route still needs its database-backed adapter.";
