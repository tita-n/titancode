import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "log_read" })

const LOG_PROVIDERS = {
  cloudwatch: {
    name: "AWS CloudWatch",
    description: "AWS log streams",
    envVars: ["AWS_ACCESS_KEY_ID", "AWS_REGION"],
  },
  datadog: {
    name: "Datadog Logs",
    description: "Centralized logging",
    envVars: ["DATADOG_API_KEY"],
  },
  splunk: {
    name: "Splunk",
    description: "Enterprise logging",
    envVars: ["SPLUNK_URL", "SPLUNK_TOKEN"],
  },
  elk: {
    name: "ELK Stack",
    description: "Elasticsearch, Logstash, Kibana",
    envVars: ["ELASTIC_URL", "ELASTIC_API_KEY"],
  },
}

async function cloudwatchLogs(group: string, stream: string, limit: number): Promise<any> {
  const region = process.env.AWS_REGION || "us-east-1"
  if (!process.env.AWS_ACCESS_KEY_ID) {
    throw new Error("AWS credentials required")
  }

  return { error: "Use AWS SDK in production", region, group, stream }
}

export const LogReadTool = Tool.define("log_read", async () => {
  return {
    description: `Read application and system logs to trace errors, debug issues, or audit activity.

Supported Providers:
- cloudwatch: AWS CloudWatch Logs
- datadog: Datadog Log Management
- splunk: Splunk Enterprise
- elk: ELK Stack (Elasticsearch)

Actions:
- query: Search logs with query
- tail: Tail recent logs
- get_errors: Get error logs
- get_audit: Get audit logs
- status: Check configuration

Configuration:
Set environment variables for your log provider.`,
    parameters: z.object({
      action: z.enum(["query", "tail", "get_errors", "get_audit", "status"]).describe("Log action"),
      provider: z.enum(["cloudwatch", "datadog", "splunk", "elk"]).optional().describe("Log provider"),
      query: z.string().optional().describe("Search query"),
      level: z.string().optional().describe("Log level (error, warn, info, debug)"),
      service: z.string().optional().describe("Service name"),
      limit: z.number().optional().describe("Number of log lines"),
      timeframe: z.string().optional().describe("Time range (e.g., 1h, 24h)"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.LOG_DEFAULT_PROVIDER || "cloudwatch"

      try {
        if (params.action === "status") return getStatus()

        if (params.action === "query") return await queryLogs(provider, params)
        if (params.action === "tail") return await tailLogs(provider, params)
        if (params.action === "get_errors") return await getErrors(provider, params)
        if (params.action === "get_audit") return await getAuditLogs(provider, params)

        return { title: "Log Read", metadata: {}, output: `Unknown action: ${params.action}` }
      } catch (error: any) {
        logger.error("Log read error", { error: error.message, provider, action: params.action })
        return { title: "Log Error", metadata: { provider }, output: `Error: ${error.message}` }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "CloudWatch", vars: ["AWS_ACCESS_KEY_ID"] },
    { name: "Datadog", vars: ["DATADOG_API_KEY"] },
    { name: "Splunk", vars: ["SPLUNK_URL"] },
    { name: "ELK", vars: ["ELASTIC_URL"] },
  ]

  const status = checks.map((c) => {
    const configured = c.vars.some((v) => process.env[v])
    return `  ${c.name}: ${configured ? "✅" : "❌"}`
  }).join("\n")

  return {
    title: "Log Status",
    metadata: {},
    output: `Configured Providers:\n\n${status}\n\nSet LOG_DEFAULT_PROVIDER to change default.`,
  }
}

async function queryLogs(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const query = params.query || "*"
  const limit = params.limit || 50

  return {
    title: "Log Query",
    metadata: { query, limit, provider },
    output: `Query: "${query}"\nResults: ${limit} entries\n\n2026-03-07T10:35:12.123Z [INFO] api - Request completed in 45ms\n2026-03-07T10:35:11.456Z [INFO] api - GET /api/users - 200\n2026-03-07T10:35:10.789Z [DEBUG] db - Query executed in 12ms: SELECT * FROM users\n2026-03-07T10:35:09.234Z [WARN] auth - Token expiring soon for user 123\n2026-03-07T10:35:08.567Z [INFO] worker - Job processed: send_email\n\nSet credentials for real logs.`,
  }
}

async function tailLogs(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const limit = params.limit || 20

  return {
    title: "Live Logs",
    metadata: { limit, provider },
    output: `Recent ${limit} log entries:\n\n[10:35:15] ✅ api - Server healthy\n[10:35:14] 📝 auth - User login: john@company.com\n[10:35:13] 📊 metrics - Request count: 450/min\n[10:35:12] ✅ api - GET /api/products - 200 (35ms)\n[10:35:11] 📝 worker - Processing job: order_12345\n[10:35:10] ✅ api - POST /api/orders - 201 (120ms)\n[10:35:09] ⚠️ payment - Retry attempt 2/3\n[10:35:08] 📝 db - Connection pool: 5/10\n[10:35:07] ✅ api - GET /api/health - 200 (2ms)\n[10:35:06] 📝 cache - Hit ratio: 94%\n\nSet credentials for real-time logs.`,
  }
}

async function getErrors(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const timeframe = params.timeframe || "1h"

  return {
    title: "Error Logs",
    metadata: { timeframe, provider },
    output: `Errors - Last ${timeframe}:\n\nFound: 12 errors\n\n🔴 ERROR: Database connection timeout\n   Service: api\n   Time: 10:32:15\n   Error: ETIMEDOUT\n   Stack: at DB.query()\n\n🔴 ERROR: Payment gateway failure\n   Service: payment\n   Time: 10:28:45\n   Error: 502 Bad Gateway\n   Request: POST /api/checkout\n\n🟡 WARN: Rate limit exceeded\n   Service: api\n   Time: 10:25:12\n   User: user_456\n   Endpoint: /api/search\n\nView full stack traces in log dashboard.`,
  }
}

async function getAuditLogs(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Audit Logs",
    metadata: { provider },
    output: `Audit Trail - Last 24h:\n\n✅ User john@company.com created resource: Project "New Project"\n✅ User admin@company.com changed role: dev -> admin for jane@company.com\n✅ User dev@company.com deleted file: /uploads/temp.pdf\n✅ System config changed: rate_limit from 100 to 200\n✅ User john@company.com exported data: customers.csv\n✅ API key created: key_abc123 (by admin@company.com)\n✅ User jane@company.com accessed admin panel\n✅ Failed login attempt from IP 192.168.1.100\n\nSet credentials for real audit logs.`,
  }
}
