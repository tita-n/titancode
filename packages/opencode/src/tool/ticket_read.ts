import z from "zod"
import { Tool } from "./tool"
import { TicketTool } from "./ticket"

export const TicketReadTool = Tool.define("ticket_read", async () => {
  return {
    description: "Read tickets from Jira, Linear, or GitHub. Use to view issues, check status, and search tickets.",
    parameters: z.object({
      action: z.enum(["list", "get", "search"]).describe("Read action"),
      provider: z.enum(["jira", "linear", "github"]).optional().describe("Ticket provider"),
      project: z.string().optional().describe("Project/Repository"),
      issue_key: z.string().optional().describe("Issue key"),
      query: z.string().optional().describe("Search query"),
      status: z.string().optional().describe("Filter by status"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const ticketParams = {
        action: params.action === "search" ? "list" : params.action,
        provider: params.provider,
        project: params.project,
        issue_key: params.issue_key,
      }
      
      const result = await (await TicketTool.init()).execute(ticketParams, ctx)
      return result
    },
  }
})
