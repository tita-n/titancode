import z from "zod"
import { Tool } from "./tool"
import { $ } from "bun"

export const DockerTool = Tool.define("docker", async () => {
  return {
    description: "Manage Docker containers, images, and operations.",
    parameters: z.object({
      action: z.enum(["list_containers", "list_images", "pull_image", "run_container", "stop_container", "logs"]),
      image: z.string().optional().describe("Image name"),
      container: z.string().optional().describe("Container ID or name"),
      command: z.string().optional().describe("Command to run"),
      detach: z.boolean().optional().describe("Run in detached mode"),
      ports: z.string().optional().describe("Port mappings (e.g., 8080:80)"),
      name: z.string().optional().describe("Container name"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      switch (params.action) {
        case "list_containers": {
          const result = await $`docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"`.text()
          const containers = result.trim().split("\n").filter(Boolean)
          if (!containers[0]) return { title: "No containers", metadata: {}, output: "No containers found" }
          const list = containers.map((c: string) => c.replace(/\|/g, " | ")).join("\n")
          return { title: "Docker containers", metadata: { count: containers.length }, output: `ID | Name | Image | Status | Ports\n${list}` }
        }
        case "list_images": {
          const result = await $`docker images --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}"`.text()
          const images = result.trim().split("\n").filter(Boolean)
          if (!images[0]) return { title: "No images", metadata: {}, output: "No images found" }
          const list = images.map((i: string) => i.replace(/\|/g, " | ")).join("\n")
          return { title: "Docker images", metadata: { count: images.length }, output: `REPOSITORY | TAG | SIZE | ID\n${list}` }
        }
        case "pull_image": {
          if (!params.image) throw new Error("image required")
          const result = await $`docker pull ${params.image}`.text()
          return { title: `Pulled ${params.image}`, metadata: {}, output: result }
        }
        case "run_container": {
          if (!params.image) throw new Error("image required")
          let cmd = `docker run`
          if (params.detach) cmd += " -d"
          if (params.name) cmd += ` --name ${params.name}`
          if (params.ports) cmd += ` -p ${params.ports}`
          cmd += ` ${params.image}`
          if (params.command) cmd += ` ${params.command}`
          const result = await $`${cmd}`.text()
          return { title: `Started container`, metadata: {}, output: result.slice(0, 100) }
        }
        case "stop_container": {
          if (!params.container) throw new Error("container required")
          await $`docker stop ${params.container}`.text()
          return { title: "Container stopped", metadata: {}, output: `Stopped ${params.container}` }
        }
        case "logs": {
          if (!params.container) throw new Error("container required")
          const result = await $`docker logs --tail 50 ${params.container}`.text()
          return { title: `Logs for ${params.container}`, metadata: {}, output: result.slice(0, 5000) }
        }
        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    },
  }
})
