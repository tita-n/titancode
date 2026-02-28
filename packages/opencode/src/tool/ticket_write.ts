import z from "zod"
import { Tool } from "./tool"
import { TicketTool } from "./ticket"

export const TicketWriteTool = Tool.define("ticket_write", async () => {
  return {
    description: "Write/update tickets in Jira, Linear, or GitHub. Use to create, update, or transition tickets.",
    parameters: z.object({
      action: z.enum(["create", "update", "close", "reopen", "assign"]).describe("Write action"),
      provider: z.enum(["jira", "linear", "github"]).optional().describe("Ticket provider"),
      project: z.string().optional().describe("Project/Repository"),
      issue_key: z.string().optional().describe("Issue key to update"),
      title: z.string().optional().describe("Ticket title (for create)"),
      description: z.string().optional().describe("Ticket description"),
      status: z.string().optional().describe("Status to set"),
      assignee: z.string().optional().describe("Assignee"),
      labels: z.array(z.string()).optional().describe("Labels"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const ticketParams = {
        action: params.action === "assign" ? "update" : params.action,
        provider: params.provider,
        project: params.project,
        issue_key: params.issue_key,
        title: params.title,
        description: params.description,
        status: params.status,
        labels: params.labels,
      }
      
      const result = await (await TicketTool.init()).execute(ticketParams, ctx)
      return result
    },
  }
})
