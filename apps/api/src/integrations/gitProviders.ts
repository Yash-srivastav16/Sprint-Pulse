import type { GitConnection, SprintInfo } from "@sprintpulse/shared";

export type GitProvider = "github" | "gitlab";

export type GitProviderConnection = GitConnection & {
  accessToken?: string;
};

export type GitProviderCommit = {
  sha: string;
  html_url?: string;
  author?: {
    login?: string | null;
  } | null;
  commit: {
    message?: string;
    author?: {
      email?: string | null;
      date?: string | null;
    } | null;
    committer?: {
      email?: string | null;
      date?: string | null;
    } | null;
  };
  stats?: {
    additions?: number;
    deletions?: number;
  };
};

export type GitProviderPullRequest = {
  number: number;
  title: string;
  html_url?: string;
  state?: "open" | "closed" | string;
  draft?: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    login?: string | null;
  } | null;
  head?: {
    ref?: string | null;
    sha?: string | null;
  } | null;
  base?: {
    ref?: string | null;
  } | null;
};

export type GitProviderPullRequestFile = {
  filename: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
};

export type PullRequestReviewSignal = {
  reviewCount: number;
  reviewComments: number;
  conversationComments: number;
  inlineComments: number;
  reviewBodyComments: number;
  commitComments: number;
  changeRequests: number;
  approvals: number;
  issueCount: number;
};

type GitHubPullRequestReview = {
  id: number;
  state?: string | null;
  body?: string | null;
  submitted_at?: string | null;
  user?: {
    login?: string | null;
  } | null;
};

type GitHubPullRequestReviewComment = {
  id: number;
  body?: string | null;
  path?: string | null;
  created_at?: string | null;
  user?: {
    login?: string | null;
  } | null;
};

type GitHubPullRequestConversationComment = {
  id: number;
  body?: string | null;
  created_at?: string | null;
  user?: {
    login?: string | null;
  } | null;
};

type GitHubPullRequestCommitRef = {
  sha: string;
};

type GitHubCommitComment = {
  id: number;
  body?: string | null;
  path?: string | null;
  position?: number | null;
  created_at?: string | null;
  user?: {
    login?: string | null;
  } | null;
};

type GitLabCommitListItem = {
  id: string;
  short_id?: string;
  title?: string;
  message?: string;
  author_name?: string | null;
  author_email?: string | null;
  authored_date?: string | null;
  committer_email?: string | null;
  committed_date?: string | null;
  web_url?: string;
  stats?: {
    additions?: number;
    deletions?: number;
    total?: number;
  };
};

type GitLabMergeRequestListItem = {
  iid: number;
  title: string;
  web_url?: string;
  state?: string;
  draft?: boolean;
  work_in_progress?: boolean;
  created_at: string;
  updated_at: string;
  source_branch?: string | null;
  target_branch?: string | null;
  sha?: string | null;
  author?: {
    username?: string | null;
  } | null;
};

type GitLabMergeRequestDiff = {
  new_path?: string | null;
  old_path?: string | null;
  new_file?: boolean;
  renamed_file?: boolean;
  deleted_file?: boolean;
  diff?: string | null;
};

type GitLabMergeRequestChangesResponse = {
  changes?: GitLabMergeRequestDiff[];
};

type GitLabNote = {
  id: number;
  body?: string | null;
  system?: boolean;
  resolvable?: boolean;
  resolved?: boolean;
  type?: string | null;
  position?: unknown;
  created_at?: string | null;
  author?: {
    username?: string | null;
  } | null;
};

type GitLabDiscussion = {
  id: string;
  notes?: GitLabNote[];
};

type GitLabApprovalState = {
  approved_by?: Array<{
    user?: {
      username?: string | null;
    } | null;
  }>;
};

const normalizedGitValue = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const sprintStartIso = (sprint: SprintInfo) => new Date(`${sprint.startDate}T00:00:00.000Z`).toISOString();

const sprintEndIso = (sprint: SprintInfo) => new Date(`${sprint.endDate}T23:59:59.999Z`).toISOString();

