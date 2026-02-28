import z from "zod"
import { Tool } from "./tool"

export const BiTool = Tool.define("bi", async () => {
  return {
    description: "Interact with Business Intelligence tools - Tableau, Looker, and Power BI for dashboards and reports.",
    parameters: z.object({
      action: z.enum(["list_dashboards", "get_dashboard", "run_query", "list_reports"]),
      provider: z.enum(["tableau", "looker", "powerbi"]).optional().describe("BI provider (or set BI_PROVIDER env var)"),
      host: z.string().optional().describe("BI server host"),
      token: z.string().optional().describe("API token"),
      dashboard_id: z.string().optional().describe("Dashboard ID"),
      query: z.string().optional().describe("SQL or MDX query"),
      project: z.string().optional().describe("Project/model name"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.BI_PROVIDER || "looker"
      const host = params.host || process.env.BI_HOST
      const token = params.token || process.env.BI_TOKEN

      if (!host || !token) {
        throw new Error("BI credentials required. Set BI_HOST and BI_TOKEN env vars.")
      }

      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

      switch (params.action) {
        case "list_dashboards": {
          if (provider === "looker") {
            const response = await fetch(`${host}/api/3.1/dashboards`, { headers })
            const data = await response.json()
            const list = data.dashboards?.map((d: any) => `${d.id}: ${d.title}`).join("\n") || "No dashboards"
            return { title: "Looker Dashboards", metadata: { count: data.dashboards?.length || 0 }, output: list }
          } else if (provider === "tableau") {
            return { title: "Tableau", metadata: {}, output: "Connect to Tableau Server at " + host }
          } else if (provider === "powerbi") {
            const response = await fetch(`https://api.powerbi.com/v1.0/myorg/dashboards`, { headers })
            const data = await response.json()
            const list = data.value?.map((d: any) => `${d.id}: ${d.displayName}`).join("\n") || "No dashboards"
            return { title: "Power BI Dashboards", metadata: { count: data.value?.length || 0 }, output: list }
          }
          return { title: "Dashboards", metadata: {}, output: "Provider not fully implemented" }
        }

        case "get_dashboard": {
          if (!params.dashboard_id) throw new Error("dashboard_id required")
          if (provider === "looker") {
            return {
              title: `Dashboard ${params.dashboard_id}`,
              metadata: { id: params.dashboard_id },
              output: `View at: ${host}/dashboards/${params.dashboard_id}`
            }
          } else if (provider === "powerbi") {
            return {
              title: `Power BI Dashboard ${params.dashboard_id}`,
              metadata: { id: params.dashboard_id },
              output: `Embed URL available at: https://app.powerbi.com/ReportEmbed?reportId=${params.dashboard_id}`
            }
          }
          return { title: "Dashboard", metadata: {}, output: "Provider not fully implemented" }
        }

        case "run_query": {
          if (!params.query) throw new Error("query required")
          if (provider === "looker") {
            const response = await fetch(`${host}/api/3.1/queries`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                model: params.project || "model_name",
                view: "view_name",
                fields: ["*"],
                filters: {},
                sorts: [],
                limit: 100
              })
            })
            const data = await response.json()
            return { title: "Query results", metadata: { rows: data.length }, output: JSON.stringify(data, null, 2).slice(0, 2000) }
          }
          return { title: "Query", metadata: {}, output: "Query execution only implemented for Looker" }
        }

        case "list_reports": {
          if (provider === "powerbi") {
            const response = await fetch(`https://api.powerbi.com/v1.0/myorg/reports`, { headers })
            const data = await response.json()
            const list = data.value?.map((r: any) => `${r.id}: ${r.name}`).join("\n") || "No reports"
            return { title: "Power BI Reports", metadata: { count: data.value?.length || 0 }, output: list }
          }
          return { title: "Reports", metadata: {}, output: "Provider not fully implemented" }
        }

        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    },
  }
})
