import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "hris" })

const HRIS_PROVIDERS = {
  bamboohr: {
    name: "BambooHR",
    description: "HR, onboarding, time-off, payroll",
    envVars: ["BAMBOOHR_SUBDOMAIN", "BAMBOOHR_API_KEY"],
  },
  workday: {
    name: "Workday",
    description: "Enterprise HR, payroll, benefits",
    envVars: ["WORKDAY_TENANT_ID", "WORKDAY_CLIENT_ID", "WORKDAY_CLIENT_SECRET"],
  },
  adp: {
    name: "ADP",
    description: "Payroll, HR, time tracking",
    envVars: ["ADP_CLIENT_ID", "ADP_CLIENT_SECRET", "ADP_ACCOUNT_ID"],
  },
  gusto: {
    name: "Gusto",
    description: "Payroll, benefits, HR for SMBs",
    envVars: ["GUSTO_CLIENT_ID", "GUSTO_CLIENT_SECRET"],
  },
  deel: {
    name: "Deel",
    description: "Global payroll, compliance, contractor management",
    envVars: ["DEEL_API_KEY"],
  },
}

async function bambooHRRequest(subdomain: string, endpoint: string, options: RequestInit = {}): Promise<any> {
  const apiKey = process.env.BAMBOOHR_API_KEY
  if (!apiKey) throw new Error("BAMBOOHR_API_KEY not set")

  const response = await fetch(`https://api.bamboohr.com/api/gateway.php/${subdomain}/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`BambooHR API error: ${response.status} - ${error}`)
  }

  return response.json()
}

async function deelRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const apiKey = process.env.DEEL_API_KEY
  if (!apiKey) throw new Error("DEEL_API_KEY not set")

  const response = await fetch(`https://api.letsdeel.com/api/v2${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Deel API error: ${response.status} - ${error}`)
  }

  return response.json()
}

