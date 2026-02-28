import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const log = Log.create({ tool: "figma" })

export const FigmaTool = Tool.define("figma", async () => {
  return {
    description:
      "Access Figma designs, components, and files. Use this to read design files, get component details, export assets, and review designs programmatically.",

    parameters: z.object({
      action: z
        .enum(["get_file", "get_components", "get_styles", "export", "comments", "get_nodes"])
        .describe("The Figma action to perform"),
      access_token: z.string().optional().describe("Figma access token (or set FIGMA_ACCESS_TOKEN env var)"),
      file_key: z.string().optional().describe("Figma file key (from Figma URL)"),
      node_ids: z.array(z.string()).optional().describe("Node IDs to fetch"),
      format: z.enum(["png", "svg", "jpg", "pdf"]).optional().describe("Export format"),
      scale: z.number().optional().describe("Export scale (1, 2, 3, or 4)"),
    }),

    async execute(
      params: {
        action: string
        access_token?: string
        file_key?: string
        node_ids?: string[]
        format?: string
        scale?: number
      },
      ctx: any,
    ): Promise<{ title: string; metadata: Record<string, unknown>; output: string }> {
      const accessToken = params.access_token || process.env.FIGMA_ACCESS_TOKEN
      if (!accessToken) {
        throw new Error(
          "Figma access token required. Set FIGMA_ACCESS_TOKEN env var or provide access_token parameter.",
        )
      }

      const baseUrl = "https://api.figma.com/v1"
      const headers = { "X-Figma-Token": accessToken }

      switch (params.action) {
        case "get_file": {
          if (!params.file_key) throw new Error("file_key is required for get_file action")
          const response = await fetch(`${baseUrl}/files/${params.file_key}`, { headers })
          if (!response.ok) {
            throw new Error(`Figma API error: ${response.status} ${response.statusText}`)
          }
          const data = await response.json()
          return {
            title: `Figma file: ${params.file_key}`,
            metadata: { name: data.name, lastModified: data.lastModified, version: data.version },
            output: `File: ${data.name}\nLast modified: ${data.lastModified}\nVersion: ${data.version}\nPages: ${data.document.children.length}`,
          }
        }

        case "get_components": {
          if (!params.file_key) throw new Error("file_key is required for get_components action")
          const response = await fetch(`${baseUrl}/files/${params.file_key}/components`, { headers })
          if (!response.ok) {
            throw new Error(`Figma API error: ${response.status}`)
          }
          const data = await response.json()
          const components = data.meta?.components || {}
          const list = Object.entries(components).map(([id, c]: [string, any]) => `${c.name} (${id})`)
          return {
            title: `Components in ${params.file_key}`,
            metadata: { count: list.length },
            output: `Components (${list.length}):\n${list.slice(0, 50).join("\n")}`,
          }
        }

        case "get_styles": {
          if (!params.file_key) throw new Error("file_key is required for get_styles action")
          const response = await fetch(`${baseUrl}/files/${params.file_key}/styles`, { headers })
          if (!response.ok) {
            throw new Error(`Figma API error: ${response.status}`)
          }
          const data = await response.json()
          const styles = data.meta?.styles || {}
          const list = Object.entries(styles).map(([id, s]: [string, any]) => `${s.name} - ${s.style_type} (${id})`)
          return {
            title: `Styles in ${params.file_key}`,
            metadata: { count: list.length },
            output: `Styles (${list.length}):\n${list.slice(0, 50).join("\n")}`,
          }
        }

        case "export": {
          if (!params.file_key || !params.node_ids?.length) {
            throw new Error("file_key and node_ids are required for export action")
          }
          const ids = params.node_ids.join(",")
          const scale = params.scale || 2
          const format = params.format || "png"
          const response = await fetch(
            `${baseUrl}/images/${params.file_key}?ids=${ids}&format=${format}&scale=${scale}`,
            { headers },
          )
          if (!response.ok) {
            throw new Error(`Figma API error: ${response.status}`)
          }
          const data = await response.json()
          const images = data.images || {}
          const list = Object.entries(images).map(([id, url]: [string, any]) => `${id}: ${url}`)
          return {
            title: `Exported ${list.length} images`,
            metadata: { count: list.length, images },
            output: `Exported ${list.length} images:\n${list.join("\n")}`,
          }
        }

        case "comments": {
          if (!params.file_key) throw new Error("file_key is required for comments action")
          const response = await fetch(`${baseUrl}/files/${params.file_key}/comments`, { headers })
          if (!response.ok) {
            throw new Error(`Figma API error: ${response.status}`)
          }
          const data = await response.json()
          const comments = data.comments || []
          const list = comments.map(
            (c: any) => `${c.user.handle}: ${c.message} (${new Date(c.created_at).toLocaleDateString()})`,
          )
          return {
            title: `Comments on ${params.file_key}`,
            metadata: { count: list.length },
            output: `Comments (${list.length}):\n${list.join("\n")}`,
          }
        }

        case "get_nodes": {
          if (!params.file_key || !params.node_ids?.length) {
            throw new Error("file_key and node_ids are required for get_nodes action")
          }
          const ids = params.node_ids.join(",")
          const response = await fetch(`${baseUrl}/files/${params.file_key}/nodes?ids=${ids}`, { headers })
          if (!response.ok) {
            throw new Error(`Figma API error: ${response.status}`)
          }
          const data = await response.json()
          const nodes = data.nodes || {}
          const list = Object.entries(nodes).map(([id, n]: [string, any]) => {
            const node = n.document
            return `${id}: ${node.type} - ${node.name}`
          })
          return {
            title: `Fetched ${list.length} nodes`,
            metadata: { count: list.length, nodes },
            output: `Nodes:\n${list.join("\n")}`,
          }
        }

        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    },
  }
})
