import "./env.js";

const splitScopes = (value: string | undefined) =>
  (value ?? "read:jira-work read:jira-user offline_access")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

export const jiraOAuthConfig = {
  clientId: process.env.JIRA_CLIENT_ID?.trim() ?? "",
  clientSecret: process.env.JIRA_CLIENT_SECRET?.trim() ?? "",
  redirectUri:
    process.env.JIRA_REDIRECT_URI?.trim() ?? "http://localhost:4000/api/jira/oauth/callback",
  frontendBaseUrl: process.env.WEB_APP_URL?.trim() ?? "http://localhost:5173",
  scopes: splitScopes(process.env.JIRA_SCOPES),
  storyPointsField: process.env.JIRA_STORY_POINTS_FIELD?.trim() || "customfield_10016"
};

export const jiraOAuthConfigured = Boolean(
  jiraOAuthConfig.clientId && jiraOAuthConfig.clientSecret && jiraOAuthConfig.redirectUri
);

export const jiraOAuthConfigError = jiraOAuthConfigured
  ? null
  : "Jira OAuth is not configured. Add JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, and JIRA_REDIRECT_URI to the API environment.";