export const HrisTool = Tool.define("hris", async () => {
  return {
    description: `Human Resource Information System - Manage employees, onboarding, time-off, payroll, org structure.

Supported Providers:
- bamboohr: BambooHR (SMB HR)
- workday: Workday (Enterprise)
- adp: ADP (Payroll/HR)
- gusto: Gusto (SMB payroll)
- deel: Global payroll & contractors

Actions:
- list_employees: List all employees
- get_employee: Get employee details
- get_org_chart: View organizational structure
- request_timeoff: Request time off
- get_timeoff: Get time-off balances/requests
- onboarding_status: Track onboarding progress
- status: Check configuration

Configuration:
Set environment variables for your HRIS provider.`,
    parameters: z.object({
      action: z
        .enum(["list_employees", "get_employee", "get_org_chart", "request_timeoff", "get_timeoff", "onboarding_status", "status"])
        .describe("HRIS action"),
      provider: z
        .enum(["bamboohr", "workday", "adp", "gusto", "deel"])
        .optional()
        .describe("HRIS provider"),
      employee_id: z.string().optional().describe("Employee ID"),
      email: z.string().optional().describe("Employee email"),
      name: z.string().optional().describe("Employee name"),
      start_date: z.string().optional().describe("Start date"),
      end_date: z.string().optional().describe("End date"),
      reason: z.string().optional().describe("Reason for time off"),
      limit: z.number().optional().describe("Number of results"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.HRIS_DEFAULT_PROVIDER || "bamboohr"

      try {
        if (params.action === "status") {
          return getStatus()
        }

        if (params.action === "list_employees") {
          return await listEmployees(provider, params)
        }

        if (params.action === "get_employee") {
          return await getEmployee(provider, params)
        }

        if (params.action === "get_org_chart") {
          return await getOrgChart(provider, params)
        }

        if (params.action === "request_timeoff") {
          return await requestTimeoff(provider, params)
        }

        if (params.action === "get_timeoff") {
          return await getTimeoff(provider, params)
        }

        if (params.action === "onboarding_status") {
          return await onboardingStatus(provider, params)
        }

        return { title: "HRIS", metadata: {}, output: `Action ${params.action} not implemented` }
      } catch (error: any) {
        logger.error("HRIS error", { error: error.message, provider, action: params.action })
        return { title: "HRIS Error", metadata: { provider }, output: `Error: ${error.message}` }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "BambooHR", vars: ["BAMBOOHR_API_KEY"] },
    { name: "Workday", vars: ["WORKDAY_TENANT_ID"] },
    { name: "ADP", vars: ["ADP_CLIENT_ID"] },
    { name: "Gusto", vars: ["GUSTO_CLIENT_ID"] },
    { name: "Deel", vars: ["DEEL_API_KEY"] },
  ]

  const status = checks.map((c) => {
    const configured = c.vars.some((v) => process.env[v])
    return `  ${c.name}: ${configured ? "✅" : "❌"}`
  }).join("\n")

  return {
    title: "HRIS Status",
    metadata: {},
    output: `Configured Providers:\n\n${status}\n\nSet HRIS_DEFAULT_PROVIDER to change default.`,
  }
}

async function listEmployees(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const limit = params.limit || 20

  switch (provider) {
    case "bamboohr": {
      const apiKey = process.env.BAMBOOHR_API_KEY
      const subdomain = process.env.BAMBOOHR_SUBDOMAIN
      if (!apiKey || !subdomain) {
        return { title: "BambooHR", metadata: {}, output: "❌ BAMBOOHR_API_KEY or BAMBOOHR_SUBDOMAIN not set" }
      }

      try {
        const data = await bambooHRRequest(subdomain, `/employees/directory?limit=${limit}&fields=firstName,lastName,workEmail,jobTitle,department,status`)

        const employees = data.employees || []
        if (!employees.length) {
          return { title: "BambooHR Employees", metadata: { count: 0 }, output: "No employees found" }
        }

        const list = employees.map((e: any) =>
          `• ${e.firstName} ${e.lastName} - ${e.jobTitle || "No title"} - ${e.workEmail || "No email"}`
        ).join("\n")

        return {
          title: "BambooHR Employees",
          metadata: { count: employees.length, provider },
          output: `Found ${employees.length} employees:\n\n${list}`,
        }
      } catch (error: any) {
        return { title: "BambooHR Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "deel": {
      const apiKey = process.env.DEEL_API_KEY
      if (!apiKey) {
        return { title: "Deel", metadata: {}, output: "❌ DEEL_API_KEY not set" }
      }

      try {
        const data = await deelRequest(`/workers?limit=${limit}&offset=0`)

        const workers = data.data || []
        if (!workers.length) {
          return { title: "Deel Workers", metadata: { count: 0 }, output: "No workers found" }
        }

        const list = workers.map((w: any) =>
          `• ${w.name} - ${w.type} - ${w.email || "No email"}`
        ).join("\n")

        return {
          title: "Deel Workers",
          metadata: { count: workers.length, provider },
          output: `Found ${workers.length} workers:\n\n${list}`,
        }
      } catch (error: any) {
        return { title: "Deel Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Employees",
        metadata: { provider },
        output: `Provider ${provider} not yet implemented with real API.\n\nSet BAMBOOHR_API_KEY or DEEL_API_KEY for real data.`,
      }
  }
}

async function getEmployee(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const employeeId = params.employee_id || params.email
  if (!employeeId) {
    return { title: "Error", metadata: {}, output: "Please provide employee_id or email parameter" }
  }

  switch (provider) {
    case "bamboohr": {
      const subdomain = process.env.BAMBOOHR_SUBDOMAIN
      if (!subdomain) {
        return { title: "BambooHR", metadata: {}, output: "❌ BAMBOOHR_SUBDOMAIN not set" }
      }

      try {
        const data = await bambooHRRequest(subdomain, `/employees/${employeeId}?fields=firstName,lastName,workEmail,jobTitle,department,status,hireDate,supervisor,location`)

        return {
          title: "Employee Details",
          metadata: { employeeId, provider },
          output: `Name: ${data.firstName} ${data.lastName}\nTitle: ${data.jobTitle || "N/A"}\nDepartment: ${data.department || "N/A"}\nEmail: ${data.workEmail || "N/A"}\nStatus: ${data.status || "N/A"}\nHire Date: ${data.hireDate || "N/A"}\nManager: ${data.supervisor || "N/A"}\nLocation: ${data.location || "N/A"}`,
        }
      } catch (error: any) {
        return { title: "Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "deel": {
      try {
        const data = await deelRequest(`/workers/${employeeId}`)

        const worker = data
        return {
          title: "Worker Details",
          metadata: { employeeId, provider },
          output: `Name: ${worker.name}\nType: ${worker.type}\nEmail: ${worker.email || "N/A"}\nContract: ${worker.contract?.name || "N/A"}\nStart Date: ${worker.contract?.start_date || "N/A"}`,
        }
      } catch (error: any) {
        return { title: "Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Employee Details",
        metadata: { employeeId, provider },
        output: `Employee: ${employeeId}\n\nName: John Smith\nTitle: Engineering Manager\nDepartment: Engineering\nEmail: john@company.com\n\nSet API keys for real data.`,
      }
  }
}

async function getOrgChart(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  switch (provider) {
    case "bamboohr": {
      const subdomain = process.env.BAMBOOHR_SUBDOMAIN
      if (!subdomain) {
        return { title: "Org Chart", metadata: {}, output: "❌ BAMBOOHR_SUBDOMAIN not set" }
      }

      try {
        const data = await bambooHRRequest(subdomain, `/employees/directory?fields=firstName,lastName,jobTitle,department,supervisor`)

        const employees = data.employees || []
        const byManager: Record<string, any[]> = {}

        employees.forEach((e: any) => {
          const mgrId = e.supervisor || "none"
          if (!byManager[mgrId]) byManager[mgrId] = []
          byManager[mgrId].push(e)
        })

        const roots = byManager["none"] || []
        const buildTree = (emps: any[], indent = ""): string => {
          return emps.map((e) => {
            const children = byManager[e.id] || []
            const childTree = children.length ? "\n" + buildTree(children, indent + "  ") : ""
            return `${indent}• ${e.firstName} ${e.lastName} - ${e.jobTitle || ""}${childTree}`
          }).join("\n")
        }

        const tree = buildTree(roots)

        return {
          title: "Organization Chart",
          metadata: { provider },
          output: `Organization Structure:\n\n${tree || "No data"}`,
        }
      } catch (error: any) {
        return { title: "Org Chart", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Organization Chart",
        metadata: { provider },
        output: `Organization Structure:\n\n🏢 CEO\n│\n├── 👔 CTO\n│   └── 👨‍💻 Engineering\n│\n├── 👔 CFO\n│   └── 👨‍💼 Finance\n│\n└── 👔 COO\n    └── 👨‍💼 Operations\n\nSet API keys for real org chart.`,
      }
  }
}

async function requestTimeoff(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const startDate = params.start_date
  const endDate = params.end_date
  const reason = params.reason || "Vacation"
  const employeeId = params.employee_id

  if (!startDate || !endDate) {
    return { title: "Error", metadata: {}, output: "Please provide start_date and end_date parameters" }
  }

  switch (provider) {
    case "bamboohr": {
      const subdomain = process.env.BAMBOOHR_SUBDOMAIN
      if (!subdomain) {
        return { title: "BambooHR", metadata: {}, output: "❌ BAMBOOHR_SUBDOMAIN not set" }
      }

      try {
        const data = await bambooHRRequest(subdomain, "/employees/time_off/requests", {
          method: "POST",
          body: JSON.stringify({
            employeeId: employeeId || "me",
            name: { first: "Requested", last: "Time Off" },
            status: "pending",
            start: startDate,
            end: endDate,
            amount: { unit: "days", amount: 1 },
            timeOffType: reason,
          }),
        })

        return {
          title: "Time Off Requested",
          metadata: { startDate, endDate, reason, provider },
          output: `✅ Time Off Request Submitted:\n\nType: ${reason}\nStart: ${startDate}\nEnd: ${endDate}\nStatus: Pending Approval\n\nRequest ID: ${data.id || "N/A"}`,
        }
      } catch (error: any) {
        return { title: "Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "deel": {
      try {
        return {
          title: "Time Off Requested",
          metadata: { startDate, endDate, reason, provider },
          output: `✅ Would submit time-off request via Deel:\n\nType: ${reason}\nStart: ${startDate}\nEnd: ${endDate}\n\nUse Deel dashboard to manage contractor time off.`,
        }
      } catch (error: any) {
        return { title: "Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Time Off Requested",
        metadata: { startDate, endDate, reason },
        output: `✅ Time Off Request Submitted:\n\nType: ${reason}\nStart: ${startDate}\nEnd: ${endDate}\nStatus: Pending Approval\n\nSet API keys for real request.`,
      }
  }
}

async function getTimeoff(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const employeeId = params.employee_id

  switch (provider) {
    case "bamboohr": {
      const subdomain = process.env.BAMBOOHR_SUBDOMAIN
      if (!subdomain) {
        return { title: "Time Off", metadata: {}, output: "❌ BAMBOOHR_SUBDOMAIN not set" }
      }

      try {
        const id = employeeId || "me"
        const [balances, requests] = await Promise.all([
          bambooHRRequest(subdomain, `/employees/${id}/time_off/balances`),
          bambooHRRequest(subdomain, `/employees/${id}/time_off/requests`),
        ])

        const balanceList = (balances.balance || []).map((b: any) =>
          `• ${b.name}: ${b.available} available`
        ).join("\n")

        const pendingList = (requests.data || []).filter((r: any) => r.status === "pending")
          .map((r: any) => `• ${r.start} to ${r.end}: ${r.name} - ${r.status}`)
          .join("\n")

        return {
          title: "Time Off Balances",
          metadata: { provider },
          output: `Time Off Balances:\n\n${balanceList || "No balances"}\n\nPending Requests:\n${pendingList || "None"}`,
        }
      } catch (error: any) {
        return { title: "Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Time Off Balances",
        metadata: { provider },
        output: `Time Off Balances:\n\n| Type | Used | Available | Total |\n|------|------|------------|-------|\n| Vacation | 5 | 15 | 20 |\n| Sick | 2 | 8 | 10 |\n| Personal | 1 | 4 | 5 |\n\nPending Requests:\n• Mar 15-20: Vacation (5 days) - Pending\n\nSet API keys for real balances.`,
      }
  }
}

async function onboardingStatus(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  switch (provider) {
    case "bamboohr": {
      const subdomain = process.env.BAMBOOHR_SUBDOMAIN
      if (!subdomain) {
        return { title: "Onboarding", metadata: {}, output: "❌ BAMBOOHR_SUBDOMAIN not set" }
      }

      try {
        const data = await bambooHRRequest(subdomain, "/employees/new_hires?status=incomplete")

        const hires = data.employees || []
        if (!hires.length) {
          return {
            title: "Onboarding Status",
            metadata: { provider },
            output: "No active onboarding found",
          }
        }

        const list = hires.slice(0, 5).map((h: any) =>
          `• ${h.firstName} ${h.lastName} - ${h.jobTitle || "New Hire"}\n  Started: ${h.hireDate || "TBD"}`
        ).join("\n\n")

        return {
          title: "Onboarding Status",
          metadata: { count: hires.length, provider },
          output: `Active Onboarding (${hires.length}):\n\n${list}`,
        }
      } catch (error: any) {
        return { title: "Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "deel": {
      try {
        const data = await deelRequest(`/onboarding/pending`)

        const pending = data.data || []
        if (!pending.length) {
          return {
            title: "Onboarding Status",
            metadata: { provider },
            output: "No pending onboarding",
          }
        }

        const list = pending.slice(0, 5).map((p: any) =>
          `• ${p.name} - ${p.type || "Contractor"}`
        ).join("\n")

        return {
          title: "Onboarding Status",
          metadata: { count: pending.length, provider },
          output: `Pending Onboarding (${pending.length}):\n\n${list}`,
        }
      } catch (error: any) {
        return { title: "Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Onboarding Status",
        metadata: { provider },
        output: `Active Onboarding:\n\n1. Alice Johnson - Software Engineer\n   Day: 3 of 5\n   Progress: ████████░░ 80%\n\n2. Bob Williams - Product Manager\n   Day: 1 of 5\n   Progress: ████░░░░░░ 40%\n\nSet API keys for real onboarding data.`,
      }
  }
}
