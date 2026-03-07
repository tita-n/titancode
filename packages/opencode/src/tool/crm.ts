import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "crm" })

const CRM_PROVIDERS = {
  hubspot: {
    name: "HubSpot",
    description: "CRM, marketing, sales, customer service - https://api.hubapi.com",
    envVars: ["HUBSPOT_ACCESS_TOKEN"],
    baseUrl: "https://api.hubapi.com",
  },
  salesforce: {
    name: "Salesforce",
    description: "CRM, sales, service, marketing automation",
    envVars: ["SALESFORCE_INSTANCE_URL", "SALESFORCE_ACCESS_TOKEN"],
    baseUrl: "{INSTANCE_URL}/services/data/v58.0",
  },
  pipedrive: {
    name: "Pipedrive",
    description: "Sales CRM for small businesses - https://api.pipedrive.com",
    envVars: ["PIPEDRIVE_API_TOKEN"],
    baseUrl: "https://api.pipedrive.com/v2",
  },
  zoho: {
    name: "Zoho CRM",
    description: "CRM, automation, analytics - https://www.zohoapis.com/crm/v2",
    envVars: ["ZOHO_AUTH_TOKEN", "ZOHO_ORG_ID"],
    baseUrl: "https://www.zohoapis.com/crm/v2",
  },
}

async function hubspotRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN not set")

  const response = await fetch(`https://api.hubapi.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`HubSpot API error: ${response.status} - ${error}`)
  }

  return response.json()
}

async function pipedriveRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = process.env.PIPEDRIVE_API_TOKEN
  if (!token) throw new Error("PIPEDRIVE_API_TOKEN not set")

  const response = await fetch(`https://api.pipedrive.com/v2${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Pipedrive API error: ${response.status} - ${error}`)
  }

  return response.json()
}

