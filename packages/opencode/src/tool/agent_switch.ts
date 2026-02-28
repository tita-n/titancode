import z from "zod"
import { Tool } from "./tool"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Identifier } from "../id/id"
import { Provider } from "../provider/provider"

async function getLastModel(sessionID: string) {
  for await (const item of MessageV2.stream(sessionID)) {
    if (item.info.role === "user" && item.info.model) return item.info.model
  }
  return Provider.defaultModel()
}

async function getCurrentRole(sessionID: string): Promise<string | null> {
  for await (const item of MessageV2.stream(sessionID)) {
    if (item.info.role === "user" && item.info.agent) {
      for (const part of item.parts ?? []) {
        if (part.type === "text" && part.text?.includes("Switched to role:")) {
          const match = part.text.match(/Switched to role: ([^\.]+)/)
          if (match) return match[1]
        }
      }
    }
  }
  return null
}

export const AgentSwitchTool = Tool.define("agent_switch", async () => {
  return {
    description: `Switch between agents.

Commands:
- /build - Switch to build agent (default, full tool access)
- /plan - Switch to plan mode (read-only, no editing)

Use /build to exit a role and return to full tool access.`,
    parameters: z.object({
      agent: z.enum(["build", "plan"]).describe("Agent to switch to"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const agent = params.agent
      const model = await getLastModel(ctx.sessionID)
      const currentRole = await getCurrentRole(ctx.sessionID)

      if (currentRole && agent === "build") {
        await Session.setPermission({
          sessionID: ctx.sessionID,
          permission: [],
        })
      }

      const userMsg: MessageV2.User = {
        id: Identifier.ascending("message"),
        sessionID: ctx.sessionID,
        role: "user",
        time: { created: Date.now() },
        agent: agent,
        model,
      }
      await Session.updateMessage(userMsg)

      const message = agent === "build" 
        ? "Switched to build agent. Full tool access enabled."
        : "Switched to plan mode. Edit tools are disabled."

      await Session.updatePart({
        id: Identifier.ascending("part"),
        messageID: userMsg.id,
        sessionID: ctx.sessionID,
        type: "text",
        text: message,
        synthetic: true,
      } satisfies MessageV2.TextPart)

      return {
        title: `Switched to ${agent}`,
        metadata: { agent },
        output: message,
      }
    },
  }
})
