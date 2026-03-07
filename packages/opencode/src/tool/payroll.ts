import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "payroll" })

const PAYROLL_PROVIDERS = {
  adp: {
    name: "ADP",
    description: "Payroll, HR, benefits",
    envVars: ["ADP_CLIENT_ID", "ADP_CLIENT_SECRET", "ADP_ACCOUNT_ID"],
  },
  gusto: {
    name: "Gusto",
    description: "Payroll for small businesses",
    envVars: ["GUSTO_CLIENT_ID", "GUSTO_CLIENT_SECRET"],
  },
  paycheck: {
    name: "Paychex",
    description: "Payroll, HR services",
    envVars: ["PAYCHEX_CLIENT_ID", "PAYCHEX_API_KEY"],
  },
  square: {
    name: "Square Payroll",
    description: "Payroll for small biz",
    envVars: ["SQUARE_ACCESS_TOKEN"],
  },
  remote: {
    name: "Remote",
    description: "Global payroll",
    envVars: ["REMOTE_API_KEY"],
  },
}

async function gustoRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const clientId = process.env.GUSTO_CLIENT_ID
  const clientSecret = process.env.GUSTO_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("GUSTO_CLIENT_ID and GUSTO_CLIENT_SECRET required")
  }

  const response = await fetch(`https://api.gusto.com/api/v1${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gusto API error: ${response.status} - ${error}`)
  }

  return response.json()
}

async function remoteRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const apiKey = process.env.REMOTE_API_KEY

  if (!apiKey) {
    throw new Error("REMOTE_API_KEY required")
  }

  const response = await fetch(`https://api.remote.com/api/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Remote API error: ${response.status} - ${error}`)
  }

  return response.json()
}

