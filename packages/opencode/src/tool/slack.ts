import z from "zod"
import { Tool } from "./tool"

export const SlackTool = Tool.define("slack", async () => {
  return {
    description: "Send messages and interact with Slack channels.",
    parameters: z.object({
      action: z.enum(["send_message", "list_channels", "get_channel"]),
      token: z.string().optional().describe("Slack bot token (or set SLACK_TOKEN env var)"),
      channel: z.string().optional().describe("Channel ID or name"),
      message: z.string().optional().describe("Message text"),
      ts: z.string().optional().describe("Message timestamp for threading"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const token = params.token || process.env.SLACK_TOKEN
      if (!token) throw new Error("Slack token required. Set SLACK_TOKEN env var.")

      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

      switch (params.action) {
        case "send_message": {
          if (!params.channel || !params.message) throw new Error("channel and message required")
          const body: any = { channel: params.channel, text: params.message }
          if (params.ts) body.thread_ts = params.ts
          const response = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers, body: JSON.stringify(body) })
          const data = await response.json()
          if (!data.ok) throw new Error(`Slack error: ${data.error}`)
          return { title: "Message sent", metadata: { ts: data.ts, channel: data.channel }, output: `Sent to ${data.channel}: ${data.ts}` }
        }
        case "list_channels": {
          const response = await fetch("https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=50", { headers })
          const data = await response.json()
          if (!data.ok) throw new Error(`Slack error: ${data.error}`)
          const channels = data.channels.map((c: any) => `${c.id}: ${c.name}`).join("\n")
          return { title: "Slack channels", metadata: { count: data.channels.length }, output: channels }
        }
        case "get_channel": {
          if (!params.channel) throw new Error("channel required")
          const response = await fetch(`https://slack.com/api/conversations.info?channel=${params.channel}`, { headers })
          const data = await response.json()
          if (!data.ok) throw new Error(`Slack error: ${data.error}`)
          return {
            title: `#${data.channel.name}`,
            metadata: { members: data.channel.num_members, topic: data.channel.topic?.value },
            output: `#${data.channel.name}\nMembers: ${data.channel.num_members}\nTopic: ${data.channel.topic?.value || "(none)"}`,
          }
        }
        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    },
  }
})