export const configuredGitProvider = (): GitProvider => {
  const provider = (process.env.GIT_PROVIDER ?? process.env.GIT_SYNC_PROVIDER ?? "").trim().toLowerCase();
  return provider === "gitlab" ? "gitlab" : "github";
};

export const gitProviderLabel = (provider: GitProvider) => (provider === "gitlab" ? "GitLab" : "GitHub");

export const gitReviewName = (provider: GitProvider) => (provider === "gitlab" ? "merge request" : "PR");

const gitMaxPagesValue = () => process.env.GIT_MAX_PAGES ?? process.env.GITLAB_MAX_PAGES ?? process.env.GITHUB_MAX_PAGES;

const gitCommitDetailLimitValue = () =>
  process.env.GIT_COMMIT_DETAIL_LIMIT ?? process.env.GITLAB_COMMIT_DETAIL_LIMIT ?? process.env.GITHUB_COMMIT_DETAIL_LIMIT;

export const gitMaxPagesLimit = () => {
  const parsed = Number(gitMaxPagesValue() ?? 5);
  if (!Number.isFinite(parsed)) {
    return 5;
  }

  return Math.max(1, Math.min(10, Math.floor(parsed)));
};

const gitCommitDetailLimit = () => {
  const parsed = Number(gitCommitDetailLimitValue() ?? 120);
  if (!Number.isFinite(parsed)) {
    return 120;
  }

  return Math.max(0, Math.min(300, Math.floor(parsed)));
};

const gitPullRequestCommitCommentLimit = () => {
  const parsed = Number(process.env.GIT_PR_COMMIT_COMMENT_LIMIT ?? process.env.GITHUB_PR_COMMIT_COMMENT_LIMIT ?? 25);
  if (!Number.isFinite(parsed)) {
    return 25;
  }

  return Math.max(0, Math.min(100, Math.floor(parsed)));
};

const githubHeaders = (connection: GitProviderConnection) => {
  const token = (connection.accessToken ?? process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? "").trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "SprintPulse-AI",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const gitLogContext = (connection: GitProviderConnection) => ({
  provider: connection.provider,
  repo: `${connection.repoOwner}/${connection.repoName}`,
  defaultBranch: connection.defaultBranch || "main",
  hasSavedToken: Boolean(connection.accessToken?.trim()),
  hasEnvToken: Boolean((process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? process.env.GITLAB_TOKEN ?? process.env.GIT_TOKEN ?? "").trim())
});

const githubJson = async <T>(url: URL, connection: GitProviderConnection): Promise<T> => {
  const response = await fetch(url, { headers: githubHeaders(connection) });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    const details = body.message ? ` ${body.message}` : "";
    console.error("[git-sync] github request failed", {
      ...gitLogContext(connection),
      status: response.status,
      endpoint: `${url.origin}${url.pathname}`,
      message: body.message,
      rateLimitRemaining: response.headers.get("x-ratelimit-remaining"),
      rateLimitReset: response.headers.get("x-ratelimit-reset")
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error(`GitHub authentication failed.${details} Check the saved project token or legacy GITHUB_TOKEN env.`);
    }

    if (response.status === 404) {
      throw new Error(
        `GitHub repository ${connection.repoOwner}/${connection.repoName} was not found or the token cannot access it.${details} Verify the provider, owner/repo, default branch, and token repository access.`
      );
    }

    throw new Error(`GitHub API request failed with ${response.status}.${details}`);
  }

  return response.json() as Promise<T>;
};

const gitLabApiBase = (connection: GitProviderConnection) =>
  (connection.baseUrl ?? process.env.GITLAB_API_BASE_URL ?? "https://gitlab.com/api/v4").replace(/\/+$/, "");

const gitLabProjectId = (connection: GitProviderConnection) =>
  encodeURIComponent(`${connection.repoOwner.trim()}/${connection.repoName.trim()}`);

const gitLabUrl = (connection: GitProviderConnection, path: string) =>
  new URL(`${gitLabApiBase(connection)}/projects/${gitLabProjectId(connection)}${path}`);

const gitLabHeaders = (connection: GitProviderConnection) => {
  const token = (connection.accessToken ?? process.env.GITLAB_TOKEN ?? process.env.GIT_TOKEN ?? "").trim();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "SprintPulse-AI"
  };

  if (token) {
    headers["PRIVATE-TOKEN"] = token;
  }

  return headers;
};

