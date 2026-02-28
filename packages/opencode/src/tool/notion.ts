import z from "zod"
import { Tool } from "./tool"

export const NotionTool = Tool.define("notion", async () => {
  return {
    description: "Interact with Notion - read/write pages and databases.",
    parameters: z.object({
      action: z.enum(["search", "get_page", "get_blocks", "create_page", "append_blocks"]),
      token: z.string().optional().describe("Notion token (or set NOTION_TOKEN env var)"),
      query: z.string().optional().describe("Search query"),
      page_id: z.string().optional().describe("Page ID"),
      parent_id: z.string().optional().describe("Parent page/database ID"),
      title: z.string().optional().describe("Page title"),
      content: z.string().optional().describe("Block content"),
      block_id: z.string().optional().describe("Block ID to append to"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const token = params.token || process.env.NOTION_TOKEN
      if (!token) throw new Error("Notion token required. Set NOTION_TOKEN env var.")
      const headers = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" }

      const baseUrl = "https://api.notion.com/v1"

      switch (params.action) {
        case "search": {
          if (!params.query) throw new Error("query required")
          const response = await fetch(`${baseUrl}/search`, { method: "POST", headers, body: JSON.stringify({ query: params.query, page_size: 20 }) })
          const data = await response.json()
          const results = data.results.map((r: any) => `${r.id}: ${r.properties?.title?.title?.[0]?.plain_text || r.object}`).join("\n")
          return { title: `Search: ${params.query}`, metadata: { count: data.results.length }, output: results || "No results" }
        }
        case "get_page": {
          if (!params.page_id) throw new Error("page_id required")
          const response = await fetch(`${baseUrl}/pages/${params.page_id}`, { headers })
          const p = await response.json()
          return { title: "Notion page", metadata: { id: p.id }, output: `Title: ${p.properties?.title?.title?.[0]?.plain_text || "(no title)"}` }
        }
        case "get_blocks": {
          if (!params.page_id) throw new Error("page_id required")
          const response = await fetch(`${baseUrl}/blocks/${params.page_id}/children?page_size=50`, { headers })
          const data = await response.json()
          const blocks = data.results.map((b: any) => `${b.type}: ${b[b.type]?.plain_text || b[b.type]?.rich_text?.[0]?.plain_text || ""}`.slice(0, 80)).join("\n")
          return { title: "Page blocks", metadata: { count: data.results.length }, output: blocks }
        }
        case "create_page": {
          if (!params.parent_id || !params.title) throw new Error("parent_id and title required")
          const body = { parent: { page_id: params.parent_id }, properties: { title: { title: [{ text: { content: params.title } }] } } }
          const response = await fetch(`${baseUrl}/pages`, { method: "POST", headers, body: JSON.stringify(body) })
          const p = await response.json()
          return { title: "Created page", metadata: { id: p.id }, output: `Created: ${p.id}` }
        }
        case "append_blocks": {
          if (!params.block_id || !params.content) throw new Error("block_id and content required")
          const body = { children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: params.content } }] } }] }
          const response = await fetch(`${baseUrl}/blocks/${params.block_id}/children`, { method: "PATCH", headers, body: JSON.stringify(body) })
          return { title: "Added block", metadata: {}, output: "Block added successfully" }
        }
        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    },
  }
})
