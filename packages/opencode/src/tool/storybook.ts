import z from "zod"
import { Tool } from "./tool"

export const StorybookTool = Tool.define("storybook", async () => {
  return {
    description: "Interact with Storybook - browse, test, and document UI components in isolation.",
    parameters: z.object({
      action: z.enum(["list_components", "get_stories", "build", "start", "get_docs"]),
      url: z.string().optional().describe("Storybook URL (or set STORYBOOK_URL)"),
      component: z.string().optional().describe("Component name or path"),
      story: z.string().optional().describe("Story name"),
      port: z.number().optional().describe("Port for local storybook (default 6006)"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const url = params.url || process.env.STORYBOOK_URL || "http://localhost:6006"

      switch (params.action) {
        case "list_components": {
          try {
            const response = await fetch(`${url}/iframe.html`, { method: "HEAD" })
            if (!response.ok) {
              return { title: "Storybook not running", metadata: {}, output: `Storybook not found at ${url}. Start it with 'npm run storybook' or 'yarn storybook'` }
            }
          } catch {
            return { title: "Storybook unreachable", metadata: {}, output: `Cannot reach Storybook at ${url}` }
          }
          return {
            title: "Storybook available",
            metadata: { url },
            output: `Storybook is running at ${url}\n\nUse get_stories with a component name to see stories.`
          }
        }

        case "get_stories": {
          if (!params.component) throw new Error("component name required")
          return {
            title: `Stories for ${params.component}`,
            metadata: { component: params.component },
            output: `Component: ${params.component}\n\nStories available at:\n${url}/?path=/story/${params.component.toLowerCase()}--default\n\nAdd ?path=/story/${params.component.toLowerCase()}--<storyname> to view specific story.`
          }
        }

        case "build": {
          return {
            title: "Storybook build",
            metadata: {},
            output: "Run 'npm run build-storybook' or 'yarn build-storybook' to build static Storybook."
          }
        }

        case "start": {
          return {
            title: "Start Storybook",
            metadata: { port: params.port || 6006 },
            output: `Run 'npm run storybook' or 'yarn storybook' to start Storybook on port ${params.port || 6006}`
          }
        }

        case "get_docs": {
          if (!params.component) throw new Error("component name required")
          return {
            title: `Docs for ${params.component}`,
            metadata: { component: params.component },
            output: `Docs available at:\n${url}/?path=/docs/${params.component.toLowerCase()}-docs`
          }
        }

        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    },
  }
})
