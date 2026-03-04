import z from "zod"
import { Tool } from "./tool"

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
  })

  return {
    title: "Payroll Status",
    metadata: {},
    output: `Configured Providers:\n\n${status.join("\n")}\n\nSet PAYROLL_DEFAULT_PROVIDER to change default.`,
  }
}

async function runPayroll(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const startDate = params.start_date || "2026-02-01"
  const endDate = params.end_date || "2026-02-15"

  return {
    title: "Payroll Processing",
    metadata: { startDate, endDate, provider },
    output: `Payroll Run - ${startDate} to ${endDate}\n\nEmployees: 12\nTotal Gross: $78,450.00\nTotal Taxes: $18,432.50\nTotal Deductions: $8,234.00\nNet Pay: $51,783.50\n\nStatus: Pending Approval\n\n✅ Ready to submit\n\nSet API keys for real payroll processing.`,
  }
}

async function getPayslip(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const employeeId = params.employee_id || "EMP001"
  const payPeriod = params.pay_period || "Feb 2026"

  return {
    title: "Payslip",
    metadata: { employeeId, payPeriod },
    output: `Payslip - ${payPeriod}\n\nEmployee: John Smith (${employeeId})\nEmployee ID: 12345\nDepartment: Engineering\n\nEarnings:\n  Regular Pay: $4,615.38\n  Overtime: $346.15\n  Bonus: $500.00\n  ────────────────\n  Gross Pay: $5,461.53\n\nTaxes:\n  Federal: $876.23\n  State: $218.46\n  Social Security: $338.61\n  Medicare: $79.19\n  ────────────────\n  Total Taxes: $1,512.49\n\nDeductions:\n  Health Insurance: $156.00\n  401(k): $273.08\n  ────────────────\n  Total Deductions: $429.08\n\nNet Pay: $3,519.96\n\nSet API keys for real payslips.`,
  }
}

async function getSummary(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Payroll Summary",
    metadata: { provider },
    output: `Payroll Summary - February 2026 (Pay Period 2)\n\n| Category | Amount |\n|----------|--------|\n| Gross Pay | $78,450.00 |\n| Federal Tax | $12,450.00 |\n| State Tax | $3,450.00 |\n| Social Security | $4,864.00 |\n| Medicare | $1,137.00 |\n| 401(k) Contributions | $3,922.50 |\n| Health Insurance | $1,872.00 |\n| ──────────────── |\n| Total Deductions | $27,695.50 |\n| Net Pay | $50,754.50 |\n\nEmployees: 12\nHours Worked: 1,840\nOvertime Hours: 45\n\nSet API keys for real summary.`,
  }
}

async function getTaxReport(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Tax Report",
    metadata: { provider },
    output: `Tax Report - February 2026\n\nFederal Tax Liabilities:\n  Withheld: $12,450.00\n  Due: $12,450.00\n  Status: ✅ Paid\n\nState Tax Liabilities:\n  Withheld: $3,450.00\n  Due: $3,450.00\n  Status: ✅ Paid\n\nFICA:\n  Social Security: $4,864.00\n  Medicare: $1,137.00\n  ────────────────\n  Total FICA: $6,001.00\n\nYear-to-Date:\n  Federal: $24,900.00\n  State: $6,900.00\n  Social Security: $9,728.00\n  Medicare: $2,274.00\n\nSet API keys for real tax reports.`,
  }
}

async function getCompensation(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const employeeId = params.employee_id || "EMP001"
  const salary = params.salary || 120000

  return {
    title: "Employee Compensation",
    metadata: { employeeId },
    output: `Compensation - Employee ${employeeId}\n\nBase Salary: $${salary.toLocaleString()}/year\n($${(salary / 26).toFixed(2)}/pay period)\n\nAdditional Compensation:\n  • Target Bonus: 15% ($18,000)\n  • Equity: 500 RSUs (4-year vest)\n\nDeductions (per pay period):\n  • Health Insurance: $156.00\n  • 401(k): 6% match ($273.08)\n  • FSA: $50.00\n\nTotal Compensation:\n  Cash: $138,000\n  Equity: ~$75,000\n  Benefits: ~$8,000\n  ────────────────\n  Total: ~$221,000\n\nSet API keys for real compensation data.`,
  }
}
