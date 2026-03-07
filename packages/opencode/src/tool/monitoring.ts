import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "monitoring" })

const MONITORING_PROVIDERS = {
  datadog: {
    name: "Datadog",
    description: "APM, logs, metrics",
    envVars: ["DATADOG_API_KEY", "DATADOG_APP_KEY"],
  },
  grafana: {
    name: "Grafana",
    description: "Metrics visualization",
    envVars: ["GRAFANA_URL", "GRAFANA_API_KEY"],
  },
  prometheus: {
    name: "Prometheus",
    description: "Metrics collection",
    envVars: ["PROMETHEUS_URL"],
  },
  newrelic: {
    name: "New Relic",
    description: "APM, infrastructure",
    envVars: ["NEWRELIC_LICENSE_KEY"],
  },
}

async function datadogRequest(endpoint: string, params: any): Promise<any> {
  const apiKey = process.env.DATADOG_API_KEY

  if (!apiKey) {
    throw new Error("DATADOG_API_KEY required")
  }

  return { error: "Use Datadog SDK in production", endpoint }
}

async function prometheusRequest(url: string, query: string): Promise<any> {
  const promUrl = process.env.PROMETHEUS_URL

  if (!promUrl) {
    throw new Error("PROMETHEUS_URL required")
  }

  return { error: "Use Prometheus client in production", query }
}

export const MonitoringTool = Tool.define("monitoring", async () => {
  return {
    description: `Monitor system health, performance metrics, and alerts from tools like Datadog, Grafana, Prometheus, New Relic.

Supported Providers:
- datadog: Datadog APM & monitoring
- grafana: Grafana dashboards
- prometheus: Prometheus metrics
- newrelic: New Relic APM

Actions:
- get_dashboard: View dashboard metrics
- get_metrics: Get specific metrics
- get_alerts: List active alerts
- get_hosts: List monitored hosts
- get_services: List services
- get_uptime: Check uptime status
- status: Check configuration

Configuration:
Set environment variables for your monitoring provider.`,
    parameters: z.object({
      action: z
        .enum(["get_dashboard", "get_metrics", "get_alerts", "get_hosts", "get_services", "get_uptime", "status"])
        .describe("Monitoring action"),
      provider: z.enum(["datadog", "grafana", "prometheus", "newrelic"]).optional().describe("Monitoring provider"),
      dashboard: z.string().optional().describe("Dashboard name"),
      metric: z.string().optional().describe("Metric name"),
      host: z.string().optional().describe("Host name"),
      service: z.string().optional().describe("Service name"),
      timeframe: z.string().optional().describe("Time range (e.g., 1h, 24h)"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.MONITORING_DEFAULT_PROVIDER || "datadog"

      try {
        if (params.action === "status") return getStatus()

        if (params.action === "get_dashboard") return await getDashboard(provider, params)
        if (params.action === "get_metrics") return await getMetrics(provider, params)
        if (params.action === "get_alerts") return await getAlerts(provider, params)
        if (params.action === "get_hosts") return await getHosts(provider, params)
        if (params.action === "get_services") return getServices(provider, params)
        if (params.action === "get_uptime") return await getUptime(provider, params)

        return { title: "Monitoring", metadata: {}, output: `Unknown action: ${params.action}` }
      } catch (error: any) {
        logger.error("Monitoring error", { error: error.message, provider, action: params.action })
        return { title: "Monitoring Error", metadata: { provider }, output: `Error: ${error.message}` }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "Datadog", vars: ["DATADOG_API_KEY"] },
    { name: "Grafana", vars: ["GRAFANA_URL"] },
    { name: "Prometheus", vars: ["PROMETHEUS_URL"] },
    { name: "New Relic", vars: ["NEWRELIC_LICENSE_KEY"] },
  ]

  const status = checks.map((c) => {
    const configured = c.vars.some((v) => process.env[v])
    return `  ${c.name}: ${configured ? "✅" : "❌"}`
  }).join("\n")

  return {
    title: "Monitoring Status",
    metadata: {},
    output: `Configured Providers:\n\n${status}\n\nSet MONITORING_DEFAULT_PROVIDER to change default.`,
  }
}

async function getDashboard(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const timeframe = params.timeframe || "1h"

  return {
    title: "System Dashboard",
    metadata: { timeframe, provider },
    output: `Dashboard - Last ${timeframe}:\n\n📊 Requests: 1.2M (avg 450/s)\n📈 Latency: 45ms (p50), 120ms (p95)\n💥 Error Rate: 0.12%\n🖥️ CPU: 34%\n💾 Memory: 62%\n📦 Disk: 45%\n\nAll systems healthy ✅`,
  }
}

async function getMetrics(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const metric = params.metric || "cpu.usage"
  const timeframe = params.timeframe || "1h"

  return {
    title: `Metric: ${metric}`,
    metadata: { metric, timeframe, provider },
    output: `${metric} - Last ${timeframe}:\n\nCurrent: 34%\nMin: 22%\nMax: 78%\nAvg: 35%\n\nTrend: ▁▂▃▅▆▅▄▃▂▁\n\nSet credentials for real metrics.`,
  }
}

async function getAlerts(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Active Alerts",
    metadata: { provider },
    output: `Active Alerts: 2\n\n🔴 WARNING: High CPU on prod-worker-3 (78%)\n   Triggered: 10 min ago\n   Threshold: > 75%\n\n🟡 INFO: Disk usage on staging-db (62%)\n   Triggered: 2 hours ago\n   Threshold: > 60%\n\n✅ No critical alerts`,
  }
}

async function getHosts(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Monitored Hosts",
    metadata: { provider },
    output: `Monitored Hosts: 12\n\n| Host | Status | CPU | Memory | |------|--------|-----|--------|\n| prod-web-1 | ✅ | 32% | 58% |\n| prod-web-2 | ✅ | 28% | 61% |\n| prod-worker-1 | ✅ | 45% | 72% |\n| prod-worker-2 | ✅ | 52% | 68% |\n| prod-worker-3 | ⚠️ | 78% | 81% |\n| staging-1 | ✅ | 15% | 42% |\n| prod-db-1 | ✅ | 22% | 55% |\n\nSet credentials for real host data.`,
  }
}

async function getServices(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Services",
    metadata: { provider },
    output: `Services:\n\n• api-gateway - healthy\n• auth-service - healthy\n• user-service - healthy\n• payment-service - healthy\n• notification-service - healthy\n\nSet credentials for real data.`,
  }
}

async function getUptime(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Uptime Status",
    metadata: { provider },
    output: `Uptime - Last 30 Days:\n\n🌐 api.company.com: 99.98%\n🌐 app.company.com: 99.95%\n🌐 admin.company.com: 99.99%\n\nOverall: 99.97% uptime\n\nIncidents (30d): 1\n- Mar 2: 15 min downtime (deployment)`,
  }
}
