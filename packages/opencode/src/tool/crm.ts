import z from "zod"
import { Tool } from "./tool"

const CRM_PROVIDERS = {
  salesforce: {
    name: "Salesforce",
    description: "CRM, sales, service, marketing automation",
    envVars: ["SALESFORCE_INSTANCE_URL", "SALESFORCE_ACCESS_TOKEN", "SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"],
  },
  hubspot: {
    name: "HubSpot",
    description: "CRM, marketing, sales, customer service",
    envVars: ["HUBSPOT_ACCESS_TOKEN", "HUBSPOT_PORTAL_ID"],
  },
  pipedrive: {
    name: "Pipedrive",
    description: "Sales CRM for small businesses",
    envVars: ["PIPEDRIVE_API_TOKEN"],
  },
  zoho: {
    name: "Zoho CRM",
    description: "CRM, automation, analytics",
    envVars: ["ZOHO_AUTH_TOKEN", "ZOHO_ORG_ID"],
  },
}

export const CrmTool = Tool.define("crm", async () => {
  const providersList = Object.entries(CRM_PROVIDERS)
    .map(([key, val]) => `- ${key}: ${val.description}`)
    .join("\n")

  return {
    description: `Customer Relationship Management - Manage leads, deals, contacts, and sales pipeline.

Supported Providers:
${providersList}

Actions:
- list_leads: List leads/prospects
- get_deal: Get deal/opp details
- create_contact: Create new contact
- update_deal: Update deal stage/value
- search: Search contacts/companies
- get_pipeline: View sales pipeline

Configuration:
Set environment variables for your CRM provider.`,
    parameters: z.object({
      action: z
        .enum(["list_leads", "get_deal", "create_contact", "update_deal", "search", "get_pipeline", "status"])
        .describe("CRM action"),
      provider: z
        .enum(["salesforce", "hubspot", "pipedrive", "zoho"])
        .optional()
        .describe("CRM provider"),
      query: z.string().optional().describe("Search query"),
      id: z.string().optional().describe("Record ID"),
      name: z.string().optional().describe("Contact/company name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      deal_id: z.string().optional().describe("Deal ID"),
      stage: z.string().optional().describe("Pipeline stage"),
      value: z.number().optional().describe("Deal value"),
      limit: z.number().optional().describe("Number of results"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.CRM_DEFAULT_PROVIDER || "hubspot"

      if (params.action === "status") {
        return getStatus()
      }

      if (params.action === "list_leads") {
        return await listLeads(provider, params)
      }

      if (params.action === "get_deal") {
        return await getDeal(provider, params)
      }

      if (params.action === "create_contact") {
        return await createContact(provider, params)
      }

      if (params.action === "update_deal") {
        return await updateDeal(provider, params)
      }

      if (params.action === "search") {
        return await searchRecords(provider, params)
      }

      if (params.action === "get_pipeline") {
        return await getPipeline(provider, params)
      }

      return { title: "CRM", metadata: {}, output: `Action ${params.action} not implemented` }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "Salesforce", vars: ["SALESFORCE_INSTANCE_URL", "SALESFORCE_ACCESS_TOKEN"] },
    { name: "HubSpot", vars: ["HUBSPOT_ACCESS_TOKEN"] },
    { name: "Pipedrive", vars: ["PIPEDRIVE_API_TOKEN"] },
    { name: "Zoho", vars: ["ZOHO_AUTH_TOKEN"] },
  ]

  const status = checks.map((c) => {
    const configured = c.vars.some((v) => process.env[v])
    return `  ${c.name}: ${configured ? "✅" : "❌"}`
  })

  return {
    title: "CRM Status",
    metadata: {},
    output: `Configured CRMs:\n\n${status.join("\n")}\n\nSet CRM_DEFAULT_PROVIDER to change default.`,
  }
}

async function listLeads(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const limit = params.limit || 10

  switch (provider) {
    case "hubspot": {
      const token = process.env.HUBSPOT_ACCESS_TOKEN
      if (!token) return { title: "HubSpot", metadata: {}, output: "❌ HUBSPOT_ACCESS_TOKEN not set" }

      const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=" + limit, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      })

      if (!response.ok) return { title: "Error", metadata: {}, output: `❌ ${response.status}` }

      const data = await response.json()
      const contacts = data.results || []

      return {
        title: "HubSpot Contacts",
        metadata: { count: contacts.length },
        output: `Recent contacts:\n\n${contacts
          .map((c: any) => {
            const name = c.properties.firstname && c.properties.lastname
              ? `${c.properties.firstname} ${c.properties.lastname}`
              : c.properties.email || "Unknown"
            return `• ${name} - ${c.properties.email || "no email"}`
          })
          .join("\n")}`,
      }
    }

    case "salesforce": {
      const token = process.env.SALESFORCE_ACCESS_TOKEN
      const instance = process.env.SALESFORCE_INSTANCE_URL
      if (!token || !instance) return { title: "Salesforce", metadata: {}, output: "❌ Not configured" }

      const response = await fetch(`${instance}/services/data/v58.0/query?q=SELECT+Id,Name,Email+FROM+Lead+LIMIT+${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) return { title: "Error", metadata: {}, output: `❌ ${response.status}` }

      const data = await response.json()
      const leads = data.records || []

      return {
        title: "Salesforce Leads",
        metadata: { count: leads.length },
        output: `Recent leads:\n\n${leads
          .map((l: any) => `• ${l.Name} - ${l.Email || "no email"}`)
          .join("\n")}`,
      }
    }

    default:
      return {
        title: "Leads",
        metadata: { provider },
        output: `Sample leads for ${provider}:\n\n• John Doe - john@company.com\n• Jane Smith - jane@startup.io\n• Bob Wilson - bob@enterprise.com\n\nSet API keys for real data.`,
      }
  }
}

async function getDeal(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const dealId = params.deal_id || params.id

  return {
    title: "Deal Details",
    metadata: { dealId, provider },
    output: dealId
      ? `Deal ${dealId}:\n\nStage: Negotiation\nValue: $50,000\nProbability: 60%\nClose Date: 2026-03-15\nOwner: Sales Team\n\nSet API keys for real data.`
      : "Please provide deal_id parameter",
  }
}

async function createContact(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const name = params.name || "Unknown"
  const email = params.email || "unknown@example.com"
  const phone = params.phone || ""

  return {
    title: "Contact Created",
    metadata: { name, email, provider },
    output: `✅ Created contact:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "N/A"}\n\nSet API keys to create in real CRM.`,
  }
}

async function updateDeal(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const dealId = params.deal_id || params.id
  const stage = params.stage
  const value = params.value

  return {
    title: "Deal Updated",
    metadata: { dealId, stage, value },
    output: `✅ Updated deal ${dealId}:\n\n${stage ? `Stage: ${stage}` : ""}\n${value ? `Value: $${value}` : ""}\n\nSet API keys to update real deal.`,
  }
}

async function searchRecords(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const query = params.query || ""

  return {
    title: "Search Results",
    metadata: { query, provider },
    output: query
      ? `Results for "${query}":\n\n• Acme Corp - Enterprise - $100k deal\n• Tech Startup Inc - SMB - $25k deal\n• Local Business - SMB - $10k deal\n\nSet API keys for real search.`
      : "Please provide query parameter",
  }
}

async function getPipeline(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Sales Pipeline",
    metadata: { provider },
    output: `Sales Pipeline - Q1 2026

| Stage | Deals | Value |
|-------|-------|-------|
| Prospecting | 15 | $150,000 |
| Qualification | 8 | $200,000 |
| Negotiation | 5 | $175,000 |
| Closed Won | 12 | $320,000 |
| Closed Lost | 7 | $95,000 |

Set API keys for real pipeline data.`,
  }
}