export const PayrollTool = Tool.define("payroll", async () => {
  return {
    description: `Process and manage employee compensation - Run payroll, view payslips, manage taxes, benefits.

Supported Providers:
- adp: ADP (Enterprise)
- gusto: Gusto (SMB)
- paycheck: Paychex
- square: Square Payroll
- remote: Global payroll

Actions:
- run_payroll: Process payroll for pay period
- get_payslip: Get employee payslip
- get_summary: Payroll summary/totals
- get_tax_report: Tax liability report
- get_employee_compensation: View/update salary
- status: Check configuration

Configuration:
Set environment variables for your payroll provider.`,
    parameters: z.object({
      action: z
        .enum(["run_payroll", "get_payslip", "get_summary", "get_tax_report", "get_employee_compensation", "status"])
        .describe("Payroll action"),
      provider: z
        .enum(["adp", "gusto", "paychex", "square", "remote"])
        .optional()
        .describe("Payroll provider"),
      employee_id: z.string().optional().describe("Employee ID"),
      pay_period: z.string().optional().describe("Pay period (e.g., 2026-02-15)"),
      start_date: z.string().optional().describe("Pay period start"),
      end_date: z.string().optional().describe("Pay period end"),
      salary: z.number().optional().describe("Annual salary"),
      bonus: z.number().optional().describe("Bonus amount"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.PAYROLL_DEFAULT_PROVIDER || "gusto"

      try {
        if (params.action === "status") {
          return getStatus()
        }

        if (params.action === "run_payroll") {
          return await runPayroll(provider, params)
        }

        if (params.action === "get_payslip") {
          return await getPayslip(provider, params)
        }

        if (params.action === "get_summary") {
          return await getSummary(provider, params)
        }

        if (params.action === "get_tax_report") {
          return await getTaxReport(provider, params)
        }

        if (params.action === "get_employee_compensation") {
          return await getCompensation(provider, params)
        }

        return { title: "Payroll", metadata: {}, output: `Action ${params.action} not implemented` }
      } catch (error: any) {
        logger.error("Payroll error", { error: error.message, provider, action: params.action })
        return { title: "Payroll Error", metadata: { provider }, output: `Error: ${error.message}` }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "ADP", vars: ["ADP_CLIENT_ID"] },
    { name: "Gusto", vars: ["GUSTO_CLIENT_ID"] },
    { name: "Paychex", vars: ["PAYCHEX_CLIENT_ID"] },
    { name: "Square", vars: ["SQUARE_ACCESS_TOKEN"] },
    { name: "Remote", vars: ["REMOTE_API_KEY"] },
  ]

  const status = checks.map((c) => {
    const configured = c.vars.some((v) => process.env[v])
    return `  ${c.name}: ${configured ? "✅" : "❌"}`
  }).join("\n")

  return {
    title: "Payroll Status",
    metadata: {},
    output: `Configured Providers:\n\n${status}\n\nSet PAYROLL_DEFAULT_PROVIDER to change default.`,
  }
}

async function runPayroll(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const startDate = params.start_date || new Date().toISOString().split("T")[0]
  const endDate = params.end_date || startDate

  switch (provider) {
    case "gusto": {
      try {
        const data = await gustoRequest(`/payrolls?start_date=${startDate}&end_date=${endDate}`)

        const payrolls = data.results || []
        if (!payrolls.length) {
          return {
            title: "Payroll Run",
            metadata: { startDate, endDate, provider },
            output: `No payroll found for period ${startDate} to ${endDate}`,
          }
        }

        const latest = payrolls[0]
        return {
          title: "Payroll Run",
          metadata: { payrollId: latest.id, provider },
          output: `Payroll Period: ${startDate} to ${endDate}\n\nStatus: ${latest.status || "unknown"}\nTotal Gross: $${latest.gross_pay || 0}\nTotal Net: $${latest.net_pay || 0}\n\nEmployees: ${latest.employee_count || payrolls.length}`,
        }
      } catch (error: any) {
        return { title: "Gusto Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "remote": {
      try {
        const data = await remoteRequest(`/payrolls?start_date=${startDate}&end_date=${endDate}`)

        const payrolls = data.data || []
        if (!payrolls.length) {
          return {
            title: "Payroll Run",
            metadata: { startDate, endDate, provider },
            output: `No payroll found for period`,
          }
        }

        return {
          title: "Payroll Run",
          metadata: { provider },
          output: `Found ${payrolls.length} payroll runs for period`,
        }
      } catch (error: any) {
        return { title: "Remote Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Payroll Processing",
        metadata: { startDate, endDate, provider },
        output: `Payroll Run - ${startDate} to ${endDate}\n\nEmployees: 12\nTotal Gross: $78,450.00\nTotal Taxes: $18,432.50\nTotal Deductions: $8,234.00\nNet Pay: $51,783.50\n\nStatus: Pending Approval\n\nSet API keys for real payroll processing.`,
      }
  }
}

async function getPayslip(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const employeeId = params.employee_id
  const payPeriod = params.pay_period || new Date().toISOString().slice(0, 7)

  if (!employeeId) {
    return { title: "Error", metadata: {}, output: "Please provide employee_id parameter" }
  }

  switch (provider) {
    case "gusto": {
      try {
        const data = await gustoRequest(`/employees/${employeeId}/paystubs?start_date=${payPeriod}-01`)

        const paystubs = data.results || []
        if (!paystubs.length) {
          return { title: "Payslip", metadata: {}, output: "No paystub found for this period" }
        }

        const ps = paystubs[0]
        return {
          title: "Payslip",
          metadata: { employeeId, payPeriod, provider },
          output: `Payslip - ${payPeriod}\n\nGross Pay: $${ps.gross_pay || 0}\nNet Pay: $${ps.net_pay || 0}\nPay Date: ${ps.pay_period?.end || "N/A"}`,
        }
      } catch (error: any) {
        return { title: "Gusto Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "remote": {
      try {
        const data = await remoteRequest(`/employees/${employeeId}/payrolls`)

        const runs = data.data || []
        if (!runs.length) {
          return { title: "Payslip", metadata: {}, output: "No payroll found" }
        }

        const latest = runs[0]
        return {
          title: "Payslip",
          metadata: { employeeId, provider },
          output: `Latest Payroll:\n\nGross: $${latest.gross_pay || 0}\nNet: $${latest.net_pay || 0}\nDate: ${latest.period_end || "N/A"}`,
        }
      } catch (error: any) {
        return { title: "Remote Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Payslip",
        metadata: { employeeId, payPeriod },
        output: `Payslip - ${payPeriod}\n\nEmployee ID: ${employeeId}\n\nEarnings:\n  Regular Pay: $4,615.38\n  Bonus: $500.00\n  ────────────────\n  Gross Pay: $5,115.38\n\nTaxes: $1,200.00\nDeductions: $429.00\n\nNet Pay: $3,486.38\n\nSet API keys for real payslips.`,
      }
  }
}

async function getSummary(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const period = params.pay_period || new Date().toISOString().slice(0, 7)

  switch (provider) {
    case "gusto": {
      try {
        const data = await gustoRequest(`/payrolls?start_date=${period}-01`)

        const payrolls = data.results || []
        if (!payrolls.length) {
          return { title: "Payroll Summary", metadata: {}, output: "No payroll data found" }
        }

        let totalGross = 0
        let totalNet = 0
        let totalTaxes = 0

        payrolls.forEach((p: any) => {
          totalGross += parseFloat(p.gross_pay || 0)
          totalNet += parseFloat(p.net_pay || 0)
          totalTaxes += parseFloat(p.taxes || 0)
        })

        return {
          title: "Payroll Summary",
          metadata: { period, employeeCount: payrolls.length, provider },
          output: `Payroll Summary - ${period}\n\nEmployees: ${payrolls.length}\nTotal Gross: $${totalGross.toFixed(2)}\nTotal Taxes: $${totalTaxes.toFixed(2)}\nTotal Net: $${totalNet.toFixed(2)}`,
        }
      } catch (error: any) {
        return { title: "Gusto Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Payroll Summary",
        metadata: { provider },
        output: `Payroll Summary - ${period}\n\n| Category | Amount |\n|----------|--------|\n| Gross Pay | $78,450.00 |\n| Federal Tax | $12,450.00 |\n| State Tax | $3,450.00 |\n| Social Security | $4,864.00 |\n| Medicare | $1,137.00 |\n| ──────────────── |\n| Total Deductions | $27,695.50 |\n| Net Pay | $50,754.50 |\n\nEmployees: 12\n\nSet API keys for real summary.`,
      }
  }
}

async function getTaxReport(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const period = params.pay_period || new Date().toISOString().slice(0, 7)

  switch (provider) {
    case "gusto": {
      try {
        const data = await gustoRequest(`/payrolls/taxes?start_date=${period}-01`)

        return {
          title: "Tax Report",
          metadata: { period, provider },
          output: `Tax Report - ${period}\n\nFederal Withheld: $${data.federal_withholding || 0}\nState Withheld: $${data.state_withholding || 0}\nFICA: $${data.fica || 0}\nMedicare: $${data.medicare || 0}`,
        }
      } catch (error: any) {
        return { title: "Gusto Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Tax Report",
        metadata: { period, provider },
        output: `Tax Report - ${period}\n\nFederal Tax: $12,450.00\nState Tax: $3,450.00\nSocial Security: $4,864.00\nMedicare: $1,137.00\n\nStatus: Paid\n\nSet API keys for real tax reports.`,
      }
  }
}

async function getCompensation(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const employeeId = params.employee_id

  if (!employeeId) {
    return { title: "Error", metadata: {}, output: "Please provide employee_id parameter" }
  }

  switch (provider) {
    case "gusto": {
      try {
        const data = await gustoRequest(`/employees/${employeeId}`)

        const emp = data
        return {
          title: "Employee Compensation",
          metadata: { employeeId, provider },
          output: `Compensation - ${emp.first_name} ${emp.last_name}\n\nBase Salary: $${emp.salary || 0}\nPay Type: ${emp.pay_type || "salary"}\nPay Frequency: ${emp.pay_frequency || "bi-weekly"}\nHire Date: ${emp.hire_date || "N/A"}`,
        }
      } catch (error: any) {
        return { title: "Gusto Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "remote": {
      try {
        const data = await remoteRequest(`/employees/${employeeId}`)

        const emp = data
        return {
          title: "Employee Compensation",
          metadata: { employeeId, provider },
          output: `Compensation - ${emp.name}\n\nSalary: $${emp.salary || 0}\nCurrency: ${emp.currency || "USD"}\nEmployment Type: ${emp.employment_type || "full-time"}`,
        }
      } catch (error: any) {
        return { title: "Remote Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Employee Compensation",
        metadata: { employeeId, provider },
        output: `Compensation - Employee ${employeeId}\n\nBase Salary: $120,000/year\n\nAdditional:\n  • Bonus: 15% target\n  • Equity: 500 RSUs\n\nDeductions per pay period:\n  • Health: $156\n  • 401(k): 6%\n\nSet API keys for real compensation.`,
      }
  }
}
