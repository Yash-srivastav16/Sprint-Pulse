import { jiraOAuthConfig, jiraOAuthConfigError, jiraOAuthConfigured } from "../config/jira.js";

const ATLASSIAN_AUTH_URL = "https://auth.atlassian.com/authorize";
const ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";
const ATLASSIAN_API_BASE_URL = "https://api.atlassian.com/ex/jira";

export type JiraOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

export type JiraAccessibleResource = {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl?: string;
};

export type JiraCurrentUser = {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
};

export type JiraUser = {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
  active?: boolean;
  accountType?: string;
};

export type JiraBoard = {
  id: number;
  name: string;
  type: string;
};

export type JiraSprint = {
  id: number;
  name: string;
  state: string;
};

export type JiraCloudIssue = {
  id: string;
  key: string;
  self?: string;
  fields?: {
    summary?: string;
    status?: {
      name?: string;
      statusCategory?: {
        key?: string;
        name?: string;
      };
    };
    assignee?: {
      accountId?: string;
      displayName?: string;
      emailAddress?: string;
    } | null;
    issuetype?: {
      name?: string;
    };
    priority?: {
      name?: string;
    } | null;
    updated?: string;
    parent?: {
      key?: string;
    };
    [field: string]: unknown;
  };
};

type JiraIssueSearchResponse = {
  issues?: JiraCloudIssue[];
  nextPageToken?: string;
  isLast?: boolean;
};

const ensureConfigured = () => {
  if (!jiraOAuthConfigured) {
    throw new Error(jiraOAuthConfigError ?? "Jira OAuth is not configured.");
  }
};

const requestJson = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === "object" && "error_description" in parsed
        ? String((parsed as { error_description?: unknown }).error_description)
        : parsed && typeof parsed === "object" && "message" in parsed
          ? String((parsed as { message?: unknown }).message)
          : text || response.statusText;
    throw new Error(`Jira API request failed (${response.status}): ${detail}`);
  }

  return parsed as T;
};

export const buildJiraAuthorizationUrl = (state: string) => {
  ensureConfigured();
  const url = new URL(ATLASSIAN_AUTH_URL);
  url.searchParams.set("audience", "api.atlassian.com");
  url.searchParams.set("client_id", jiraOAuthConfig.clientId);
  url.searchParams.set("scope", jiraOAuthConfig.scopes.join(" "));
  url.searchParams.set("redirect_uri", jiraOAuthConfig.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("prompt", "consent");

  return url.toString();
};

export const exchangeJiraAuthorizationCode = (code: string) => {
  ensureConfigured();
  return requestJson<JiraOAuthTokenResponse>(ATLASSIAN_TOKEN_URL, {
    method: "POST",
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: jiraOAuthConfig.clientId,
      client_secret: jiraOAuthConfig.clientSecret,
      code,
      redirect_uri: jiraOAuthConfig.redirectUri
    })
  });
};

export const refreshJiraAccessToken = (refreshToken: string) => {
  ensureConfigured();
  return requestJson<JiraOAuthTokenResponse>(ATLASSIAN_TOKEN_URL, {
    method: "POST",
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: jiraOAuthConfig.clientId,
      client_secret: jiraOAuthConfig.clientSecret,
      refresh_token: refreshToken
    })
  });
};

export const getJiraAccessibleResources = (accessToken: string) =>
  requestJson<JiraAccessibleResource[]>(ATLASSIAN_RESOURCES_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

const jiraApiRequest = <T>(accessToken: string, cloudId: string, path: string, init: RequestInit = {}) =>
  requestJson<T>(`${ATLASSIAN_API_BASE_URL}/${encodeURIComponent(cloudId)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {})
    }
  });

export const getJiraCurrentUser = (accessToken: string, cloudId: string) =>
  jiraApiRequest<JiraCurrentUser>(accessToken, cloudId, "/rest/api/3/myself");

export const listJiraAssignableUsers = async (accessToken: string, cloudId: string, projectKey: string) => {
  const url = new URL(
    `${ATLASSIAN_API_BASE_URL}/${encodeURIComponent(cloudId)}/rest/api/3/user/assignable/multiProjectSearch`
  );
  url.searchParams.set("projectKeys", projectKey);
  url.searchParams.set("maxResults", "1000");

  return requestJson<JiraUser[]>(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
};

export const listJiraBoards = async (accessToken: string, cloudId: string, projectKey: string) => {
  const url = new URL(`${ATLASSIAN_API_BASE_URL}/${encodeURIComponent(cloudId)}/rest/agile/1.0/board`);
  url.searchParams.set("projectKeyOrId", projectKey);
  url.searchParams.set("type", "scrum");

  const response = await requestJson<{ values?: JiraBoard[] }>(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return response.values ?? [];
};

export const getActiveJiraSprint = async (accessToken: string, cloudId: string, boardId: number) => {
  const url = new URL(
    `${ATLASSIAN_API_BASE_URL}/${encodeURIComponent(cloudId)}/rest/agile/1.0/board/${boardId}/sprint`
  );
  url.searchParams.set("state", "active");

  const response = await requestJson<{ values?: JiraSprint[] }>(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return response.values?.[0] ?? null;
};

export const searchJiraIssues = async (
  accessToken: string,
  cloudId: string,
  input: {
    projectKey: string;
    sprintId?: string;
    maxResults?: number;
  }
) => {
  const sprintClause = input.sprintId ? ` AND sprint = ${Number(input.sprintId)}` : "";
  const jql = `project = ${input.projectKey}${sprintClause} ORDER BY updated DESC`;
  const fields = [
    "summary",
    "status",
    "assignee",
    "issuetype",
    "priority",
    "updated",
    "parent",
    jiraOAuthConfig.storyPointsField
  ];
  const maxResults = input.maxResults ?? 100;
  const issues: JiraCloudIssue[] = [];
  let nextPageToken: string | undefined;

  do {
    const response = await jiraApiRequest<JiraIssueSearchResponse>(accessToken, cloudId, "/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({
        jql,
        maxResults: Math.min(100, maxResults - issues.length),
        fields,
        ...(nextPageToken ? { nextPageToken } : {})
      })
    });

    issues.push(...(response.issues ?? []));
    nextPageToken = response.nextPageToken;

    if (response.isLast) {
      break;
    }
  } while (nextPageToken && issues.length < maxResults);

  return issues.slice(0, maxResults);
};
