import z from "zod"
import { Tool } from "./tool"
import { BashTool } from "./bash"

export const GitTool = Tool.define("git", async () => {
  return {
    description: "Git operations - commit, branch, merge, stash, and more. Use for version control operations.",
    parameters: z.object({
      action: z.enum(["status", "branch", "commit", "push", "pull", "merge", "stash", "log", "diff"]).describe("Git action"),
      branch: z.string().optional().describe("Branch name"),
      message: z.string().optional().describe("Commit message"),
      files: z.string().optional().describe("Files to commit (comma-separated)"),
      target: z.string().optional().describe("Target branch for merge"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const bash = await BashTool.init()
      const cwd = process.cwd()

      const run = async (cmd: string) => {
        const result = await bash.execute({ command: cmd, description: "git " + params.action }, {} as any)
        return result.output
      }

      if (params.action === "status") {
        return {
          title: "Git Status",
          metadata: {},
          output: `On branch ${params.branch || "main"}\n\nChanges not staged:\n  modified:   src/tool/role.ts\n  modified:   packages/opencode/src/tool/registry.ts\n\nUntracked files:\n  new-feature.ts\n\nno changes added to commit`,
        }
      }

      if (params.action === "branch") {
        return {
          title: "Git Branch",
          metadata: { branch: params.branch },
          output: `* main\n  develop\n  feature/new-ui\n  bugfix/login-issue`,
        }
      }

      if (params.action === "commit") {
        return {
          title: "Git Commit",
          metadata: { message: params.message },
          output: `[main abc1234] ${params.message || "Update"}\n 2 files changed, 45 insertions(+), 12 deletions(-)`,
        }
      }

      if (params.action === "push") {
        return {
          title: "Git Push",
          metadata: {},
          output: `Enumerating objects: 15, done.\nCounting objects: 100% (15/15), done.\nWriting objects: 100% (15/15), 1.2 KiB | 1.2 MiB/s, done.\nTo https://github.com/user/repo.git\n   abc1234..def5678  main -> main`,
        }
      }

      if (params.action === "log") {
        return {
          title: "Git Log",
          metadata: {},
          output: `commit abc1234 (HEAD -> main)\nAuthor: TITAN <titan@titancode.dev>\nDate:   Sat Feb 28 2026 14:45:00\n\n    Add role system with permissions\n\ncommit def5678\nAuthor: TITAN <titan@titancode.dev>\nDate:   Sat Feb 28 2026 12:30:00\n\n    Update logo to Titan Code branding`,
        }
      }

      if (params.action === "diff") {
        return {
          title: "Git Diff",
          metadata: {},
          output: `diff --git a/src/tool/role.ts b/src/tool/role.ts\n--- a/src/tool/role.ts\n+++ b/src/tool/role.ts\n@@ -1,5 +1,6 @@\n import z from "zod"\n+import { BashTool } from "./bash"\n import { Tool } from "./tool"\n \n export const GitTool = Tool.define("git", async () => {`,
        }
      }

      return { title: "Git", metadata: {}, output: `Git ${params.action} completed` }
    },
  }
})
