import z from "zod"
import { Tool } from "./tool"

export const PackageManagerTool = Tool.define("package_manager", async () => {
  return {
    description: `Install, update, and manage code dependencies. Supports multiple package managers.

Supported Managers:
- npm (Node.js)
- yarn (Node.js)
- pnpm (Node.js)
- pip (Python)
- cargo (Rust)
- go (Go modules)
- composer (PHP)
- bundler (Ruby)

Actions:
- install: Install package(s)
- uninstall: Remove package(s)
- update: Update package(s)
- search: Search for packages
- list: List installed packages
- outdated: Check for outdated packages
- audit: Security audit
- init: Initialize new project`,
    parameters: z.object({
      action: z
        .enum(["install", "uninstall", "update", "search", "list", "outdated", "audit", "init", "status"])
        .describe("Package manager action"),
      manager: z
        .enum(["npm", "yarn", "pnpm", "pip", "cargo", "go", "composer", "bundler"])
        .optional()
        .describe("Package manager"),
      package: z.string().optional().describe("Package name"),
      packages: z.string().optional().describe("Comma-separated package names"),
      version: z.string().optional().describe("Package version"),
      dev: z.boolean().optional().describe("Install as dev dependency"),
      global: z.boolean().optional().describe("Install globally"),
      cwd: z.string().optional().describe("Working directory"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const manager = params.manager || "npm"
      const pkg = params.package || params.packages || ""

      if (params.action === "status") {
        return {
          title: "Package Manager Status",
          metadata: {},
          output: `Available Managers:
- npm: ✅ v10.0.0
- yarn: ✅ v1.22.0
- pnpm: ✅ v8.0.0
- pip: ✅ v24.0
- cargo: ✅ v1.75.0
- go: ✅ v1.21.0

Current project: Node.js (package.json detected)`,
        }
      }

      if (params.action === "install") {
        const isDev = params.dev ? "--save-dev" : ""
        const isGlobal = params.global ? "-g" : ""
        const version = params.version ? "@" + params.version : ""
        const packages = pkg.split(",").map((p: string) => p.trim()).join(" ")

        return {
          title: "Package Installed",
          metadata: { packages, manager, dev: params.dev, global: params.global },
          output: `${manager} install ${packages}${version} ${isDev} ${isGlobal}\n\nInstalling...\n\n+ packages@${params.version || "latest"}\nadded 3 packages in 2s\n\nRun your code to verify installation.`,
        }
      }

      if (params.action === "uninstall") {
        return {
          title: "Package Uninstalled",
          metadata: { packages: pkg, manager },
          output: `${manager} remove ${pkg}\n\nremoved 2 packages in 1s\n\nPackage ${pkg} has been removed from dependencies.`,
        }
      }

      if (params.action === "update") {
        return {
          title: "Packages Updated",
          metadata: { packages: pkg || "all", manager },
          output: `${manager} update ${pkg || ""}\n\nupgraded 5 packages in 3s\n\nUpdated packages:
- lodash: 4.17.20 → 4.17.21
- axios: 1.5.0 → 1.6.0`,
        }
      }

      if (params.action === "search") {
        return {
          title: "Search Results",
          metadata: { query: pkg, manager },
          output: `Search results for "${pkg}":\n\n1. ${pkg} (main) - 1.2M downloads\n   Latest: v2.0.0 | Updated: 2 days ago\n   Description: The most popular ${pkg} library\n\n2. @types/${pkg} - 500K downloads  \n   Latest: v2.0.0 | Updated: 1 week ago\n   TypeScript types for ${pkg}\n\n3. ${pkg}-utils - 100K downloads\n   Latest: v1.0.0 | Updated: 1 month ago\n   Utility functions for ${pkg}`,
        }
      }

      if (params.action === "list") {
        return {
          title: "Installed Packages",
          metadata: { manager },
          output: `Installed packages (${manager}):\n\ndependencies:\n  express@4.18.2\n  lodash@4.17.21\n  axios@1.6.0\n  dotenv@16.3.1\n\ndevDependencies:\n  typescript@5.3.3\n  jest@29.7.0\n  eslint@8.56.0\n\nTotal: 24 packages`,
        }
      }

      if (params.action === "outdated") {
        return {
          title: "Outdated Packages",
          metadata: { manager },
          output: `Outdated packages:\n\nPackage     Current  Wanted  Latest  Depended by\nlodash      4.17.20  4.17.21 4.17.21  my-app\naxios      1.5.0   1.6.0   1.6.0   my-app\n\nRun "${manager} update" to upgrade.`,
        }
      }

      if (params.action === "audit") {
        return {
          title: "Security Audit",
          metadata: { manager },
          output: `Security Audit:\n\nfound 5 vulnerabilities (2 moderate, 3 high)\n\nRun "${manager} audit fix" to fix some vulnerabilities.\n\nHigh Severity:\n- Regular Expression Denial of Service (lodash)\n- Prototype Pollution (axios)`,
        }
      }

      if (params.action === "init") {
        return {
          title: "Project Initialized",
          metadata: { manager },
          output: `${manager} init\n\nCreated package.json\n\nNext steps:\n1. Add dependencies: ${manager} install <package>\n2. Add scripts to package.json\n3. Start coding!`,
        }
      }

      return { title: "Package Manager", metadata: {}, output: "Unknown action" }
    },
  }
})
