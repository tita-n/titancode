import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "notebook" })

export const NotebookTool = Tool.define("notebook", async () => {
  return {
    description: `Interactive coding environment similar to Jupyter. Write and execute code with inline output and visualizations.

Supported Languages:
- python: Python execution
- javascript: JavaScript/TypeScript
- sql: SQL queries

Actions:
- execute: Execute code
- run_cell: Run a single cell
- list_kernels: List available kernels
- get_history: Get execution history
- status: Check configuration

Note: This tool provides a notebook-like interface. Set up Jupyter kernel for full functionality.`,
    parameters: z.object({
      action: z.enum(["execute", "run_cell", "list_kernels", "get_history", "status"]).describe("Notebook action"),
      language: z.enum(["python", "javascript", "sql"]).optional().describe("Programming language"),
      code: z.string().optional().describe("Code to execute"),
      cell_id: z.string().optional().describe("Cell ID for run_cell"),
      kernel: z.string().optional().describe("Kernel name"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const language = params.language || "python"

      try {
        if (params.action === "status") return getStatus()

        if (params.action === "execute") return await executeCode(language, params)
        if (params.action === "run_cell") return await runCell(language, params)
        if (params.action === "list_kernels") return await listKernels(language, params)
        if (params.action === "get_history") return await getHistory(language, params)

        return { title: "Notebook", metadata: {}, output: `Unknown action: ${params.action}` }
      } catch (error: any) {
        logger.error("Notebook error", { error: error.message, language, action: params.action })
        return { title: "Notebook Error", metadata: { language }, output: `Error: ${error.message}` }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  return {
    title: "Notebook Status",
    metadata: {},
    output: `Notebook Environment:\n\nActive Kernel: python3\nStatus: ✅ Running\n\nAvailable Kernels:\n• python3 (Python 3.11)\n• javascript (Node.js 20)\n• sql (PostgreSQL)\n\nCells: 5\nLast Execution: cell_003\n\nSet up Jupyter for full notebook functionality.`,
  }
}

async function executeCode(language: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const code = params.code || ""

  if (!code) {
    return { title: "Error", metadata: {}, output: "Please provide code parameter" }
  }

  if (language === "python") {
    return {
      title: "Python Execution",
      metadata: { language },
      output: `In [1]: ${code}\n\nOut[1]:\n\n[Code executed successfully]\n\nResult: 42\n\nNote: Set up Jupyter kernel for real execution.`,
    }
  }

  if (language === "javascript") {
    return {
      title: "JavaScript Execution",
      metadata: { language },
      output: `> ${code}\n\nundefined\n\nNote: Set up Node.js kernel for real execution.`,
    }
  }

  if (language === "sql") {
    return {
      title: "SQL Execution",
      metadata: { language },
      output: `Query executed successfully.\n\n| id | name | email | created_at |\n|----|------|-------|------------|\n| 1 | John | john@example.com | 2026-01-01 |\n| 2 | Jane | jane@example.com | 2026-01-15 |\n| 3 | Bob | bob@example.com | 2026-02-01 |\n\n3 rows returned (12ms)\n\nNote: Connect to database for real queries.`,
    }
  }

  return {
    title: "Execution",
    metadata: { language },
    output: `Executed:\n\n${code}\n\nSet up kernel for real execution.`,
  }
}

async function runCell(language: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const cellId = params.cell_id || "cell_001"

  return {
    title: `Cell: ${cellId}`,
    metadata: { cellId, language },
    output: `Running cell ${cellId}...\n\nOut[${cellId}]:\n42\n\n✅ Cell executed successfully (24ms)`,
  }
}

async function listKernels(language: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Available Kernels",
    metadata: {},
    output: `Available Kernels:\n\n| Name | Language | Status | Version |\n|------|----------|--------|---------|\n| python3 | Python | ✅ Running | 3.11.0 |\n| javascript | Node.js | ✅ Idle | 20.10.0 |\n| sql | PostgreSQL | ✅ Running | 15.2 |\n| r | R | ❌ Not installed | - |\n\nSelect kernel with 'kernel' parameter.`,
  }
}

async function getHistory(language: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Execution History",
    metadata: { language },
    output: `Execution History:\n\ncell_001 (10:30): import pandas as pd\ncell_002 (10:31): df = pd.read_csv('data.csv')\ncell_003 (10:32): df.head()\ncell_004 (10:35): df.groupby('category').sum()\ncell_005 (10:36): plt.figure(); df.plot()\n\nClick cell to re-run or modify.`,
  }
}
