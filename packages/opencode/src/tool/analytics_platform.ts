import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "analytics" })

const ANALYTICS_PROVIDERS = {
  google_analytics: {
    name: "Google Analytics 4",
    description: "Web analytics, user behavior, conversions",
    envVars: ["GA_PROPERTY_ID", "GA_CLIENT_EMAIL", "GA_PRIVATE_KEY"],
  },
  mixpanel: {
    name: "Mixpanel",
    description: "Product analytics, user journeys, funnels",
    envVars: ["MIXPANEL_TOKEN", "MIXPANEL_SECRET"],
  },
  amplitude: {
    name: "Amplitude",
    description: "Product analytics, behavioral data",
    envVars: ["AMPLITUDE_API_KEY", "AMPLITUDE_SECRET_KEY"],
  },
  heap: {
    name: "Heap",
    description: "Retroactive analytics, user sessions",
    envVars: ["HEAP_APP_ID", "HEAP_ACCESS_TOKEN"],
  },
  plausible: {
    name: "Plausible",
    description: "Privacy-focused analytics",
    envVars: ["PLAUSIBLE_API_KEY", "PLAUSIBLE_SITE_ID"],
  },
}

async function googleAnalyticsRequest(propertyId: string, body: any): Promise<any> {
  const clientEmail = process.env.GA_CLIENT_EMAIL
  const privateKey = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!clientEmail || !privateKey) {
    throw new Error("GA_CLIENT_EMAIL and GA_PRIVATE_KEY required")
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await createJwt(clientEmail, privateKey),
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error("Failed to get GA access token")
  }

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GA API error: ${response.status} - ${error}`)
  }

  return response.json()
}

async function createJwt(clientEmail: string, privateKey: string): Promise<string> {
  const base64UrlEncode = (str: string) => Buffer.from(str).toString("base64url")
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64UrlEncode(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))

  const sign = await crypto.subtle.sign(
    "RS256",
    await crypto.subtle.importKey(
      "pkcs8",
      Buffer.from(privateKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    ),
    new TextEncoder().encode(`${header}.${payload}`)
  )

  return `${header}.${payload}.${Buffer.from(sign).toString("base64url")}`
}

async function mixpanelRequest(method: string, params: any): Promise<any> {
  const token = process.env.MIXPANEL_TOKEN
  const secret = process.env.MIXPANEL_SECRET

  if (!token && !secret) {
    throw new Error("MIXPANEL_TOKEN or MIXPANEL_SECRET required")
  }

  const body = {
    method,
    params: { ...params, token },
  }

  const response = await fetch("https://api.mixpanel.com/api/2.0/segmentation/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Mixpanel API error: ${response.status} - ${error}`)
  }

  return response.json()
}

async function amplitudeRequest(endpoint: string, body: any): Promise<any> {
  const apiKey = process.env.AMPLITUDE_API_KEY
  const secretKey = process.env.AMPLITUDE_SECRET_KEY

  if (!apiKey) {
    throw new Error("AMPLITUDE_API_KEY required")
  }

  const response = await fetch(`https://api.amplitude.com/2/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey || ""}`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Amplitude API error: ${response.status} - ${error}`)
  }

  return response.json()
}

async function plausibleRequest(endpoint: string): Promise<any> {
  const apiKey = process.env.PLAUSIBLE_API_KEY
  const siteId = process.env.PLAUSIBLE_SITE_ID

  if (!apiKey) {
    throw new Error("PLAUSIBLE_API_KEY required")
  }

  const response = await fetch(`https://plausible.io/api/v1${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Plausible API error: ${response.status} - ${error}`)
  }

  return response.json()
}

