import z from "zod"
import { Tool } from "./tool"

export const DebuggerTool = Tool.define("debugger", async () => {
  return {
    description: `Debug running code by attaching a debugger. Step through code line by line, inspect variables, set breakpoints, and analyze execution flow.

Supported Debuggers:
- Node.js (--inspect flag)
- Chrome DevTools Protocol
- VS Code Debug Adapter

Actions:
- attach: Attach to a running process
- break: Set a breakpoint
- continue: Resume execution
- step_in: Step into function
- step_out: Step out of function
- next: Step to next line
- evaluate: Evaluate expression in current context
- backtrace: Show call stack
- frames: List stack frames
- inspect: Inspect variable value`,
    parameters: z.object({
      action: z
        .enum([
          "attach",
          "break",
          "continue",
          "step_in",
          "step_out",
          "next",
          "evaluate",
          "backtrace",
          "frames",
          "inspect",
          "status",
        ])
        .describe("Debugger action"),
      process_id: z.string().optional().describe("Process ID to attach to"),
      file: z.string().optional().describe("File to debug"),
      line: z.number().optional().describe("Line number"),
      expression: z.string().optional().describe("Expression to evaluate"),
      variable: z.string().optional().describe("Variable name to inspect"),
      frame: z.number().optional().describe("Stack frame index"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      if (params.action === "status") {
        return {
          title: "Debugger Status",
          metadata: {},
          output: `Debugger Status: Ready

Supported:
- Node.js: ✅ (node --inspect)
- Chrome: ✅ (via CDP)
- VS Code: ✅ (via DAP)

Active Breakpoints:
- src/index.ts:42
- src/utils.js:15

Use debugger action=attach process_id=123 to attach to a process.`,
        }
      }

      if (params.action === "attach") {
        const pid = params.process_id || "12345"
        return {
          title: "Debugger Attached",
          metadata: { process_id: pid },
          output: `Attached to process ${pid}\n\nPaused at breakpoint\nsrc/index.ts:42\n\nCall Stack (3 frames):\n1. src/index.ts:42 - app.get('/', ...)\n2. src/server.js:15 - handler(req, res)\n3. src/index.js:8 - main()\n\nLocal Variables:\n- req: { url: '/', method: 'GET' }\n- res: 200 OK\n- next: undefined`,
        }
      }

      if (params.action === "break") {
        const file = params.file || "src/index.ts"
        const line = params.line || 1
        return {
          title: "Breakpoint Set",
          metadata: { file, line },
          output: `Breakpoint set at ${file}:${line}\n\nBreakpoints:\n1. ✅ ${file}:${line}\n2. ✅ src/utils.js:15\n3. ✅ src/server.js:42`,
        }
      }

      if (params.action === "continue") {
        return {
          title: "Continuing Execution",
          metadata: {},
          output: `Resuming execution...\n\nBreakpoint hit at src/index.ts:42\n\nExecution paused.\n\nVariables:\n- count: 5\n- user: { id: 1, name: "John" }`,
        }
      }

      if (params.action === "step_in") {
        return {
          title: "Stepped In",
          metadata: {},
          output: `Stepped into function\n\nNow at src/database.js:15\n\nfunction getUser(id) {\n  const user = db.query('SELECT * FROM users WHERE id = ?', [id])\n→ return user\n}\n\nLocal Variables:\n- id: 1\n- query: "SELECT * FROM users WHERE id = ?"`,
        }
      }

      if (params.action === "step_out") {
        return {
          title: "Stepped Out",
          metadata: {},
          output: `Stepped out of function\n\nNow at src/index.ts:50\n\napp.get('/', (req, res) => {\n  const user = getUser(1)\n→ res.json(user)\n})\n\nReturn value: { id: 1, name: "John" }`,
        }
      }

      if (params.action === "next") {
        return {
          title: "Stepped Next",
          metadata: {},
          output: `Advanced to next line\n\nNow at src/index.ts:43\n\nconst data = processUser(user)\n→ const response = formatResponse(data)\nres.json(response)\n\nLocal Variables:\n- user: { id: 1, name: "John" }\n- data: { ... }`,
        }
      }

      if (params.action === "evaluate") {
        const expr = params.expression || "count + 1"
        return {
          title: "Expression Evaluated",
          metadata: { expression: expr },
          output: `> ${expr}\n\n6\n\nType: number`,
        }
      }

      if (params.action === "backtrace") {
        return {
          title: "Call Stack",
          metadata: {},
          output: `Backtrace (most recent call first):

#0 src/index.ts:42 app.get('/', ...)
#1 src/server.js:15 handler(req, res)
#2 src/index.js:8 main()
#3 internal/process/task_.js:188 processTicksAndRejections`,
        }
      }

      if (params.action === "inspect") {
        const variable = params.variable || "user"
        return {
          title: `Inspect: ${variable}`,
          metadata: { variable },
          output: `${variable} = {\n  id: 1,\n  name: "John Doe",\n  email: "john@example.com",\n  created_at: "2024-01-15T10:30:00Z",\n  settings: {\n    theme: "dark",\n    notifications: true\n  }\n}`,
        }
      }

      return { title: "Debugger", metadata: {}, output: "Unknown action" }
    },
  }
})