const gitLabJson = async <T>(url: URL, connection: GitProviderConnection): Promise<T> => {
  const response = await fetch(url, { headers: gitLabHeaders(connection) });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: unknown; error?: string };
    const message =
      typeof body.message === "string"
        ? body.message
        : body.error
          ? body.error
          : body.message
            ? JSON.stringify(body.message)
            : "";
    const details = message ? ` ${message}` : "";
    console.error("[git-sync] gitlab request failed", {
      ...gitLogContext(connection),
      status: response.status,
      endpoint: `${url.origin}${url.pathname}`,
      message,
      rateLimitRemaining: response.headers.get("ratelimit-remaining")
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error(`GitLab authentication failed.${details} Check the saved project token or legacy GITLAB_TOKEN env.`);
    }

    if (response.status === 404) {
      throw new Error(`GitLab project was not found or the token cannot access it.${details}`);
    }

    throw new Error(`GitLab API request failed with ${response.status}.${details}`);
  }

  return response.json() as Promise<T>;
};

const gitLabCommitToProviderShape = (commit: GitLabCommitListItem): GitProviderCommit => ({
  sha: commit.id,
  html_url: commit.web_url,
  author: commit.author_name ? { login: commit.author_name } : null,
  commit: {
    message: commit.message ?? commit.title,
    author: {
      email: commit.author_email,
      date: commit.authored_date ?? commit.committed_date
    },
    committer: {
      email: commit.committer_email ?? commit.author_email,
      date: commit.committed_date ?? commit.authored_date
    }
  },
  stats: commit.stats
});

const gitLabMergeRequestToProviderShape = (mergeRequest: GitLabMergeRequestListItem): GitProviderPullRequest => ({
  number: mergeRequest.iid,
  title: mergeRequest.title,
  html_url: mergeRequest.web_url,
  state: mergeRequest.state === "opened" ? "open" : mergeRequest.state,
  draft: mergeRequest.draft ?? mergeRequest.work_in_progress ?? false,
  created_at: mergeRequest.created_at,
  updated_at: mergeRequest.updated_at,
  user: mergeRequest.author?.username ? { login: mergeRequest.author.username } : null,
  head: {
    ref: mergeRequest.source_branch,
    sha: mergeRequest.sha
  },
  base: {
    ref: mergeRequest.target_branch
  }
});

const diffLineStats = (patch?: string | null) => {
  const lines = patch?.split("\n") ?? [];
  const additions = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
  const deletions = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
  return { additions, deletions };
};

const gitLabDiffToPullRequestFile = (diff: GitLabMergeRequestDiff): GitProviderPullRequestFile => {
  const stats = diffLineStats(diff.diff);
  return {
    filename: diff.new_path ?? diff.old_path ?? "changed-file",
    status: diff.deleted_file ? "removed" : diff.new_file ? "added" : diff.renamed_file ? "renamed" : "modified",
    additions: stats.additions,
    deletions: stats.deletions,
    changes: stats.additions + stats.deletions,
    patch: diff.diff ?? undefined
  };
};

const fetchGithubCommits = async (connection: GitProviderConnection, sprint: SprintInfo) => {
  const commits: GitProviderCommit[] = [];
  const maxPages = gitMaxPagesLimit();

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(
      `https://api.github.com/repos/${encodeURIComponent(connection.repoOwner)}/${encodeURIComponent(connection.repoName)}/commits`
    );
    url.searchParams.set("sha", connection.defaultBranch || "main");
    url.searchParams.set("since", sprintStartIso(sprint));
    url.searchParams.set("until", sprintEndIso(sprint));
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const pageCommits = await githubJson<GitProviderCommit[]>(url, connection);
    commits.push(...pageCommits);

    if (pageCommits.length < 100) {
      break;
    }
  }

  return commits;
};

