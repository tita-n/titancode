import z from "zod"
import { Tool } from "./tool"

export const TicketTool = Tool.define("ticket", async () => {
  return {
    description: "Manage project tickets/issues across Jira, Linear, or GitHub. Configure which provider to use in settings.",
    parameters: z.object({
      action: z.enum(["list", "get", "create", "update", "close", "reopen"]),
      provider: z.enum(["jira", "linear", "github"]).optional().describe("Ticket provider: jira, linear, or github"),
      project: z.string().optional().describe("Project key (Jira) or team (Linear)"),
      issue_key: z.string().optional().describe("Issue key (e.g., PROJ-123 or LIN-123)"),
      title: z.string().optional().describe("Ticket title"),
      description: z.string().optional().describe("Ticket description"),
      status: z.string().optional().describe("Status to transition to"),
      labels: z.array(z.string()).optional().describe("Labels to add"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.TICKET_PROVIDER || "github"
      
      const token = process.env[`${provider.toUpperCase()}_TOKEN`] || process.env.GITHUB_TOKEN
      const baseUrl = provider === "jira" ? (process.env.JIRA_URL || "") : provider === "linear" ? "https://api.linear.app/graphql" : "https://api.github.com"
      
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (provider === "github") headers.Authorization = `Bearer ${token}`
      else if (provider === "linear") headers.Authorization = `${token}`
      
      switch (params.action) {
        case "list": {
          if (provider === "github") {
            const proj = params.project ? `repo:${params.project}` : ""
            const res = await fetch(`https://api.github.com/search/issues?q=${proj}+is:issue+state:open&per_page=20`, { headers })
            const data = await res.json()
            const list = data.items?.map((i: any) => `#${i.number}: ${i.title}`).join("\n") || "No issues"
            return { title: "GitHub Issues", metadata: { count: data.items?.length || 0 }, output: list }
          } else if (provider === "linear") {
            const query = `query { issues(first: 20) { nodes { identifier title state { name } } } } }`
            const res = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({ query }) })
            const data = await res.json()
            const list = data.data?.issues?.nodes?.map((i: any) => `${i.identifier}: ${i.title} [${i.state.name}]`).join("\n") || "No issues"
            return { title: "Linear Issues", metadata: {}, output: list }
          } else {
            const jql = params.project ? `project = ${params.project}` : " ORDER BY created DESC"
            const res = await fetch(`${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=20`, { headers: { ...headers, Authorization: `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${token}`).toString("base64")}` } })
            const data = await res.json()
            const list = data.issues?.map((i: any) => `${i.key}: ${i.fields.summary}`).join("\n") || "No issues"
            return { title: "Jira Issues", metadata: {}, output: list }
          }
        }
        
        case "get": {
          if (!params.issue_key) throw new Error("issue_key required")
          if (provider === "github") {
            const [owner, repo, num] = params.issue_key.split("/")
            const res = await fetch(`https://api.github.com/repos/${owner || params.project}/${repo}/issues/${num}`, { headers })
            const i = await res.json()
            return { title: `#${i.number}: ${i.title}`, metadata: { state: i.state, labels: i.labels }, output: `${i.title}\nState: ${i.state}\n${i.body?.slice(0, 300) || ""}` }
          } else if (provider === "linear") {
            const query = `query { issue(identifier: "${params.issue_key}") { identifier title description state { name } } }`
            const res = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({ query }) })
            const i = await res.json()
            return { title: `${i.data?.issue?.identifier}: ${i.data?.issue?.title}`, metadata: {}, output: `${i.data?.issue?.title}\nStatus: ${i.data?.issue?.state?.name}` }
          } else {
            const res = await fetch(`${baseUrl}/rest/api/3/issue/${params.issue_key}`, { headers: { ...headers, Authorization: `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${token}`).toString("base64")}` } })
            const i = await res.json()
            return { title: `${i.key}: ${i.fields.summary}`, metadata: { status: i.fields.status.name }, output: `${i.fields.summary}\nStatus: ${i.fields.status.name}` }
          }
        }
        
        case "create": {
          if (!params.title) throw new Error("title required")
          if (provider === "github") {
            const [owner, repo] = (params.project || "").split("/")
            const res = await fetch(`https://api.github.com/repos/${owner}/issues`, { method: "POST", headers, body: JSON.stringify({ title: params.title, body: params.description }) })
            const i = await res.json()
            return { title: `Created #${i.number}`, metadata: { url: i.html_url }, output: `Created: ${i.html_url}` }
          } else if (provider === "linear") {
            const mutation = `mutation { issueCreate(input: { title: "${params.title}", teamId: "${params.project}" }) { success identifier } }`
            const res = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({ query: mutation }) })
            const d = await res.json()
            return { title: `Created ${d.data?.issueCreate?.identifier}`, metadata: {}, output: `Created: ${d.data?.issueCreate?.identifier}` }
          } else {
            const body = { fields: { project: { key: params.project }, summary: params.title, description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: params.description || "" }] }] }, issuetype: { name: "Task" } } }
            const res = await fetch(`${baseUrl}/rest/api/3/issue`, { method: "POST", headers: { ...headers, Authorization: `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${token}`).toString("base64")}` }, body: JSON.stringify(body) })
            const i = await res.json()
            return { title: `Created ${i.key}`, metadata: {}, output: `Created: ${i.key}` }
          }
        }
        
        default:
          throw new Error(`Action ${params.action} not fully implemented for ${provider}`)
      }
    },
  }
})
