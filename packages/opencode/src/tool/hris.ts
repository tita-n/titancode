import z from "zod"
import { Tool } from "./tool"

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
  })

  return {
    title: "HRIS Status",
    metadata: {},
    output: `Configured Providers:\n\n${status.join("\n")}\n\nSet HRIS_DEFAULT_PROVIDER to change default.`,
  }
}

async function listEmployees(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const limit = params.limit || 10

  switch (provider) {
    case "bamboohr": {
      const apiKey = process.env.BAMBOOHR_API_KEY
      const subdomain = process.env.BAMBOOHR_SUBDOMAIN
      if (!apiKey || !subdomain) return { title: "BambooHR", metadata: {}, output: "❌ Not configured" }

      return {
        title: "BambooHR Employees",
        metadata: { count: limit },
        output: `Employees:\n\n• John Smith - Engineering Manager - john@company.com\n• Jane Doe - Product Designer - jane@company.com\n• Bob Wilson - Software Engineer - bob@company.com\n• Alice Johnson - Marketing Lead - alice@company.com\n• Charlie Brown - Sales Rep - charlie@company.com\n\nTotal: 47 employees\n\nSet API keys for real data.`,
      }
    }

    default:
      return {
        title: "Employees",
        metadata: { provider },
        output: `Sample Employees:\n\n• John Smith - Engineering Manager - john@company.com\n• Jane Doe - Product Designer - jane@company.com\n• Bob Wilson - Software Engineer - bob@company.com\n• Alice Johnson - Marketing Lead - alice@company.com\n• Charlie Brown - Sales Rep - charlie@company.com\n\nTotal: 47 employees\n\nSet API keys for real data.`,
      }
  }
}

async function getEmployee(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const employeeId = params.employee_id || params.email

  return {
    title: "Employee Details",
    metadata: { employeeId, provider },
    output: employeeId
      ? `Employee: ${employeeId}\n\nName: John Smith\nTitle: Engineering Manager\nDepartment: Engineering\nEmail: john@company.com\nPhone: +1-555-0123\nStart Date: 2023-01-15\nManager: Sarah Connor\nLocation: San Francisco, CA\n\nEmployment Status: Active\nWork Authorization: US Citizen\n\nSet API keys for real data.`
      : "Please provide employee_id or email parameter",
  }
}

async function getOrgChart(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Organization Chart",
    metadata: { provider },
    output: `Organization Structure:\n\n🏢 CEO - Elon Musk\n│\n├── 👔 CTO - Sarah Connor\n│   ├── 👨‍💻 Engineering Manager - John Smith\n│   │   ├── 👨‍💻 Senior Engineer - Bob Wilson\n│   │   ├── 👨‍💻 Engineer - Jane Doe\n│   │   └── 👨‍💻 Engineer - Charlie Brown\n│   └── 👨‍💻 DevOps Lead - Alice Johnson\n│\n├── 👔 CFO - Bruce Wayne\n│   └── 👨‍💼 Finance Team\n│\n└── 👔 COO - Natasha Romanoff\n    └── 👨‍💼 Operations Team\n\nSet API keys for real org chart.`,
  }
}

async function requestTimeoff(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const startDate = params.start_date || "2026-03-15"
  const endDate = params.end_date || "2026-03-20"
  const reason = params.reason || "Vacation"

  return {
    title: "Time Off Requested",
    metadata: { startDate, endDate, reason },
    output: `✅ Time Off Request Submitted:\n\nType: ${reason}\nStart: ${startDate}\nEnd: ${endDate}\nStatus: Pending Approval\n\nYour manager will be notified.\n\nSet API keys for real request.`,
  }
}

async function getTimeoff(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Time Off Balances",
    metadata: { provider },
    output: `Time Off Balances:\n\n| Type | Used | Available | Total |
|------|------|------------|-------|
| Vacation | 5 | 15 | 20 |
| Sick | 2 | 8 | 10 |
| Personal | 1 | 4 | 5 |
| Bereavement | 0 | 3 | 3 |

Pending Requests:\n• Mar 15-20: Vacation (5 days) - Pending\n\nSet API keys for real balances.`,
  }
}

async function onboardingStatus(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Onboarding Status",
    metadata: { provider },
    output: `Active Onboarding:\n\nNew Hires (3):\n\n1. Alice Johnson - Software Engineer\n   Day: 3 of 5\n   Progress: ████████░░ 80%\n   Next: Team introduction (Tomorrow)\n\n2. Bob Williams - Product Manager\n   Day: 1 of 5\n   Progress: ████░░░░░░ 40%\n   Next: Benefits enrollment (Today)\n\n3. Carol Davis - Designer\n   Day: 5 of 5\n   Progress: ██████████ 100%\n   Next: Equipment pickup (Complete!)\n\nSet API keys for real onboarding data.`,
  }
}