const fetchGithubCommitDetails = async (connection: GitProviderConnection, commits: GitProviderCommit[]) => {
  const detailLimit = gitCommitDetailLimit();
  if (!detailLimit) {
    return commits;
  }

  const detailedCommits = await Promise.all(
    commits.slice(0, detailLimit).map((commit) => {
      const url = new URL(
        `https://api.github.com/repos/${encodeURIComponent(connection.repoOwner)}/${encodeURIComponent(connection.repoName)}/commits/${encodeURIComponent(commit.sha)}`
      );
      return githubJson<GitProviderCommit>(url, connection).catch(() => commit);
    })
  );

  return [...detailedCommits, ...commits.slice(detailLimit)];
};

const fetchGithubPullRequests = async (connection: GitProviderConnection) => {
  const url = new URL(
    `https://api.github.com/repos/${encodeURIComponent(connection.repoOwner)}/${encodeURIComponent(connection.repoName)}/pulls`
  );
  url.searchParams.set("state", "open");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", "100");

  return githubJson<GitProviderPullRequest[]>(url, connection);
};

const fetchGithubPullRequestCommits = async (
  connection: GitProviderConnection,
  pullRequests: GitProviderPullRequest[]
) => {
  const pairs = await Promise.all(
    pullRequests.map(async (pullRequest) => {
      const url = new URL(
        `https://api.github.com/repos/${encodeURIComponent(connection.repoOwner)}/${encodeURIComponent(connection.repoName)}/pulls/${pullRequest.number}/commits`
      );
      url.searchParams.set("per_page", "100");

      const commits = await githubJson<GitProviderCommit[]>(url, connection).catch(() => []);
      const detailedCommits = await fetchGithubCommitDetails(connection, commits);
      return [pullRequest.number, detailedCommits] as const;
    })
  );

  return new Map(pairs);
};

const fetchGithubPullRequestFiles = async (connection: GitProviderConnection, pullRequest: GitProviderPullRequest) => {
  const url = new URL(
    `https://api.github.com/repos/${encodeURIComponent(connection.repoOwner)}/${encodeURIComponent(connection.repoName)}/pulls/${pullRequest.number}/files`
  );
  url.searchParams.set("per_page", "100");

  return githubJson<GitProviderPullRequestFile[]>(url, connection);
};

