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

export const buildJiraFrontendRedirectUrl = (
  pathname: string,
  params: Record<string, string | number | boolean | null | undefined> = {}
) => {
  const url = new URL(jiraOAuthConfig.frontendBaseUrl);
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const basePathname = url.pathname.replace(/\/+$/, "");
  url.pathname =
    basePathname && basePathname !== "/" ? `${basePathname}${normalizedPathname}` : normalizedPathname;

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
};

export const jiraOAuthConfigured = Boolean(
  jiraOAuthConfig.clientId && jiraOAuthConfig.clientSecret && jiraOAuthConfig.redirectUri
);

export const jiraOAuthConfigError = jiraOAuthConfigured
  ? null
  : "Jira OAuth is not configured. Add JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, and JIRA_REDIRECT_URI to the API environment.";
