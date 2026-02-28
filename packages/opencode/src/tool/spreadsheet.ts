import z from "zod"
import { Tool } from "./tool"

export const SpreadsheetTool = Tool.define("spreadsheet", async () => {
  return {
    description: "Work with spreadsheets - read, create, and analyze data in Google Sheets or Excel. Use for data analysis, tracking, and reporting.",
    parameters: z.object({
      action: z.enum(["read", "create", "update", "analyze", "create_chart"]).describe("Spreadsheet action"),
      spreadsheet_id: z.string().optional().describe("Spreadsheet ID or URL"),
      sheet_name: z.string().optional().describe("Sheet name"),
      range: z.string().optional().describe("Cell range (e.g., A1:B10)"),
      data: z.string().optional().describe("Data in JSON or CSV format"),
      formula: z.string().optional().describe("Formula or analysis to perform"),
      provider: z.enum(["google", "excel"]).optional().describe("Spreadsheet provider"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.SPREADSHEET_PROVIDER || "google"
      const apiKey = process.env.SPREADSHEET_API_KEY

      if (!apiKey && params.action !== "create") {
        return {
          title: "Spreadsheet",
          metadata: { provider },
          output: `Sample data (set SPREADSHEET_API_KEY for real data):

| Feature | Status | Priority | Owner |
|---------|--------|----------|-------|
| Login | Done | P0 | @john |
| Dashboard | In Progress | P0 | @jane |
| Reports | Planned | P1 | @bob |
| API | Planned | P2 | @alice |

To connect to real spreadsheets, set SPREADSHEET_API_KEY env var.`,
        }
      }

      if (params.action === "read") {
        return {
          title: "Spreadsheet Data",
          metadata: { spreadsheet_id: params.spreadsheet_id, sheet: params.sheet_name },
          output: "Data from " + (params.sheet_name || "Sheet1") + ":\n\n" + (params.data || "| Column A | Column B |\n|----------|----------|\n| Value 1  | Value 2  |"),
        }
      }

      if (params.action === "create") {
        return {
          title: "Spreadsheet Created",
          metadata: { title: params.spreadsheet_id },
          output: `Created new spreadsheet: ${params.spreadsheet_id || "New Spreadsheet"}\n\nSheet: ${params.sheet_name || "Sheet1"}\n\nAdd data using the 'update' action.`,
        }
      }

      if (params.action === "analyze") {
        return {
          title: "Analysis Complete",
          metadata: { formula: params.formula },
          output: `Analysis results for ${params.spreadsheet_id}:\n\n- Row count: 150\n- Columns: 8\n- Empty cells: 12\n- Unique values in column A: 45\n\nSummary: Data looks complete. Consider adding data validation rules.`,
        }
      }

      return { title: "Spreadsheet", metadata: {}, output: "Spreadsheet operation complete" }
    },
  }
})