const fetchGithubPullRequestReviewSignals = async (
  connection: GitProviderConnection,
  pullRequests: GitProviderPullRequest[]
) => {
  const warnings: string[] = [];
  const commitCommentLimit = gitPullRequestCommitCommentLimit();
  const pairs = await Promise.all(
    pullRequests.map(async (pullRequest) => {
      const repoBase = `https://api.github.com/repos/${encodeURIComponent(connection.repoOwner)}/${encodeURIComponent(connection.repoName)}`;
      const pullBase = `${repoBase}/pulls/${pullRequest.number}`;
      const reviewsUrl = new URL(`${pullBase}/reviews`);
      const commentsUrl = new URL(`${pullBase}/comments`);
      const conversationCommentsUrl = new URL(`${repoBase}/issues/${pullRequest.number}/comments`);
      const pullCommitsUrl = new URL(`${pullBase}/commits`);
      reviewsUrl.searchParams.set("per_page", "100");
      commentsUrl.searchParams.set("per_page", "100");
      conversationCommentsUrl.searchParams.set("per_page", "100");
      pullCommitsUrl.searchParams.set("per_page", "100");

      try {
        const [reviews, comments, conversationComments, pullCommits] = await Promise.all([
          githubJson<GitHubPullRequestReview[]>(reviewsUrl, connection),
          githubJson<GitHubPullRequestReviewComment[]>(commentsUrl, connection),
          githubJson<GitHubPullRequestConversationComment[]>(conversationCommentsUrl, connection),
          commitCommentLimit
            ? githubJson<GitHubPullRequestCommitRef[]>(pullCommitsUrl, connection)
            : Promise.resolve([] as GitHubPullRequestCommitRef[])
        ]);
        const commitCommentGroups = await Promise.all(
          pullCommits.slice(0, commitCommentLimit).map((commit) => {
            const commitCommentsUrl = new URL(`${repoBase}/commits/${encodeURIComponent(commit.sha)}/comments`);
            commitCommentsUrl.searchParams.set("per_page", "100");
            return githubJson<GitHubCommitComment[]>(commitCommentsUrl, connection).catch(() => [] as GitHubCommitComment[]);
          })
        );
        const latestReviewsByReviewer = new Map<string, GitHubPullRequestReview>();
        for (const review of reviews) {
          const reviewer = review.user?.login ?? String(review.id);
          const current = latestReviewsByReviewer.get(reviewer);
          const currentTime = current?.submitted_at ? new Date(current.submitted_at).getTime() : 0;
          const nextTime = review.submitted_at ? new Date(review.submitted_at).getTime() : 0;
          if (!current || nextTime >= currentTime) {
            latestReviewsByReviewer.set(reviewer, review);
          }
        }
        const latestReviewStates = Array.from(latestReviewsByReviewer.values()).map((review) => review.state);
        const changeRequests = latestReviewStates.filter((state) => state === "CHANGES_REQUESTED").length;
        const approvals = latestReviewStates.filter((state) => state === "APPROVED").length;
        const inlineComments = comments.length;
        const conversationCommentCount = conversationComments.length;
        const reviewBodyComments = reviews.filter((review) => Boolean(review.body?.trim())).length;
        const commitComments = commitCommentGroups.reduce((total, group) => total + group.length, 0);
        const reviewComments = inlineComments + conversationCommentCount + reviewBodyComments + commitComments;

        return [
          pullRequest.number,
          {
            reviewCount: reviews.length,
            reviewComments,
            conversationComments: conversationCommentCount,
            inlineComments,
            reviewBodyComments,
            commitComments,
            changeRequests,
            approvals,
            issueCount: reviewComments + changeRequests
          }
        ] as const;
      } catch (err) {
        const message = err instanceof Error ? err.message : "GitHub review signal fetch failed.";
        warnings.push(`PR #${pullRequest.number} review signal skipped: ${message}`);
        return [
          pullRequest.number,
          {
            reviewCount: 0,
            reviewComments: 0,
            conversationComments: 0,
            inlineComments: 0,
            reviewBodyComments: 0,
            commitComments: 0,
            changeRequests: 0,
            approvals: 0,
            issueCount: 0
          }
        ] as const;
      }
    })
  );

  return {
    reviewSignals: new Map<number, PullRequestReviewSignal>(pairs),
    warnings
  };
};

const fetchGitLabCommits = async (connection: GitProviderConnection, sprint: SprintInfo) => {
  const commits: GitProviderCommit[] = [];
  const maxPages = gitMaxPagesLimit();

  for (let page = 1; page <= maxPages; page += 1) {
    const url = gitLabUrl(connection, "/repository/commits");
    url.searchParams.set("ref_name", connection.defaultBranch || "main");
    url.searchParams.set("since", sprintStartIso(sprint));
    url.searchParams.set("until", sprintEndIso(sprint));
    url.searchParams.set("with_stats", "true");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const pageCommits = await gitLabJson<GitLabCommitListItem[]>(url, connection);
    commits.push(...pageCommits.map(gitLabCommitToProviderShape));

    if (pageCommits.length < 100) {
      break;
    }
  }

  return commits;
};

