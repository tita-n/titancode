import z from "zod"
import { Tool } from "./tool"

export const JiraTool = Tool.define("jira", async () => {
  return {
    description: "Interact with Jira - manage issues, projects, and sprints.",
    parameters: z.object({
      action: z.enum(["list_issues", "get_issue", "create_issue", "transition_issue", "list_projects"]),
      url: z.string().optional().describe("Jira URL (or set JIRA_URL env var)"),
      email: z.string().optional().describe("Jira email (or set JIRA_EMAIL env var)"),
      token: z.string().optional().describe("Jira API token (or set JIRA_TOKEN env var)"),
      project: z.string().optional().describe("Project key"),
      issue_key: z.string().optional().describe("Issue key (e.g., PROJ-123)"),
      summary: z.string().optional().describe("Issue summary"),
      description: z.string().optional().describe("Issue description"),
      status: z.string().optional().describe("Status to transition to"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const url = params.url || process.env.JIRA_URL
      const email = params.email || process.env.JIRA_EMAIL
      const token = params.token || process.env.JIRA_TOKEN

      if (!url || !email || !token) {
        throw new Error("Jira credentials required. Set JIRA_URL, JIRA_EMAIL, JIRA_TOKEN env vars.")
      }

      const auth = Buffer.from(`${email}:${token}`).toString("base64")
      const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }

      switch (params.action) {
        case "list_issues": {
          const jql = params.project ? `project = ${params.project} ORDER BY created DESC` : "ORDER BY created DESC"
          const response = await fetch(`${url}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=20`, { headers })
          if (!response.ok) throw new Error(`Jira API error: ${response.status}`)
          const data = await response.json()
          const issues = data.issues.map((i: any) => `${i.key}: ${i.fields.summary} [${i.fields.status.name}]`)
          return { title: "Jira issues", metadata: { count: issues.length }, output: issues.join("\n") }
        }
        case "get_issue": {
          if (!params.issue_key) throw new Error("issue_key required")
          const response = await fetch(`${url}/rest/api/3/issue/${params.issue_key}`, { headers })
          if (!response.ok) throw new Error(`Jira API error: ${response.status}`)
          const i = await response.json()
          return {
            title: `${i.key}: ${i.fields.summary}`,
            metadata: { status: i.fields.status.name, type: i.fields.issuetype.name },
            output: `${i.key}: ${i.fields.summary}\nStatus: ${i.fields.status.name}\nType: ${i.fields.issuetype.name}\n\n${i.fields.description?.content?.[0]?.content?.[0]?.text || "(no description)"}`,
          }
        }
        case "create_issue": {
          if (!params.project || !params.summary) throw new Error("project and summary required")
          const body = { fields: { project: { key: params.project }, summary: params.summary, description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: params.description || "" }] }] }, issuetype: { name: "Task" } } }
          const response = await fetch(`${url}/rest/api/3/issue`, { method: "POST", headers, body: JSON.stringify(body) })
          if (!response.ok) throw new Error(`Jira API error: ${response.status}`)
          const i = await response.json()
          return { title: `Created ${i.key}`, metadata: { key: i.key }, output: `Created: ${i.key}` }
        }
        case "list_projects": {
          const response = await fetch(`${url}/rest/api/3/project`, { headers })
          if (!response.ok) throw new Error(`Jira API error: ${response.status}`)
          const projects = await response.json()
          const list = projects.map((p: any) => `${p.key}: ${p.name}`).join("\n")
          return { title: "Jira projects", metadata: { count: projects.length }, output: list }
        }
        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    },
  }
})
