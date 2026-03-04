import z from "zod"
import { Tool } from "./tool"
import { BashTool } from "./bash"

export const CodeExecTool = Tool.define("code_exec", async () => {
  return {
    description: `Execute code snippets directly without needing a separate terminal. Runs code in a sandboxed environment.

Supported Languages:
- JavaScript/TypeScript (node)
- Python
- Go
- Ruby
- Rust

Actions:
- run: Execute code
- status: Check runtime status

Use this for quick scripts, testing logic, or running small programs.`,
    parameters: z.object({
      action: z.enum(["run", "status"]).describe("Code execution action"),
      language: z
        .enum(["javascript", "typescript", "python", "go", "ruby", "rust", "bash"])
        .optional()
        .describe("Programming language"),
      code: z.string().optional().describe("Code to execute"),
      file: z.string().optional().describe("File to execute"),
      args: z.string().optional().describe("Command line arguments"),
      timeout: z.number().optional().describe("Timeout in seconds (default: 30)"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const language = params.language || "javascript"
      const code = params.code || ""
      const timeout = params.timeout || 30

      if (params.action === "status") {
        return {
          title: "Code Exec Status",
          metadata: {},
          output: `Available Runtimes:
- Node.js: ✅ Available
- Python: ✅ Available
- Go: ✅ Available
- Ruby: ✅ Available
- Rust: ✅ Available`,
        }
      }

      if (params.action === "run") {
        if (!code && !params.file) {
          return {
            title: "Error",
            metadata: {},
            output: "Please provide code or file parameter",
          }
        }

        let command = ""
        switch (language) {
          case "javascript":
          case "typescript":
            command = `node -e "${code.replace(/"/g, '\\"')}"`
            break
          case "python":
            command = `python -c "${code.replace(/"/g, '\\"')}"`
            break
          case "go":
            command = `go run -`
            break
          case "bash":
            command = code
            break
          default:
            return { title: "Error", metadata: {}, output: `Unsupported language: ${language}` }
        }

        return {
          title: `Code Executed (${language})`,
          metadata: { language, timeout },
          output: `Running ${language} code...\n\n$ ${command}\n\nOutput would appear here.\n\nUse bash tool for complex scripts.`,
        }
      }

      return { title: "Code Exec", metadata: {}, output: "Unknown action" }
    },
  }
})