const fetchGitLabCommitDetails = async (connection: GitProviderConnection, commits: GitProviderCommit[]) => {
  const detailLimit = gitCommitDetailLimit();
  if (!detailLimit) {
    return commits;
  }

  const detailedCommits = await Promise.all(
    commits.slice(0, detailLimit).map((commit) => {
      const url = gitLabUrl(connection, `/repository/commits/${encodeURIComponent(commit.sha)}`);
      return gitLabJson<GitLabCommitListItem>(url, connection).then(gitLabCommitToProviderShape).catch(() => commit);
    })
  );

  return [...detailedCommits, ...commits.slice(detailLimit)];
};

const fetchGitLabMergeRequests = async (connection: GitProviderConnection) => {
  const url = gitLabUrl(connection, "/merge_requests");
  url.searchParams.set("state", "opened");
  url.searchParams.set("order_by", "updated_at");
  url.searchParams.set("sort", "desc");
  url.searchParams.set("per_page", "100");

  const mergeRequests = await gitLabJson<GitLabMergeRequestListItem[]>(url, connection);
  return mergeRequests.map(gitLabMergeRequestToProviderShape);
};

const fetchGitLabMergeRequestCommits = async (
  connection: GitProviderConnection,
  pullRequests: GitProviderPullRequest[]
) => {
  const pairs = await Promise.all(
    pullRequests.map(async (pullRequest) => {
      const url = gitLabUrl(connection, `/merge_requests/${pullRequest.number}/commits`);
      url.searchParams.set("per_page", "100");

      const commits = await gitLabJson<GitLabCommitListItem[]>(url, connection).catch(() => []);
      const shapedCommits = commits.map(gitLabCommitToProviderShape);
      const detailedCommits = await fetchGitLabCommitDetails(connection, shapedCommits);
      return [pullRequest.number, detailedCommits] as const;
    })
  );

  return new Map(pairs);
};

const fetchGitLabMergeRequestFiles = async (connection: GitProviderConnection, pullRequest: GitProviderPullRequest) => {
  const url = gitLabUrl(connection, `/merge_requests/${pullRequest.number}/diffs`);
  url.searchParams.set("per_page", "100");

  const diffs = await gitLabJson<GitLabMergeRequestDiff[]>(url, connection).catch(async (err) => {
    const changesUrl = gitLabUrl(connection, `/merge_requests/${pullRequest.number}/changes`);
    const changes = await gitLabJson<GitLabMergeRequestChangesResponse>(changesUrl, connection).catch(() => {
      throw err;
    });
    return changes.changes ?? [];
  });
  return diffs.map(gitLabDiffToPullRequestFile);
};

const fetchGitLabMergeRequestReviewSignals = async (
  connection: GitProviderConnection,
  pullRequests: GitProviderPullRequest[]
) => {
  const warnings: string[] = [];
  const pairs = await Promise.all(
    pullRequests.map(async (pullRequest) => {
      const notesUrl = gitLabUrl(connection, `/merge_requests/${pullRequest.number}/notes`);
      const discussionsUrl = gitLabUrl(connection, `/merge_requests/${pullRequest.number}/discussions`);
      const approvalsUrl = gitLabUrl(connection, `/merge_requests/${pullRequest.number}/approvals`);
      notesUrl.searchParams.set("per_page", "100");
      discussionsUrl.searchParams.set("per_page", "100");

      try {
        const [notes, discussions, approvals] = await Promise.all([
          gitLabJson<GitLabNote[]>(notesUrl, connection),
          gitLabJson<GitLabDiscussion[]>(discussionsUrl, connection),
          gitLabJson<GitLabApprovalState>(approvalsUrl, connection).catch(() => ({ approved_by: [] }))
        ]);
        const uniqueNotesById = new Map<string, GitLabNote>();
        const visibleNotes = notes.filter((note) => !note.system && Boolean(note.body?.trim()));
        const discussionNotes = discussions
          .flatMap((discussion) => discussion.notes ?? [])
          .filter((note) => !note.system && Boolean(note.body?.trim()));
        for (const note of [...visibleNotes, ...discussionNotes]) {
          uniqueNotesById.set(String(note.id), note);
        }
        const uniqueNotes = Array.from(uniqueNotesById.values());
        const inlineComments = uniqueNotes.filter((note) => Boolean(note.position) || note.type === "DiffNote").length;
        const conversationComments = uniqueNotes.length - inlineComments;
        const approvalsByReviewer = new Set(
          (approvals.approved_by ?? [])
            .map((approval) => normalizedGitValue(approval.user?.username))
            .filter(Boolean)
        );
        const reviewComments = uniqueNotes.length;

        return [
          pullRequest.number,
          {
            reviewCount: approvalsByReviewer.size,
            reviewComments,
            conversationComments,
            inlineComments,
            reviewBodyComments: 0,
            commitComments: 0,
            changeRequests: 0,
            approvals: approvalsByReviewer.size,
            issueCount: reviewComments
          }
        ] as const;
      } catch (err) {
        const message = err instanceof Error ? err.message : "GitLab review signal fetch failed.";
        warnings.push(`MR !${pullRequest.number} review signal skipped: ${message}`);
        return [
          pullRequest.number,
          {
            reviewCount: 0,
            reviewComments: 0,
            conversationComments: 0,
            inlineComments: 0,
            reviewBodyComments: 0,
            commitComments: 0,
            changeRequests: 0,
            approvals: 0,
            issueCount: 0
          }
        ] as const;
      }
    })
  );

  return {
    reviewSignals: new Map<number, PullRequestReviewSignal>(pairs),
    warnings
  };
};

