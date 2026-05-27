import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

type CommentAuthorAssociation =
  | "COLLABORATOR"
  | "CONTRIBUTOR"
  | "FIRST_TIMER"
  | "FIRST_TIME_CONTRIBUTOR"
  | "MANNEQUIN"
  | "MEMBER"
  | "NONE"
  | "OWNER";

type GhReviewComment = {
  author: { login: string } | null;
  authorAssociation: CommentAuthorAssociation;
  body: string;
  createdAt: string;
  url: string;
};

type GhReviewThread = {
  comments: { nodes: GhReviewComment[] };
  id: string;
  isOutdated: boolean;
  isResolved: boolean;
  line: number | null;
  path: string;
  startLine: number | null;
};

type GhPageInfo = {
  endCursor: string | null;
  hasNextPage: boolean;
};

type GhThreadsConnection = {
  nodes: GhReviewThread[];
  pageInfo: GhPageInfo;
};

type GhGraphQlResponse = {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads: GhThreadsConnection;
      } | null;
    } | null;
  };
};

type PrView = {
  baseRefName: string;
  number: number;
  title: string;
  url: string;
};

type RepoIdentity = {
  owner: string;
  repo: string;
};

const CONTRIBUTOR_ASSOCIATIONS = new Set<CommentAuthorAssociation>([
  "COLLABORATOR",
  "CONTRIBUTOR",
  "MEMBER",
  "OWNER"
]);

const DISMISSAL_PATTERNS = [
  /\bnot needed\b/i,
  /\bno need(?:ed)?\b/i,
  /\bunnecessary\b/i,
  /\bnot required\b/i,
  /\bignore (?:this|it)\b/i,
  /\bfalse positive\b/i,
  /\binvalid (?:issue|comment|concern)\b/i,
  /\b(?:this|that) is wrong\b/i,
  /\bincorrect\b/i,
  /\bnot applicable\b/i,
  /\balready handled\b/i,
  /\balready fixed\b/i
];

const GRAPHQL_QUERY = `
query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          comments(first: 100) {
            nodes {
              body
              createdAt
              url
              authorAssociation
              author {
                login
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
`;

const GH_WINDOWS_CANDIDATES = [
  "C:\\Program Files\\GitHub CLI\\gh.exe",
  "C:\\Program Files (x86)\\GitHub CLI\\gh.exe",
  `${process.env.LOCALAPPDATA ?? ""}\\Programs\\GitHub CLI\\gh.exe`,
  `${process.env.USERPROFILE ?? ""}\\AppData\\Local\\Microsoft\\WindowsApps\\gh.exe`
];

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: "utf8" });
}

