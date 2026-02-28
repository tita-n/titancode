import z from "zod"
import { Tool } from "./tool"

export const TaskManagementWriteTool = Tool.define("task_management_write", async () => {
  return {
    description: "Create tasks, update status, assign people in task management tools (Notion, Asana, Monday). Configure provider in settings.",
    parameters: z.object({
      action: z.enum(["create_task", "update_task", "delete_task", "create_page", "create_project", "assign_task"]),
      provider: z.enum(["notion", "asana", "monday"]).optional().describe("Provider: notion, asana, or monday"),
      project_id: z.string().optional().describe("Project/Board/Database ID"),
      task_id: z.string().optional().describe("Task ID to update"),
      title: z.string().optional().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      status: z.string().optional().describe("Status to set"),
      assignee: z.string().optional().describe("Assignee email or ID"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.TASK_PROVIDER || "notion"
      const token = process.env[(provider + "_TOKEN").toUpperCase()]

      if (!token) throw new Error("Set " + provider.toUpperCase() + "_TOKEN env var")

      if (provider === "notion") {
        const notionUrl = "https://api.notion.com/v1"
        const headers = { Authorization: "Bearer " + token, "Notion-Version": "2022-06-28", "Content-Type": "application/json" }

        if (params.action === "create_page" || params.action === "create_task") {
          if (!params.project_id || !params.title) throw new Error("project_id and title required")
          const body: any = { parent: { database_id: params.project_id }, properties: { Name: { title: [{ text: { content: params.title } }] } } }
          const response = await fetch(notionUrl + "/pages", { method: "POST", headers: headers, body: JSON.stringify(body) })
          const r = await response.json()
          return { title: "Created", metadata: { id: r.id }, output: "Created: " + r.id }
        }

        if (params.action === "update_task") {
          if (!params.task_id) throw new Error("task_id required")
          const body: any = { properties: {} }
          if (params.title) body.properties.Name = { title: [{ text: { content: params.title } }] }
          const response = await fetch(notionUrl + "/pages/" + params.task_id, { method: "PATCH", headers: headers, body: JSON.stringify(body) })
          return { title: "Updated task", metadata: {}, output: "Updated successfully" }
        }
      }

      if (provider === "asana") {
        const asanaUrl = "https://app.asana.com/api/1.0"
        const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" }

        if (params.action === "create_task") {
          if (!params.project_id || !params.title) throw new Error("project_id and title required")
          const body = { data: { name: params.title, projects: [params.project_id], notes: params.description || "" } }
          const response = await fetch(asanaUrl + "/tasks", { method: "POST", headers: headers, body: JSON.stringify(body) })
          const r = await response.json()
          return { title: "Created task", metadata: { id: r.data.gid }, output: "Created: " + r.data.gid }
        }

        if (params.action === "update_task") {
          if (!params.task_id) throw new Error("task_id required")
          const body: any = { data: {} }
          if (params.title) body.data.name = params.title
          if (params.status) body.data.completed = params.status === "done"
          const response = await fetch(asanaUrl + "/tasks/" + params.task_id, { method: "PUT", headers: headers, body: JSON.stringify(body) })
          return { title: "Updated task", metadata: {}, output: "Updated successfully" }
        }
      }

      if (provider === "monday") {
        const mondayUrl = "https://api.monday.com/v2"
        const headers = { Authorization: token, "Content-Type": "application/json" }

        if (params.action === "create_task") {
          if (!params.project_id || !params.title) throw new Error("board id and title required")
          const query = 'mutation { create_item(board_id: ' + params.project_id + ', item_name: "' + params.title + '") { id } }'
          const response = await fetch(mondayUrl, { method: "POST", headers: headers, body: JSON.stringify({ query: query }) })
          const r = await response.json()
          return { title: "Created item", metadata: { id: r.data.create_item.id }, output: "Created: " + r.data.create_item.id }
        }
      }

      throw new Error("Action " + params.action + " not supported for " + provider)
    },
  }
})
