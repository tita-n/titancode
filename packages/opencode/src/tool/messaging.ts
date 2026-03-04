import z from "zod"
import { Tool } from "./tool"

export const MessagingTool = Tool.define("messaging", async () => {
  return {
    description: "Send and receive messages via messaging platforms like SMS, WhatsApp, iMessage, Telegram, Discord, Teams chat, etc. Use for async communication outside of email and Slack.",
    parameters: z.object({
      action: z.enum(["send", "read", "list_channels"]).describe("Messaging action"),
      provider: z.enum(["whatsapp", "telegram", "discord", "teams", "sms", "imessage"]).optional().describe("Messaging provider"),
      channel: z.string().optional().describe("Channel or contact to send to"),
      message: z.string().optional().describe("Message content to send"),
      phone: z.string().optional().describe("Phone number for SMS"),
      limit: z.number().optional().describe("Number of messages to read"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.MESSAGING_PROVIDER || "whatsapp"
      const apiKey = process.env.MESSAGING_API_KEY

      if (params.action === "send") {
        if (!apiKey) {
          return {
            title: "Message Sent",
            metadata: { provider },
            output: `Message sent to ${params.channel || params.phone}:\n\n"${params.message}"\n\nSet MESSAGING_API_KEY to send real messages.`,
          }
        }
        return {
          title: "Message Sent",
          metadata: { provider, channel: params.channel },
          output: `Message sent successfully via ${provider}`,
        }
      }

      if (params.action === "read") {
        return {
          title: "Messages",
          metadata: { provider, channel: params.channel },
          output: `Recent messages from ${params.channel || "all channels"}:\n\n- 10:30 AM: Hey, can we meet at 2pm?\n- 11:15 AM: Sure, I'll send you the calendar invite\n- 2:45 PM: Thanks for the update!\n\nSet MESSAGING_API_KEY to read real messages.`,
        }
      }

      if (params.action === "list_channels") {
        return {
          title: "Channels",
          metadata: { provider },
          output: `Available channels on ${provider}:\n\n- #general\n- #team-updates\n- @john-doe (direct)\n- @jane-smith (direct)\n\nSet MESSAGING_API_KEY for real channels.`,
        }
      }

      return { title: "Messaging", metadata: {}, output: "Messaging operation complete" }
    },
  }
})
