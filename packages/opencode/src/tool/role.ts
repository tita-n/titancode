import z from "zod"
import { Tool } from "./tool"
import { listRoles, getRole, type Role } from "../role/role"
import { Question } from "../question"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Identifier } from "../id/id"
import { Provider } from "../provider/provider"
import { PermissionNext } from "@/permission/next"

const ROLE_KEY = "current_role"

async function getLastModel(sessionID: string) {
  for await (const item of MessageV2.stream(sessionID)) {
    if (item.info.role === "user" && item.info.model) return item.info.model
  }
  return Provider.defaultModel()
}

async function getCurrentAgent(sessionID: string): Promise<string> {
  for await (const item of MessageV2.stream(sessionID)) {
    if (item.info.role === "user" && item.info.agent) return item.info.agent
  }
  return "build"
}

async function executeExit(ctx: any) {
  const session = await Session.get(ctx.sessionID)
        
  const userMsg: MessageV2.User = {
    id: Identifier.ascending("message"),
    sessionID: ctx.sessionID,
    role: "user",
    time: { created: Date.now() },
    agent: "build",
    model: await getLastModel(ctx.sessionID),
  }
  await Session.updateMessage(userMsg)
  await Session.setPermission({
    sessionID: session.id,
    permission: [],
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: userMsg.id,
    sessionID: ctx.sessionID,
    type: "text",
    text: `Exited role. Using default build agent with full tool access.`,
    synthetic: true,
  } satisfies MessageV2.TextPart)

  return {
    title: "Exited Role",
    metadata: { role: null },
    output: "Exited role. Using default build agent with full tool access.",
  }
}

export const RoleTool = Tool.define("role", async () => {
  const roles = await listRoles()
  const roleList = roles.map((r) => `- ${r.name}: ${r.description}`).join("\n")

  return {
    description: `Manage roles for specialized task handling.

Available roles:
${roleList}

Commands:
- /role list - Show all available roles
- /role <name> - Switch to a specific role
- /role exit - Exit current role and return to default build agent

Roles define what tools are available and how the agent behaves.`,
    parameters: z.object({
      action: z.enum(["list", "switch", "exit"]).describe("Action to perform"),
      role_name: z.string().describe("Name of the role to switch to").optional(),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      if (params.action === "list") {
        const roles = await listRoles()
        const output = roles.map((r) => `${r.name}: ${r.description}`).join("\n")
        return { title: "Available Roles", metadata: { roles: roles.map((r) => r.name) }, output }
      }

      if (params.action === "exit") {
        return executeExit(ctx)
      }

      if (params.action === "switch") {
        const roleName = params.role_name
        if (!roleName) throw new Error("role_name required for switch action")

        if (roleName === "exit" || roleName === "default" || roleName === "none") {
          return executeExit(ctx)
        }

        const role = await getRole(roleName)
        if (!role) {
          const available = (await listRoles()).map((r) => r.name).join(", ")
          throw new Error(`Role "${roleName}" not found. Available: ${available}`)
        }

        const currentAgent = await getCurrentAgent(ctx.sessionID)
        const isPlanMode = currentAgent === "plan"

        if (isPlanMode) {
          const answers = await Question.ask({
            sessionID: ctx.sessionID,
            questions: [
              {
                question: `Switch to role "${role.name}"? This will apply the role's permissions and switch to build mode to execute tasks.`,
                header: "Switch Role",
                custom: false,
                options: [
                  { label: "Yes", description: "Switch to " + role.name + " role and execute" },
                  { label: "No", description: "Stay in plan mode" },
                ],
              },
            ],
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })

          const answer = answers[0]?.[0]
          if (answer === "No" || !answer) {
            throw new Error("Role switch cancelled")
          }
        }

        const session = await Session.get(ctx.sessionID)
        const model = await getLastModel(ctx.sessionID)

        const permission: PermissionNext.Ruleset = [
          ...role.allowed_tools.map((tool) => ({ permission: tool, pattern: "*", action: "allow" as const })),
          { permission: "*", pattern: "*", action: "deny" },
          { permission: "question", pattern: "*", action: "allow" },
          { permission: "role", pattern: "*", action: "allow" },
          { permission: "agent_switch", pattern: "*", action: "allow" },
        ]

        const userMsg: MessageV2.User = {
          id: Identifier.ascending("message"),
          sessionID: ctx.sessionID,
          role: "user",
          time: { created: Date.now() },
          agent: "build",
          model,
        }
        await Session.updateMessage(userMsg)
        await Session.setPermission({
          sessionID: session.id,
          permission,
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          messageID: userMsg.id,
          sessionID: ctx.sessionID,
          type: "text",
          text: `Switched to role: ${role.name}. ${role.description}\n\nAllowed tools: ${role.allowed_tools.join(", ")}\n\n${role.system_prompt}`,
          synthetic: true,
        } satisfies MessageV2.TextPart)

        return {
          title: `Switched to ${role.name}`,
          metadata: { role: role.name, allowed_tools: role.allowed_tools },
          output: `Role changed to "${role.name}". Allowed tools: ${role.allowed_tools.join(", ")}`,
        }
      }

      throw new Error(`Unknown action: ${params.action}`)
    },
  }
})
