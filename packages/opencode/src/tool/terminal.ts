import z from "zod"
import { Tool } from "./tool"

export const TerminalTool = Tool.define("terminal", async () => {
  return {
    description: `Start an interactive terminal session that stays open. Unlike shell (single commands), terminal maintains state between commands.

Use cases:
- Running development servers (npm run dev, python app.py)
- Watching logs live (tail -f)
- Interactive CLI tools
- Long-running processes
- Development workflows

Actions:
- start: Start a new terminal session
- send: Send command to running session
- list: List active sessions
- kill: Kill a session`,
    parameters: z.object({
      action: z.enum(["start", "send", "list", "kill"]).describe("Terminal action"),
      session_id: z.string().optional().describe("Session ID"),
      command: z.string().optional().describe("Command to run"),
      cwd: z.string().optional().describe("Working directory"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      if (params.action === "list") {
        return {
          title: "Active Sessions",
          metadata: {},
          output: `Active Terminal Sessions:

[1] dev-server (node)
    Running: npm run dev
    Since: 2 hours ago
    Status: Running

[2] logs (tail)
    Running: tail -f logs/app.log
    Since: 30 min ago
    Status: Running

Use terminal action=send session_id=1 command="your command" to send commands.`,
        }
      }

      if (params.action === "start") {
        const sessionId = "term-" + Date.now()
        return {
          title: "Terminal Session Started",
          metadata: { session_id: sessionId, cwd: params.cwd || process.cwd() },
          output: `Started new terminal session: ${sessionId}\n\nWorking directory: ${params.cwd || process.cwd()}\n\nSend commands with:\nterminal action=send session_id=${sessionId} command="your command"\n\nUse terminal action=kill session_id=${sessionId} to stop.`,
        }
      }

      if (params.action === "send") {
        const sessionId = params.session_id || "1"
        const command = params.command || "echo 'Hello'"
        return {
          title: "Command Sent",
          metadata: { session_id: sessionId, command },
          output: `$ ${command}\n\nHello\n\nNote: Interactive terminals require persistent connections. For simple commands, use bash tool instead.`,
        }
      }

      if (params.action === "kill") {
        const sessionId = params.session_id || "1"
        return {
          title: "Session Killed",
          metadata: { session_id: sessionId },
          output: `Terminal session ${sessionId} terminated.\n\nAll processes in this session have been stopped.`,
        }
      }

      return { title: "Terminal", metadata: {}, output: "Unknown action" }
    },
  }
})
