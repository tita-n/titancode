import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const log = Log.create({ tool: "github" })

export const GithubTool = Tool.define("github", async () => {
  return {
    description:
      "Interact with GitHub - manage issues, PRs, repos, and workflows. Use this to create issues, list PRs, check workflows, and manage repositories.",

    parameters: z.object({
      action: z
        .enum([
          "list_issues",
          "create_issue",
          "get_issue",
          "list_prs",
          "get_pr",
          "list_commits",
          "list_workflows",
          "run_workflow",
          "get_repo",
        ])
        .describe("The GitHub action to perform"),
      token: z.string().optional().describe("GitHub token (or set GITHUB_TOKEN env var)"),
      owner: z.string().optional().describe("Repository owner"),
      repo: z.string().optional().describe("Repository name"),
      issue_number: z.number().optional().describe("Issue number"),
      pr_number: z.number().optional().describe("PR number"),
      title: z.string().optional().describe("Issue/PR title"),
      body: z.string().optional().describe("Issue/PR body"),
      workflow_id: z.string().optional().describe("Workflow ID or name"),
      workflow_inputs: z.record(z.string(), z.string()).optional().describe("Workflow inputs"),
      state: z.enum(["open", "closed", "all"]).optional().describe("Filter by state"),
    }),

    async execute(
      params: any,
      ctx: any,
    ): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const token = params.token || process.env.GITHUB_TOKEN
      if (!token) {
        throw new Error("GitHub token required. Set GITHUB_TOKEN env var or provide token parameter.")
      }

      const { owner, repo } = params
      if (!owner || !repo) {
        throw new Error("owner and repo are required for most actions.")
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      }

      const baseUrl = "https://api.github.com"

      switch (params.action) {
        case "list_issues": {
          const state = params.state || "open"
          const response = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/issues?state=${state}&per_page=20`,
            { headers },
          )
          if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
          const data = await response.json()
          const issues = data.filter((i: any) => !i.pull_request)
          const list = issues.map((i: any) => `#${i.number}: ${i.title} [${i.state}]`)
          return {
            title: `Issues in ${owner}/${repo}`,
            metadata: { count: list.length },
            output: `Issues (${list.length}):\n${list.join("\n")}`,
          }
        }

        case "create_issue": {
          if (!params.title) throw new Error("title is required for create_issue")
          const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/issues`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ title: params.title, body: params.body || "" }),
          })
          if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
          const data = await response.json()
          return {
            title: `Created issue #${data.number}`,
            metadata: { number: data.number, url: data.html_url },
            output: `Created issue #${data.number}: ${data.html_url}`,
          }
        }

        case "get_issue": {
          if (!params.issue_number) throw new Error("issue_number is required for get_issue")
          const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/issues/${params.issue_number}`, {
            headers,
          })
          if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
          const data = await response.json()
          return {
            title: `Issue #${params.issue_number}: ${data.title}`,
            metadata: { state: data.state, comments: data.comments, labels: data.labels },
            output: `#${data.number}: ${data.title}\nState: ${data.state}\nLabels: ${data.labels.map((l: any) => l.name).join(", ")}\n\n${data.body?.slice(0, 500) || "(no body)"}`,
          }
        }

        case "list_prs": {
          const state = params.state || "open"
          const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls?state=${state}&per_page=20`, {
            headers,
          })
          if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
          const data = await response.json()
          const list = data.map((pr: any) => `#${pr.number}: ${pr.title} [${pr.state}] (${pr.user.login})`)
          return {
            title: `PRs in ${owner}/${repo}`,
            metadata: { count: list.length },
            output: `Pull Requests (${list.length}):\n${list.join("\n")}`,
          }
        }

        case "get_pr": {
          if (!params.pr_number) throw new Error("pr_number is required for get_pr")
          const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls/${params.pr_number}`, {
            headers,
          })
          if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
          const data = await response.json()
          return {
            title: `PR #${params.pr_number}: ${data.title}`,
            metadata: { state: data.state, additions: data.additions, deletions: data.deletions },
            output: `#${data.number}: ${data.title}\nState: ${data.state}\nBy: ${data.user.login}\n\n${data.body?.slice(0, 500) || "(no description)"}`,
          }
        }

        case "list_commits": {
          const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/commits?per_page=15`, { headers })
          if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
          const data = await response.json()
          const list = data.map((c: any) => `${c.sha.slice(0, 7)}: ${c.commit.message.split("\n")[0]} (${c.commit.author.name})`)
          return {
            title: `Recent commits in ${owner}/${repo}`,
            metadata: { count: list.length },
            output: `Commits:\n${list.join("\n")}`,
          }
        }

        case "list_workflows": {
          const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/workflows`, { headers })
          if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
          const data = await response.json()
          const list = data.workflows.map((w: any) => `${w.id}: ${w.name} [${w.state}]`)
          return {
            title: `Workflows in ${owner}/${repo}`,
            metadata: { count: list.length },
            output: `Workflows:\n${list.join("\n")}`,
          }
        }

        case "run_workflow": {
          if (!params.workflow_id) throw new Error("workflow_id is required for run_workflow")
          const response = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/actions/workflows/${params.workflow_id}/dispatches`,
            {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({
                ref: params.workflow_inputs?.ref || "main",
                inputs: params.workflow_inputs || {},
              }),
            },
          )
          if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
          return {
            title: `Triggered workflow ${params.workflow_id}`,
            metadata: {},
            output: `Workflow ${params.workflow_id} triggered successfully`,
          }
        }

        case "get_repo": {
          const response = await fetch(`${baseUrl}/repos/${owner}/${repo}`, { headers })
          if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
          const data = await response.json()
          return {
            title: `${owner}/${repo}`,
            metadata: {
              stars: data.stargazers_count,
              forks: data.forks_count,
              open_issues: data.open_issues_count,
              language: data.language,
            },
            output: `${data.full_name}\nStars: ${data.stargazers_count} | Forks: ${data.forks_count}\nLanguage: ${data.language}\n${data.description || ""}`,
          }
        }

        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    },
  }
})