function resolveGhExecutable(): string {
  const configured = process.env.GH_PATH?.trim();
  if (configured) return configured;

  try {
    run("gh", ["--version"]);
    return "gh";
  } catch {
    // Continue to Windows fallback candidates.
  }

  if (process.platform === "win32") {
    for (const candidate of GH_WINDOWS_CANDIDATES) {
      if (candidate.length > 0 && existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return "gh";
}

function runGh(args: string[]): string {
  const ghExecutable = resolveGhExecutable();
  return run(ghExecutable, args);
}

function getOriginRemoteUrl(): string {
  return run("git", ["remote", "get-url", "origin"]).trim();
}

function parseJson<T>(payload: string, sourceName: string): T {
  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    throw new Error(`Could not parse JSON from ${sourceName}: ${String(error)}`);
  }
}

function parseOwnerAndRepoFromRemoteUrl(remoteUrl: string): RepoIdentity {
  const trimmed = remoteUrl.trim();
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    const owner = sshMatch[1];
    const repo = sshMatch[2];
    return { owner, repo };
  }

  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (httpsMatch) {
    const owner = httpsMatch[1];
    const repo = httpsMatch[2];
    return { owner, repo };
  }

  throw new Error(`Could not parse origin remote URL: ${remoteUrl}`);
}

function getCurrentBranchName(): string {
  const branch = run("git", ["branch", "--show-current"]).trim();
  if (branch.length === 0) {
    throw new Error("Could not determine current branch name.");
  }
  return branch;
}

function isContributorDismissalComment(comment: GhReviewComment): boolean {
  if (!CONTRIBUTOR_ASSOCIATIONS.has(comment.authorAssociation)) return false;
  const trimmedBody = comment.body.trim();
  if (trimmedBody.length === 0) return false;

  return DISMISSAL_PATTERNS.some((pattern) => pattern.test(trimmedBody));
}

export function shouldIncludeThread(thread: GhReviewThread): boolean {
  if (thread.isResolved) return false;
  if (thread.isOutdated) return false;

  const comments = thread.comments.nodes;
  if (comments.length === 0) return false;

  return !comments.some((comment) => isContributorDismissalComment(comment));
}

function excerpt(body: string): string {
  const condensed = body.replace(/\s+/g, " ").trim();
  if (condensed.length <= 120) return condensed;
  return `${condensed.slice(0, 117)}...`;
}

function getCurrentBranchPr(owner: string, repo: string, branch: string): PrView {
  const payload = runGh([
    "api",
    `repos/${owner}/${repo}/pulls`,
    "--method",
    "GET",
    "-f",
    "state=open",
    "-f",
    `head=${owner}:${branch}`,
    "-f",
    "per_page=1"
  ]);
  const pulls = parseJson<Array<{
    number?: unknown;
    title?: unknown;
    html_url?: unknown;
    base?: { ref?: unknown } | null;
  }>>(payload, "gh api repos/{owner}/{repo}/pulls");

  const pr = pulls[0];
  if (!pr) {
    throw new Error(`Could not find an open PR for branch "${branch}" in ${owner}/${repo}.`);
  }

  if (typeof pr.number !== "number") throw new Error("PR response missing number.");
  if (typeof pr.title !== "string") throw new Error("PR response missing title.");
  if (typeof pr.html_url !== "string") throw new Error("PR response missing html_url.");
  if (typeof pr.base?.ref !== "string") throw new Error("PR response missing base.ref.");

  return {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    baseRefName: pr.base.ref
  };
}

function getAllReviewThreads(owner: string, repo: string, number: number): GhReviewThread[] {
  const threads: GhReviewThread[] = [];
  let after: string | null = null;

  while (true) {
    const args = [
      "api",
      "graphql",
      "-f",
      `query=${GRAPHQL_QUERY}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${repo}`,
      "-F",
      `number=${number}`
    ];

    if (after) {
      args.push("-f", `after=${after}`);
    }

    const payload = runGh(args);
    const parsed = parseJson<GhGraphQlResponse>(payload, "gh api graphql");
    const connection = parsed.data?.repository?.pullRequest?.reviewThreads;

    if (!connection) {
      throw new Error(`Could not read review threads for PR #${number}.`);
    }

    threads.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) break;
    after = connection.pageInfo.endCursor;
    if (!after) break;
  }

  return threads;
}

function printThreadReport(pr: PrView, threads: GhReviewThread[]): void {
  console.log(`PR #${pr.number}: ${pr.title}`);
  console.log(pr.url);
  console.log(`Base branch: ${pr.baseRefName}`);
  console.log("");

  if (threads.length === 0) {
    console.log("No unresolved review threads matched the active filter.");
    return;
  }

  const byPath = new Map<string, GhReviewThread[]>();
  for (const thread of threads) {
    const existing = byPath.get(thread.path);
    if (existing) {
      existing.push(thread);
    } else {
      byPath.set(thread.path, [thread]);
    }
  }

  const orderedPaths = Array.from(byPath.keys()).sort((left, right) => left.localeCompare(right));
  let threadCount = 0;

  for (const path of orderedPaths) {
    console.log(`File: ${path}`);
    const pathThreads = byPath.get(path) ?? [];
    pathThreads.sort((left, right) => (left.line ?? left.startLine ?? 0) - (right.line ?? right.startLine ?? 0));

    for (const thread of pathThreads) {
      threadCount += 1;
      const comments = thread.comments.nodes;
      const leadComment = comments[0];
      const latestComment = comments[comments.length - 1];
      const line = thread.line ?? thread.startLine;
      const lineLabel = line ? `L${line}` : "L?";
      const latestAuthor = latestComment.author?.login ?? "unknown";

      console.log(`  ${threadCount}. ${lineLabel} (${comments.length} comment${comments.length === 1 ? "" : "s"})`);
      console.log(`     URL: ${leadComment.url}`);
      console.log(`     Latest: @${latestAuthor} on ${latestComment.createdAt}`);
      console.log(`     Note: ${excerpt(leadComment.body)}`);
    }

    console.log("");
  }

  console.log(`Total unresolved threads: ${threadCount}`);
}

function main(): void {
  try {
    const identity = parseOwnerAndRepoFromRemoteUrl(getOriginRemoteUrl());
    const branch = getCurrentBranchName();
    const pr = getCurrentBranchPr(identity.owner, identity.repo, branch);
    const allThreads = getAllReviewThreads(identity.owner, identity.repo, pr.number);
    const included = allThreads.filter((thread) => shouldIncludeThread(thread));

    printThreadReport(pr, included);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Could not collect pull request comments.");
    console.error("Ensure GitHub CLI is installed and authenticated (`gh auth status`).");
    console.error(detail);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  main();
}