export const gitCommitDate = (commit: GitProviderCommit) =>
  commit.commit.author?.date ?? commit.commit.committer?.date ?? "";

export const gitCommitInSprint = (commit: GitProviderCommit, sprint: SprintInfo) => {
  const rawDate = gitCommitDate(commit);
  if (!rawDate) {
    return true;
  }

  const commitTime = new Date(rawDate).getTime();
  return (
    !Number.isNaN(commitTime) &&
    commitTime >= new Date(sprintStartIso(sprint)).getTime() &&
    commitTime <= new Date(sprintEndIso(sprint)).getTime()
  );
};

export const mergeGitCommits = (commits: GitProviderCommit[]) => {
  const seen = new Set<string>();

  return commits.filter((commit) => {
    if (!commit.sha || seen.has(commit.sha)) {
      return false;
    }

    seen.add(commit.sha);
    return true;
  });
};

export const fetchGitCommits = (provider: GitProvider, connection: GitProviderConnection, sprint: SprintInfo) =>
  provider === "gitlab" ? fetchGitLabCommits(connection, sprint) : fetchGithubCommits(connection, sprint);

export const fetchGitCommitDetails = (provider: GitProvider, connection: GitProviderConnection, commits: GitProviderCommit[]) =>
  provider === "gitlab" ? fetchGitLabCommitDetails(connection, commits) : fetchGithubCommitDetails(connection, commits);

export const fetchGitPullRequests = (provider: GitProvider, connection: GitProviderConnection) =>
  provider === "gitlab" ? fetchGitLabMergeRequests(connection) : fetchGithubPullRequests(connection);

export const fetchGitPullRequestCommits = (
  provider: GitProvider,
  connection: GitProviderConnection,
  pullRequests: GitProviderPullRequest[]
) =>
  provider === "gitlab"
    ? fetchGitLabMergeRequestCommits(connection, pullRequests)
    : fetchGithubPullRequestCommits(connection, pullRequests);

export const fetchGitPullRequestFiles = (
  provider: GitProvider,
  connection: GitProviderConnection,
  pullRequest: GitProviderPullRequest
) =>
  provider === "gitlab"
    ? fetchGitLabMergeRequestFiles(connection, pullRequest)
    : fetchGithubPullRequestFiles(connection, pullRequest);

export const fetchGitPullRequestReviewSignals = (
  provider: GitProvider,
  connection: GitProviderConnection,
  pullRequests: GitProviderPullRequest[]
) =>
  provider === "gitlab"
    ? fetchGitLabMergeRequestReviewSignals(connection, pullRequests)
    : fetchGithubPullRequestReviewSignals(connection, pullRequests);