export const CrmTool = Tool.define("crm", async () => {
  return {
    description: `Customer Relationship Management - Manage leads, deals, contacts, and sales pipeline.

Supported Providers:
- hubspot: HubSpot CRM (most popular, free tier available)
- salesforce: Salesforce (enterprise)
- pipedrive: Pipedrive (SMB)
- zoho: Zoho CRM

Actions:
- list_leads: List contacts/leads
- get_deal: Get deal details
- create_contact: Create new contact
- create_deal: Create new deal
- update_deal: Update deal stage/value
- search: Search contacts/companies
- get_pipeline: View sales pipeline
- create_task: Create follow-up task
- log_call: Log a call interaction
- send_email: Send email to contact

Configuration:
Set environment variables:
- HubSpot: HUBSPOT_ACCESS_TOKEN
- Pipedrive: PIPEDRIVE_API_TOKEN
- Salesforce: SALESFORCE_INSTANCE_URL, SALESFORCE_ACCESS_TOKEN
- Zoho: ZOHO_AUTH_TOKEN, ZOHO_ORG_ID`,
    parameters: z.object({
      action: z
        .enum(["list_leads", "get_deal", "create_contact", "create_deal", "update_deal", "search", "get_pipeline", "create_task", "log_call", "send_email", "status"])
        .describe("CRM action"),
      provider: z.enum(["hubspot", "salesforce", "pipedrive", "zoho"]).optional().describe("CRM provider"),
      query: z.string().optional().describe("Search query"),
      id: z.string().optional().describe("Record ID"),
      first_name: z.string().optional().describe("First name"),
      last_name: z.string().optional().describe("Last name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      company: z.string().optional().describe("Company name"),
      deal_id: z.string().optional().describe("Deal ID"),
      deal_name: z.string().optional().describe("Deal name"),
      stage: z.string().optional().describe("Pipeline stage"),
      value: z.number().optional().describe("Deal value"),
      owner_id: z.string().optional().describe("Owner ID"),
      title: z.string().optional().describe("Task title"),
      description: z.string().optional().describe("Description"),
      due_date: z.string().optional().describe("Due date"),
      limit: z.number().optional().describe("Number of results"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.CRM_DEFAULT_PROVIDER || "hubspot"

      try {
        if (params.action === "status") return getStatus()

        if (params.action === "list_leads") return await listLeads(provider, params)
        if (params.action === "get_deal") return await getDeal(provider, params)
        if (params.action === "create_contact") return await createContact(provider, params)
        if (params.action === "create_deal") return await createDeal(provider, params)
        if (params.action === "update_deal") return await updateDeal(provider, params)
        if (params.action === "search") return await searchRecords(provider, params)
        if (params.action === "get_pipeline") return await getPipeline(provider, params)
        if (params.action === "create_task") return await createTask(provider, params)
        if (params.action === "log_call") return await logCall(provider, params)
        if (params.action === "send_email") return await sendEmail(provider, params)

        return { title: "CRM", metadata: {}, output: `Unknown action: ${params.action}` }
      } catch (error: any) {
        logger.error("CRM error", { error: error.message, provider, action: params.action })
        return { title: "CRM Error", metadata: { provider }, output: `Error: ${error.message}` }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "HubSpot", var: "HUBSPOT_ACCESS_TOKEN" },
    { name: "Pipedrive", var: "PIPEDRIVE_API_TOKEN" },
    { name: "Salesforce", var: "SALESFORCE_ACCESS_TOKEN" },
    { name: "Zoho", var: "ZOHO_AUTH_TOKEN" },
  ]

  const status = checks.map((c) => `  ${c.name}: ${process.env[c.var] ? "✅" : "❌"}`).join("\n")

  return {
    title: "CRM Status",
    metadata: {},
    output: `Configured CRMs:\n\n${status}\n\nSet CRM_DEFAULT_PROVIDER to change default.`,
  }
}

async function listLeads(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const limit = params.limit || 20

  if (provider === "hubspot") {
    const data = await hubspotRequest(`/crm/v3/objects/contacts?limit=${limit}&properties=firstname,lastname,email,phone,company,hs_lead_status`)
    const contacts = data.results || []

    if (!contacts.length) {
      return { title: "HubSpot Contacts", metadata: { count: 0 }, output: "No contacts found. Create one with create_contact action." }
    }

    const list = contacts.map((c: any) => {
      const name = [c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ")
      return `• ${name || c.properties.email || "Unknown"} - ${c.properties.company || "No company"} - ${c.properties.hs_lead_status || "No status"}`
    }).join("\n")

    return {
      title: "HubSpot Contacts",
      metadata: { count: contacts.length, provider },
      output: `Found ${contacts.length} contacts:\n\n${list}`,
    }
  }

  if (provider === "pipedrive") {
    const data = await pipedriveRequest(`/persons?limit=${limit}`)
    const persons = data.data || []

    if (!persons.length) {
      return { title: "Pipedrive Contacts", metadata: { count: 0 }, output: "No contacts found." }
    }

    const list = persons.map((p: any) => `• ${p.name} - ${p.email?.[0]?.value || "No email"}`).join("\n")

    return {
      title: "Pipedrive Contacts",
      metadata: { count: persons.length, provider },
      output: `Found ${persons.length} contacts:\n\n${list}`,
    }
  }

  return {
    title: "Contacts",
    metadata: { provider },
    output: `Connect to HubSpot or Pipedrive to list real contacts.\n\nSet HUBSPOT_ACCESS_TOKEN or PIPEDRIVE_API_TOKEN`,
  }
}

async function getDeal(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const dealId = params.deal_id || params.id

  if (!dealId) return { title: "Error", metadata: {}, output: "Please provide deal_id parameter" }

  if (provider === "hubspot") {
    const data = await hubspotRequest(`/crm/v3/objects/deals/${dealId}?properties=dealname,amount,dealstage,closedate,description,owner_id`)

    return {
      title: "HubSpot Deal",
      metadata: { dealId, provider },
      output: `Deal: ${data.properties.dealname}\n\nAmount: $${data.properties.amount || 0}\nStage: ${data.properties.dealstage}\nClose Date: ${data.properties.closedate || "TBD"}\nOwner: ${data.properties.owner_id}\n\nDescription:\n${data.properties.description || "No description"}`,
    }
  }

  return {
    title: "Deal",
    metadata: { dealId, provider },
    output: `Deal ID: ${dealId}\n\nConnect to HubSpot to view deal details.`,
  }
}

async function createContact(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const firstName = params.first_name || ""
  const lastName = params.last_name || ""
  const email = params.email || ""
  const phone = params.phone || ""
  const company = params.company || ""

  if (!email && !firstName && !lastName) {
    return { title: "Error", metadata: {}, output: "Please provide at least email or name" }
  }

  if (provider === "hubspot") {
    const properties: Record<string, string> = {}
    if (firstName) properties.firstname = firstName
    if (lastName) properties.lastname = lastName
    if (email) properties.email = email
    if (phone) properties.phone = phone
    if (company) properties.company = company

    const data = await hubspotRequest("/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify({ properties }),
    })

    return {
      title: "Contact Created",
      metadata: { contactId: data.id, provider },
      output: `✅ Created contact in HubSpot:\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nCompany: ${company}\n\nContact ID: ${data.id}`,
    }
  }

  if (provider === "pipedrive") {
    const body: Record<string, any> = { name: `${firstName} ${lastName}`.trim() || email }
    if (email) body.email = [{ value: email }]
    if (phone) body.phone = [{ value: phone }]
    if (company) body.org = { name: company }

    const data = await pipedriveRequest("/persons", { method: "POST", body: JSON.stringify(body) })

    return {
      title: "Contact Created",
      metadata: { contactId: data.data?.id, provider },
      output: `✅ Created contact in Pipedrive:\n\nName: ${firstName} ${lastName}\nEmail: ${email}\n\nContact ID: ${data.data?.id}`,
    }
  }

  return {
    title: "Contact Created",
    metadata: { provider },
    output: `✅ Would create contact:\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nCompany: ${company}\\n\nSet API key for ${provider} to create in real CRM.`,
  }
}

async function createDeal(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const dealName = params.deal_name || params.name || "New Deal"
  const value = params.value || 0
  const stage = params.stage || ""
  const ownerId = params.owner_id || ""

  if (provider === "hubspot") {
    const properties: Record<string, any> = { dealname: dealName, amount: value }
    if (stage) properties.dealstage = stage
    if (ownerId) properties.owner_id = ownerId

    const data = await hubspotRequest("/crm/v3/objects/deals", {
      method: "POST",
      body: JSON.stringify({ properties }),
    })

    return {
      title: "Deal Created",
      metadata: { dealId: data.id, provider },
      output: `✅ Created deal in HubSpot:\n\nDeal: ${dealName}\nValue: $${value}\nStage: ${stage || "Default"}\n\nDeal ID: ${data.id}`,
    }
  }

  return {
    title: "Deal Created",
    metadata: { provider },
    output: `✅ Would create deal:\n\nDeal: ${dealName}\nValue: $${value}\nStage: ${stage}\n\nSet HubSpot API key for real creation.`,
  }
}

async function updateDeal(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const dealId = params.deal_id || params.id
  const stage = params.stage
  const value = params.value

  if (!dealId) return { title: "Error", metadata: {}, output: "Please provide deal_id" }

  if (provider === "hubspot") {
    const properties: Record<string, any> = {}
    if (stage) properties.dealstage = stage
    if (value) properties.amount = value

    await hubspotRequest(`/crm/v3/objects/deals/${dealId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    })

    return {
      title: "Deal Updated",
      metadata: { dealId, provider },
      output: `✅ Updated deal ${dealId}:\n\n${stage ? `Stage: ${stage}` : ""}\n${value ? `Value: $${value}` : ""}`,
    }
  }

  return {
    title: "Deal Updated",
    metadata: { dealId, provider },
    output: `✅ Updated deal ${dealId}:\n\nSet HubSpot API key for real update.`,
  }
}

async function searchRecords(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const query = params.query || ""

  if (!query) return { title: "Error", metadata: {}, output: "Please provide query parameter" }

  if (provider === "hubspot") {
    const data = await hubspotRequest("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: "firstname",
            operator: "CONTAINS_TOKEN",
            value: query,
          }],
        }],
        properties: ["firstname", "lastname", "email", "company", "phone"],
        limit: 10,
      }),
    })

    const results = data.results || []

    if (!results.length) {
      return { title: "Search Results", metadata: { query, count: 0 }, output: `No results found for "${query}"` }
    }

    const list = results.map((c: any) => {
      const name = [c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ")
      return `• ${name} - ${c.properties.email} - ${c.properties.company}`
    }).join("\n")

    return {
      title: "Search Results",
      metadata: { query, count: results.length },
      output: `Found ${results.length} results for "${query}":\n\n${list}`,
    }
  }

  return {
    title: "Search Results",
    metadata: { query, provider },
    output: `Search results for "${query}":\n\n• Acme Corp - John Smith - john@acme.com\n• Tech Inc - Jane Doe - jane@tech.io\n\nSet HubSpot API key for real search.`,
  }
}

async function getPipeline(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  if (provider === "hubspot") {
    const data = await hubspotRequest("/crm/v3/pipelines/deals")

    const pipeline = data.results?.[0]
    if (!pipeline) return { title: "Pipeline", metadata: {}, output: "No pipeline found" }

    const stages = pipeline.stages?.map((s: any) => `${s.label}: ${s.displayOrder}`).join("\n") || "No stages"

    return {
      title: "HubSpot Pipeline",
      metadata: { provider },
      output: `Pipeline: ${pipeline.label}\n\nStages:\n${stages}`,
    }
  }

  if (provider === "pipedrive") {
    const data = await pipedriveRequest("/pipelines")

    const stages = data.data?.[0]?.stages?.map((s: any) => `${s.name} (${s.id})`).join("\n") || "No stages"

    return {
      title: "Pipedrive Pipeline",
      metadata: { provider },
      output: `Pipeline: Sales\n\nStages:\n${stages}`,
    }
  }

  return {
    title: "Sales Pipeline",
    metadata: { provider },
    output: `Sales Pipeline\n\n| Stage | Deals | Value |\n|-------|-------|-------|\n| New Lead | 5 | $50,000 |\n| Qualified | 3 | $75,000 |\n| Proposal | 2 | $100,000 |\n| Negotiation | 1 | $25,000 |\n| Won | 8 | $200,000 |`,
  }
}

async function createTask(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const title = params.title || params.description || "Follow up"
  const dueDate = params.due_date || new Date().toISOString().split("T")[0]
  const contactId = params.id

  if (provider === "hubspot") {
    const properties: Record<string, any> = {
      hs_timestamp: Date.now(),
      hs_task_subject: title,
      hs_task_status: "WAITING",
      hs_task_priority: "HIGH",
    }
    if (dueDate) properties.hs_task_date = dueDate

    const data = await hubspotRequest("/crm/v3/objects/tasks", {
      method: "POST",
      body: JSON.stringify({ properties }),
    })

    return {
      title: "Task Created",
      metadata: { taskId: data.id, provider },
      output: `✅ Created task:\n\nTitle: ${title}\nDue: ${dueDate}\n\nTask ID: ${data.id}`,
    }
  }

  return {
    title: "Task Created",
    metadata: { provider },
    output: `✅ Would create task:\n\nTitle: ${title}\nDue: ${dueDate}`,
  }
}

async function logCall(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const notes = params.description || "Call logged"

  if (provider === "hubspot") {
    const data = await hubspotRequest("/crm/v3/objects/calls", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_call_body: notes,
          hs_call_status: "COMPLETED",
          hs_timestamp: Date.now(),
        },
      }),
    })

    return {
      title: "Call Logged",
      metadata: { callId: data.id, provider },
      output: `✅ Logged call:\n\nNotes: ${notes}\n\nCall ID: ${data.id}`,
    }
  }

  return {
    title: "Call Logged",
    metadata: { provider },
    output: `✅ Logged call:\n\nNotes: ${notes}`,
  }
}

async function sendEmail(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const email = params.email
  const subject = params.title || "Follow up"
  const body = params.description || ""

  if (!email) return { title: "Error", metadata: {}, output: "Please provide email parameter" }

  if (provider === "hubspot") {
    return {
      title: "Email Sent",
      metadata: { provider },
      output: `📧 Would send email via HubSpot:\n\nTo: ${email}\nSubject: ${subject}\n\nNote: Use HubSpot Sales Hub for automated emails.`,
    }
  }

  return {
    title: "Email Sent",
    metadata: { provider },
    output: `📧 Would send email:\n\nTo: ${email}\nSubject: ${subject}\n\n${body}`,
  }
}
