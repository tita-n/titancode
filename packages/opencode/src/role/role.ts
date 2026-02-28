import fs from "fs"
import path from "path"

function parseYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {}
  const lines = content.split("\n")
  let currentKey = ""
  let currentList: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    if (trimmed.startsWith("- ")) {
      if (!currentKey) continue
      currentList.push(trimmed.slice(2))
      continue
    }

    if (currentKey) {
      if (currentList.length > 0) {
        result[currentKey] = currentList
        currentList = []
      } else if (result[currentKey]) {
        result[currentKey] += "\n" + result[currentKey]
      }
    }

    const colonIdx = trimmed.indexOf(":")
    if (colonIdx > 0) {
      currentKey = trimmed.slice(0, colonIdx).trim()
      const value = trimmed.slice(colonIdx + 1).trim()
      if (value) {
        result[currentKey] = value
        currentKey = ""
      }
    }
  }

  if (currentKey && currentList.length > 0) {
    result[currentKey] = currentList
  }

  return result
}

export interface Role {
  name: string
  description: string
  system_prompt: string
  allowed_tools: string[]
}

const roleCache = new Map<string, Role>()

export async function loadRoles(): Promise<Role[]> {
  const rolesDir = path.join(process.cwd(), "roles")
  if (!fs.existsSync(rolesDir)) return []

  const files = fs.readdirSync(rolesDir).filter((f) => f.endsWith(".yaml"))
  const roles: Role[] = []

  for (const file of files) {
    const cached = roleCache.get(file)
    if (cached) {
      roles.push(cached)
      continue
    }

    const content = fs.readFileSync(path.join(rolesDir, file), "utf-8")
    const parsed = parseYaml(content)
    const role: Role = {
      name: parsed.name || name,
      description: parsed.description || "",
      system_prompt: parsed.system_prompt || "",
      allowed_tools: parsed.allowed_tools || [],
    }
    roleCache.set(file, role)
    roles.push(role)
  }

  return roles
}

export async function getRole(name: string): Promise<Role | undefined> {
  const roles = await loadRoles()
  return roles.find((r) => r.name.toLowerCase() === name.toLowerCase())
}

export async function listRoles(): Promise<{ name: string; description: string }[]> {
  const roles = await loadRoles()
  return roles.map((r) => ({ name: r.name, description: r.description }))
}
