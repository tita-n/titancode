import z from "zod"
import { Tool } from "./tool"

export const TaskManagementReadTool = Tool.define("task_management_read", async () => {
  return {
    description: "Read tasks, projects, pages, boards from task management tools (Notion, Asana, Monday). Configure provider in settings.",
    parameters: z.object({
      action: z.enum(["list_projects", "list_tasks", "get_task", "search", "list_pages", "get_board"]),
      provider: z.enum(["notion", "asana", "monday"]).optional().describe("Provider: notion, asana, or monday"),
      project_id: z.string().optional().describe("Project/Board ID"),
      task_id: z.string().optional().describe("Task ID"),
      query: z.string().optional().describe("Search query"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.TASK_PROVIDER || "notion"
      const token = process.env[`${provider.toUpperCase()}_TOKEN`]

      if (!token) throw new Error(`Set ${provider.toUpperCase()}_TOKEN env var`)

      switch (provider) {
        case "notion": {
          const notionUrl = "https://api.notion.com/v1"
          const headers = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" }
          
          switch (params.action) {
            case "list_projects": {
              const response = await fetch(`${notionUrl}/search`, { method: "POST", headers, body: JSON.stringify({ query: "", filter: { property: "object", value: "database" }, page_size: 20 }) })
              const data = await response.json()
              const list = data.results?.map((r: any) => `${r.id}: ${r.properties?.Name?.title?.[0]?.plain_text || "(no title)"}`).join("\n") || "No databases"
              return { title: "Notion Databases", metadata: { count: data.results?.length || 0 }, output: list }
            }
            case "list_tasks": {
              if (!params.project_id) throw new Error("project_id (database ID) required")
              const response = await fetch(`${notionUrl}/databases/${params.project_id}/query`, { method: "POST", headers, body: JSON.stringify({ page_size: 20 }) })
              const data = await response.json()
              const list = data.results?.map((r: any) => `${r.id}: ${r.properties?.Name?.title?.[0]?.plain_text || "(no title)"}`).join("\n") || "No pages"
              return { title: "Notion Tasks", metadata: { count: data.results?.length || 0 }, output: list }
            }
            case "get_task": {
              if (!params.task_id) throw new Error("task_id required")
              const response = await fetch(`${notionUrl}/pages/${params.task_id}`, { headers })
              const r = await response.json()
              return { title: "Notion Page", metadata: { id: r.id }, output: `Title: ${r.properties?.Name?.title?.[0]?.plain_text || "(no title)"}` }
            }
            case "search": {
              if (!params.query) throw new Error("query required")
              const response = await fetch(`${notionUrl}/search`, { method: "POST", headers, body: JSON.stringify({ query: params.query, page_size: 20 }) })
              const data = await response.json()
              const list = data.results?.map((r: any) => `${r.id}: ${r.properties?.Name?.title?.[0]?.plain_text || r.object}`).join("\n") || "No results"
              return { title: `Search: ${params.query}`, metadata: { count: data.results?.length || 0 }, output: list }
            }
            case "list_pages": {
              const response = await fetch(`${notionUrl}/search`, { method: "POST", headers, body: JSON.stringify({ filter: { property: "object", value: "page" }, page_size: 20 }) })
              const data = await response.json()
              const list = data.results?.map((r: any) => `${r.id}: ${r.properties?.Name?.title?.[0]?.plain_text || "(no title)"}`).join("\n") || "No pages"
              return { title: "Notion Pages", metadata: { count: data.results?.length || 0 }, output: list }
            }
            default:
              throw new Error(`Action ${params.action} not supported`)
          }
        }

        case "asana": {
          const asanaUrl = "https://app.asana.com/api/1.0"
          const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

          switch (params.action) {
            case "list_projects": {
              const response = await fetch(`${asanaUrl}/projects`, { headers })
              const data = await response.json()
              const list = data.data?.map((p: any) => `${p.gid}: ${p.name}`).join("\n") || "No projects"
              return { title: "Asana Projects", metadata: { count: data.data?.length || 0 }, output: list }
            }
            case "list_tasks": {
              if (!params.project_id) throw new Error("project_id required")
              const response = await fetch(`${asanaUrl}/projects/${params.project_id}/tasks?limit=20`, { headers })
              const data = await response.json()
              const list = data.data?.map((t: any) => `${t.gid}: ${t.name} [${t.completed ? "done" : "open"}]`).join("\n") || "No tasks"
              return { title: "Asana Tasks", metadata: { count: data.data?.length || 0 }, output: list }
            }
            case "get_task": {
              if (!params.task_id) throw new Error("task_id required")
              const response = await fetch(`${asanaUrl}/tasks/${params.task_id}`, { headers })
              const t = await response.json()
              return { title: t.data?.name, metadata: { completed: t.data?.completed }, output: `Task: ${t.data?.name}\nCompleted: ${t.data?.completed}\nDue: ${t.data?.due_on || "none"}` }
            }
            default:
              throw new Error(`Action ${params.action} not supported for Asana`)
          }
        }

        case "monday": {
          const mondayUrl = "https://api.monday.com/v2"
          const headers = { Authorization: token, "Content-Type": "application/json" }

          switch (params.action) {
            case "list_boards": {
              const query = `query { boards(limit: 20) { id name } }`
              const response = await fetch(mondayUrl, { method: "POST", headers, body: JSON.stringify({ query }) })
              const data = await response.json()
              const list = data.data?.boards?.map((b: any) => `${b.id}: ${b.name}`).join("\n") || "No boards"
              return { title: "Monday Boards", metadata: {}, output: list }
            }
            case "list_tasks": {
              if (!params.project_id) throw new Error("board id required")
              const query = `query { boards(ids: [${params.project_id}]) { items_page(limit: 20) { items { id name state } } } }`
              const response = await fetch(mondayUrl, { method: "POST", headers, body: JSON.stringify({ query }) })
              const data = await response.json()
              const list = data.data?.boards?.[0]?.items_page?.items?.map((i: any) => `${i.id}: ${i.name} [${i.state}]`).join("\n") || "No items"
              return { title: "Monday Items", metadata: {}, output: list }
            }
            default:
              throw new Error(`Action ${params.action} not supported for Monday`)
          }
        }

        default:
          throw new Error(`Provider ${provider} not supported`)
      }
    },
  }
})