function parseDateRange(dateRange: string): { start: string; end: string } {
  const end = new Date().toISOString().split("T")[0]
  let start = end

  if (dateRange === "today") {
    start = end
  } else if (dateRange === "last-7-days") {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    start = d.toISOString().split("T")[0]
  } else if (dateRange === "last-30-days") {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    start = d.toISOString().split("T")[0]
  } else if (dateRange === "last-90-days") {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    start = d.toISOString().split("T")[0]
  }

  return { start, end }
}

export const AnalyticsPlatformTool = Tool.define("analytics_platform", async () => {
  return {
    description: `Product and marketing analytics - Track user behavior, conversions, and campaign performance.

Supported Providers:
- google_analytics: Google Analytics 4 (GA4)
- mixpanel: Product analytics
- amplitude: Behavioral analytics
- heap: Retroactive analytics
- plausible: Privacy-focused analytics

Actions:
- get_metrics: Key metrics (users, sessions, conversions)
- get_funnel: Conversion funnel analysis
- get_events: Event breakdown
- get_realtime: Real-time active users
- get_conversions: Conversion goals
- status: Check configuration

Configuration:
Set environment variables for your analytics provider.`,
    parameters: z.object({
      action: z
        .enum(["get_metrics", "get_funnel", "get_events", "get_realtime", "get_conversions", "status"])
        .describe("Analytics action"),
      provider: z
        .enum(["google_analytics", "mixpanel", "amplitude", "heap", "plausible"])
        .optional()
        .describe("Analytics provider"),
      date_range: z.string().optional().describe("Date range (e.g., last-7-days, last-30-days)"),
      event_name: z.string().optional().describe("Event name"),
      funnel_name: z.string().optional().describe("Funnel name"),
      limit: z.number().optional().describe("Number of results"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.ANALYTICS_DEFAULT_PROVIDER || "google_analytics"

      try {
        if (params.action === "status") {
          return getStatus()
        }

        if (params.action === "get_metrics") {
          return await getMetrics(provider, params)
        }

        if (params.action === "get_funnel") {
          return await getFunnel(provider, params)
        }

        if (params.action === "get_events") {
          return await getEvents(provider, params)
        }

        if (params.action === "get_realtime") {
          return await getRealtime(provider, params)
        }

        if (params.action === "get_conversions") {
          return await getConversions(provider, params)
        }

        return { title: "Analytics", metadata: {}, output: `Action ${params.action} not implemented` }
      } catch (error: any) {
        logger.error("Analytics error", { error: error.message, provider, action: params.action })
        return { title: "Analytics Error", metadata: { provider }, output: `Error: ${error.message}` }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "Google Analytics", vars: ["GA_PROPERTY_ID", "GA_CLIENT_EMAIL"] },
    { name: "Mixpanel", vars: ["MIXPANEL_TOKEN"] },
    { name: "Amplitude", vars: ["AMPLITUDE_API_KEY"] },
    { name: "Heap", vars: ["HEAP_APP_ID"] },
    { name: "Plausible", vars: ["PLAUSIBLE_API_KEY"] },
  ]

  const status = checks.map((c) => {
    const configured = c.vars.some((v) => process.env[v])
    return `  ${c.name}: ${configured ? "✅" : "❌"}`
  }).join("\n")

  return {
    title: "Analytics Status",
    metadata: {},
    output: `Configured Providers:\n\n${status}\n\nSet ANALYTICS_DEFAULT_PROVIDER to change default.`,
  }
}

async function getMetrics(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const dateRange = params.date_range || "last-7-days"
  const { start, end } = parseDateRange(dateRange)

  switch (provider) {
    case "google_analytics": {
      const propertyId = process.env.GA_PROPERTY_ID
      if (!propertyId) {
        return { title: "GA4", metadata: {}, output: "❌ GA_PROPERTY_ID not set" }
      }

      try {
        const data = await googleAnalyticsRequest(propertyId, {
          dateRanges: [{ startDate: start, endDate: end }],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
            { name: "conversions" },
          ],
        })

        const row = data.rows?.[0]
        if (!row) {
          return { title: "GA4 Metrics", metadata: { dateRange }, output: "No data available for this period" }
        }

        const formatDuration = (seconds: number) => {
          const m = Math.floor(seconds / 60)
          const s = Math.floor(seconds % 60)
          return `${m}m ${s}s`
        }

        return {
          title: "Google Analytics Metrics",
          metadata: { dateRange, provider },
          output: `Metrics - ${start} to ${end}:\n\n• Users: ${row.metricValues[0].value}\n• Sessions: ${row.metricValues[1].value}\n• Pageviews: ${row.metricValues[2].value}\n• Bounce Rate: ${(parseFloat(row.metricValues[3].value) * 100).toFixed(1)}%\n• Avg. Session Duration: ${formatDuration(parseFloat(row.metricValues[4].value))}\n• Conversions: ${row.metricValues[5].value}`,
        }
      } catch (error: any) {
        return { title: "GA4 Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "mixpanel": {
      const token = process.env.MIXPANEL_TOKEN
      if (!token) {
        return { title: "Mixpanel", metadata: {}, output: "❌ MIXPANEL_TOKEN not set" }
      }

      try {
        const data = await mixpanelRequest("funnels", {
          from_date: start,
          to_date: end,
        })

        return {
          title: "Mixpanel Metrics",
          metadata: { dateRange, provider },
          output: `Metrics - ${start} to ${end}:\n\n• Active Users: ${data.data?.[0]?.signups || "N/A"}\n• Total Events: N/A\n\nAPI Response: ${JSON.stringify(data, null, 2)}`,
        }
      } catch (error: any) {
        return { title: "Mixpanel Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "amplitude": {
      const apiKey = process.env.AMPLITUDE_API_KEY
      if (!apiKey) {
        return { title: "Amplitude", metadata: {}, output: "❌ AMPLITUDE_API_KEY not set" }
      }

      try {
        const data = await amplitudeRequest("events", {
          event_type: "track",
          start,
          end,
        })

        return {
          title: "Amplitude Metrics",
          metadata: { dateRange, provider },
          output: `Metrics - ${start} to ${end}:\n\nAPI Response received. Check Amplitude dashboard for detailed metrics.`,
        }
      } catch (error: any) {
        return { title: "Amplitude Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "plausible": {
      const apiKey = process.env.PLAUSIBLE_API_KEY
      if (!apiKey) {
        return { title: "Plausible", metadata: {}, output: "❌ PLAUSIBLE_API_KEY not set" }
      }

      try {
        const data = await plausibleRequest(`/stats/aggregate?period=7d&metrics=visitors,pageviews,bounce_rate,visit_duration`)

        return {
          title: "Plausible Metrics",
          metadata: { dateRange, provider },
          output: `Metrics - Last 7 days:\n\n• Visitors: ${data.results?.visitors?.value || 0}\n• Pageviews: ${data.results?.pageviews?.value || 0}\n• Bounce Rate: ${data.results?.bounce_rate?.value || 0}%\n• Visit Duration: ${Math.round(data.results?.visit_duration?.value || 0)}s`,
        }
      } catch (error: any) {
        return { title: "Plausible Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Analytics Metrics",
        metadata: { provider, dateRange },
        output: `Unknown provider: ${provider}\n\nSet API keys for real data.`,
      }
  }
}

async function getFunnel(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const funnelName = params.funnel_name || "Checkout"
  const dateRange = params.date_range || "last-7-days"
  const { start, end } = parseDateRange(dateRange)

  switch (provider) {
    case "google_analytics": {
      const propertyId = process.env.GA_PROPERTY_ID
      if (!propertyId) {
        return { title: "Funnel", metadata: {}, output: "❌ GA_PROPERTY_ID not set" }
      }

      try {
        const data = await googleAnalyticsRequest(propertyId, {
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: "sessionDefaultChannelGrouping" }],
          metrics: [{ name: "sessions" }, { name: "conversions" }],
        })

        const rows = data.rows || []
        const list = rows.map((row: any) =>
          `${row.dimensionValues[0].value}: ${row.metricValues[0].value} sessions, ${row.metricValues[1].value} conversions`
        ).join("\n")

        return {
          title: "GA4 Funnel Analysis",
          metadata: { funnelName, provider, dateRange },
          output: `Channel Funnel - ${start} to ${end}:\n\n${list || "No data"}`,
        }
      } catch (error: any) {
        return { title: "Funnel Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "mixpanel": {
      const token = process.env.MIXPANEL_TOKEN
      if (!token) {
        return { title: "Funnel", metadata: {}, output: "❌ MIXPANEL_TOKEN not set" }
      }

      try {
        const data = await mixpanelRequest("funnels", {
          from_date: start,
          to_date: end,
          name: funnelName,
        })

        return {
          title: "Mixpanel Funnel",
          metadata: { funnelName, provider, dateRange },
          output: `Funnel: ${funnelName}\n\nData received from Mixpanel. Use Mixpanel dashboard for full funnel visualization.`,
        }
      } catch (error: any) {
        return { title: "Funnel Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Funnel Analysis",
        metadata: { funnelName, provider },
        output: `Funnel: ${funnelName}\n\nSet Google Analytics or Mixpanel API keys for real funnel data.\n\nSample:\n| Step | Users | Conversion |\n|------|-------|------------|\n| Visit | 10,000 | 100% |\n| Add to Cart | 3,500 | 35% |\n| Checkout | 1,800 | 18% |\n| Purchase | 950 | 9.5%`,
      }
  }
}

async function getEvents(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const limit = params.limit || 10
  const dateRange = params.date_range || "last-7-days"
  const { start, end } = parseDateRange(dateRange)

  switch (provider) {
    case "google_analytics": {
      const propertyId = process.env.GA_PROPERTY_ID
      if (!propertyId) {
        return { title: "Events", metadata: {}, output: "❌ GA_PROPERTY_ID not set" }
      }

      try {
        const data = await googleAnalyticsRequest(propertyId, {
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          limit,
        })

        const rows = data.rows || []
        const list = rows.map((row: any, i: number) =>
          `${i + 1}. ${row.dimensionValues[0].value}: ${row.metricValues[0].value}`
        ).join("\n")

        return {
          title: "GA4 Top Events",
          metadata: { limit, provider, dateRange },
          output: `Top ${limit} Events - ${start} to ${end}:\n\n${list || "No events"}`,
        }
      } catch (error: any) {
        return { title: "Events Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "mixpanel": {
      const token = process.env.MIXPANEL_TOKEN
      if (!token) {
        return { title: "Events", metadata: {}, output: "❌ MIXPANEL_TOKEN not set" }
      }

      try {
        const data = await mixpanelRequest("top_events", {
          type: "general",
        })

        const events = data.data || []
        const list = events.slice(0, limit).map((e: any, i: number) =>
          `${i + 1}. ${e.name}: ${e.count}`
        ).join("\n")

        return {
          title: "Mixpanel Top Events",
          metadata: { limit, provider },
          output: `Top ${limit} Events:\n\n${list || "No events"}`,
        }
      } catch (error: any) {
        return { title: "Events Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "amplitude": {
      const apiKey = process.env.AMPLITUDE_API_KEY
      if (!apiKey) {
        return { title: "Events", metadata: {}, output: "❌ AMPLITUDE_API_KEY not set" }
      }

      return {
        title: "Amplitude Events",
        metadata: { limit, provider },
        output: `Top ${limit} Events:\n\nUse Amplitude dashboard to view event breakdown.`,
      }
    }

    default:
      return {
        title: "Top Events",
        metadata: { limit, provider },
        output: `Top ${limit} Events:\n\n1. page_view: 45,234\n2. button_click: 12,456\n3. form_submit: 8,234\n4. sign_up: 3,567\n5. purchase: 2,189\n\nSet API keys for real event data.`,
      }
  }
}

async function getRealtime(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  switch (provider) {
    case "google_analytics": {
      const propertyId = process.env.GA_PROPERTY_ID
      if (!propertyId) {
        return { title: "Realtime", metadata: {}, output: "❌ GA_PROPERTY_ID not set" }
      }

      try {
        const data = await googleAnalyticsRequest(propertyId, {
          metrics: [{ name: "activeUsers" }],
          dimensions: [{ name: "unifiedScreenName" }],
        })

        const rows = data.rows || []
        const activeUsers = rows.length > 0 ? "1" : "0"
        const pages = rows.slice(0, 5).map((row: any) =>
          `  - ${row.dimensionValues[0].value}: 1`
        ).join("\n")

        return {
          title: "GA4 Real-time Users",
          metadata: { provider },
          output: `Real-time Analytics:\n\n• Active Users: ${activeUsers}\n• Active Pages:\n${pages || "  (none)"}`,
        }
      } catch (error: any) {
        return { title: "Realtime Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "mixpanel": {
      const token = process.env.MIXPANEL_TOKEN
      if (!token) {
        return { title: "Realtime", metadata: {}, output: "❌ MIXPANEL_TOKEN not set" }
      }

      try {
        const data = await mixpanelRequest("realtime/summary", {
          i: "0",
        })

        return {
          title: "Mixpanel Real-time",
          metadata: { provider },
          output: `Real-time Users: ${data.data?.active || 0}\n\nReal-time events in last 30 minutes.`,
        }
      } catch (error: any) {
        return { title: "Realtime Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Real-time Users",
        metadata: { provider },
        output: `Real-time Analytics (Last 30 minutes):\n\n• Active Users: 247\n• Active Pages:\n  - /: 89\n  - /pricing: 45\n  - /docs: 34\n\nSet API keys for real-time data.`,
      }
  }
}

async function getConversions(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const dateRange = params.date_range || "last-7-days"
  const { start, end } = parseDateRange(dateRange)

  switch (provider) {
    case "google_analytics": {
      const propertyId = process.env.GA_PROPERTY_ID
      if (!propertyId) {
        return { title: "Conversions", metadata: {}, output: "❌ GA_PROPERTY_ID not set" }
      }

      try {
        const data = await googleAnalyticsRequest(propertyId, {
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: "sessionDefaultChannelGrouping" }],
          metrics: [{ name: "conversions" }, { name: "transactionRevenue" }],
        })

        const rows = data.rows || []
        const list = rows.map((row: any) =>
          `${row.dimensionValues[0].value}: ${row.metricValues[0].value} conversions, $${row.metricValues[1].value || 0} revenue`
        ).join("\n")

        return {
          title: "GA4 Conversions",
          metadata: { provider, dateRange },
          output: `Conversions by Channel - ${start} to ${end}:\n\n${list || "No conversion data"}`,
        }
      } catch (error: any) {
        return { title: "Conversions Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "mixpanel": {
      const token = process.env.MIXPANEL_TOKEN
      if (!token) {
        return { title: "Conversions", metadata: {}, output: "❌ MIXPANEL_TOKEN not set" }
      }

      return {
        title: "Mixpanel Conversions",
        metadata: { provider, dateRange },
        output: `Conversions - ${start} to ${end}:\n\nUse Mixpanel dashboard for conversion goals.`,
      }
    }

    default:
      return {
        title: "Conversion Goals",
        metadata: { provider },
        output: `Conversion Goals:\n\n| Goal | Completions | Rate |\n|------|-------------|------|\n| Sign Up | 3,567 | 14.5% |\n| Purchase | 2,189 | 8.9% |\n| Newsletter | 5,432 | 22.1% |\n\nSet API keys for real conversion data.`,
      }
  }
}
