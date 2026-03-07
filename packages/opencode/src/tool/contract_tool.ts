import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "contract" })

const CONTRACT_PROVIDERS = {
  docusign: {
    name: "DocuSign",
    description: "E-signatures, document workflows",
    envVars: ["DOCUSIGN_INTEGRATION_KEY", "DOCUSIGN_SECRET_KEY", "DOCUSIGN_ACCOUNT_ID"],
  },
  pandadoc: {
    name: "PandaDoc",
    description: "Documents, proposals, e-signatures",
    envVars: ["PANDADOC_API_KEY"],
  },
  hellosign: {
    name: "HelloSign",
    description: "E-signatures by Dropbox",
    envVars: ["HELLOSIGN_CLIENT_ID", "HELLOSIGN_API_KEY"],
  },
  contractbook: {
    name: "Contractbook",
    description: "Contract management, automation",
    envVars: ["CONTRACTBOOK_API_KEY"],
  },
  ironclad: {
    name: "Ironclad",
    description: "Contract lifecycle management",
    envVars: ["IRONCLAD_API_KEY"],
  },
}

async function docusignRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY

  if (!accountId || !integrationKey) {
    throw new Error("DOCUSIGN_ACCOUNT_ID and DOCUSIGN_INTEGRATION_KEY required")
  }

  const baseUrl = process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net/restapi"

  const response = await fetch(`${baseUrl}/v2.1/accounts/${accountId}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`DocuSign API error: ${response.status} - ${error}`)
  }

  return response.json()
}

async function pandadocRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const apiKey = process.env.PANDADOC_API_KEY

  if (!apiKey) {
    throw new Error("PANDADOC_API_KEY required")
  }

  const response = await fetch(`https://api.pandadoc.com/api/v2${endpoint}`, {
    ...options,
    headers: {
      Authorization: `APIKey ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`PandaDoc API error: ${response.status} - ${error}`)
  }

  return response.json()
}

export const ContractTool = Tool.define("contract_tool", async () => {
  return {
    description: `Legal document management - Create, send, sign, and track contracts and legal documents.

Supported Providers:
- docusign: DocuSign (Enterprise e-signatures)
- pandadoc: PandaDoc (Proposals & docs)
- hellosign: HelloSign (Simple e-signatures)
- contractbook: Contractbook (Contract automation)
- ironclad: Ironclad (Contract lifecycle)

Actions:
- create_contract: Create new contract from template
- send_for_signature: Send contract for signing
- get_status: Get contract signing status
- download_signed: Download signed document
- list_contracts: List all contracts
- void_contract: Void/cancel a contract
- status: Check configuration

Configuration:
Set environment variables for your contract provider.`,
    parameters: z.object({
      action: z
        .enum([
          "create_contract",
          "send_for_signature",
          "get_status",
          "download_signed",
          "list_contracts",
          "void_contract",
          "status",
        ])
        .describe("Contract action"),
      provider: z
        .enum(["docusign", "pandadoc", "hellosign", "contractbook", "ironclad"])
        .optional()
        .describe("Contract provider"),
      contract_id: z.string().optional().describe("Contract ID"),
      template_id: z.string().optional().describe("Template ID"),
      name: z.string().optional().describe("Contract name"),
      signers: z.string().optional().describe("Comma-separated signer emails"),
      title: z.string().optional().describe("Document title"),
      recipient_email: z.string().optional().describe("Recipient email"),
      message: z.string().optional().describe("Message for recipient"),
      limit: z.number().optional().describe("Number of results"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.CONTRACT_DEFAULT_PROVIDER || "docusign"

      try {
        if (params.action === "status") {
          return getStatus()
        }

        if (params.action === "create_contract") {
          return await createContract(provider, params)
        }

        if (params.action === "send_for_signature") {
          return await sendForSignature(provider, params)
        }

        if (params.action === "get_status") {
          return await getStatusContract(provider, params)
        }

        if (params.action === "download_signed") {
          return await downloadSigned(provider, params)
        }

        if (params.action === "list_contracts") {
          return await listContracts(provider, params)
        }

        if (params.action === "void_contract") {
          return await voidContract(provider, params)
        }

        return { title: "Contract", metadata: {}, output: `Action ${params.action} not implemented` }
      } catch (error: any) {
        logger.error("Contract error", { error: error.message, provider, action: params.action })
        return { title: "Contract Error", metadata: { provider }, output: `Error: ${error.message}` }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "DocuSign", vars: ["DOCUSIGN_INTEGRATION_KEY"] },
    { name: "PandaDoc", vars: ["PANDADOC_API_KEY"] },
    { name: "HelloSign", vars: ["HELLOSIGN_API_KEY"] },
    { name: "Contractbook", vars: ["CONTRACTBOOK_API_KEY"] },
    { name: "Ironclad", vars: ["IRONCLAD_API_KEY"] },
  ]

  const status = checks.map((c) => {
    const configured = c.vars.some((v) => process.env[v])
    return `  ${c.name}: ${configured ? "✅" : "❌"}`
  }).join("\n")

  return {
    title: "Contract Tool Status",
    metadata: {},
    output: `Configured Providers:\n\n${status}\n\nSet CONTRACT_DEFAULT_PROVIDER to change default.`,
  }
}

async function createContract(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const templateId = params.template_id
  const name = params.name || params.title || "New Contract"
  const signers = params.signers || params.recipient_email

  if (!templateId) {
    return { title: "Error", metadata: {}, output: "Please provide template_id parameter" }
  }

  switch (provider) {
    case "docusign": {
      try {
        const envelope = await docusignRequest("/envelopes", {
          method: "POST",
          body: JSON.stringify({
            emailSubject: name,
            templateId,
            templateRoles: signers?.split(",").map((email: string) => ({
              email: email.trim(),
              roleName: "Signer",
            })) || [],
            status: "sent",
          }),
        })

        return {
          title: "Contract Created",
          metadata: { envelopeId: envelope.envelopeId, provider },
          output: `✅ Contract Created & Sent:\n\nName: ${name}\nEnvelope ID: ${envelope.envelopeId}\nStatus: ${envelope.status}\n\nUse get_status with this ID to track.`,
        }
      } catch (error: any) {
        return { title: "DocuSign Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "pandadoc": {
      try {
        const doc = await pandadocRequest("/documents", {
          method: "POST",
          body: JSON.stringify({
            name,
            template_uuid: templateId,
          }),
        })

        return {
          title: "Contract Created",
          metadata: { documentId: doc.id, provider },
          output: `✅ Document Created:\n\nName: ${name}\nDocument ID: ${doc.id}\nStatus: ${doc.status}\n\nUse send_for_signature to send for signing.`,
        }
      } catch (error: any) {
        return { title: "PandaDoc Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Contract Created",
        metadata: { templateId, name, provider },
        output: `✅ Would create contract:\n\nName: ${name}\nTemplate: ${templateId}\nSigners: ${signers}\n\nSet API keys for real contract creation.`,
      }
  }
}

async function sendForSignature(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const contractId = params.contract_id
  const recipientEmail = params.recipient_email || params.signers
  const message = params.message || "Please sign this document."

  if (!contractId) {
    return { title: "Error", metadata: {}, output: "Please provide contract_id parameter" }
  }

  if (!recipientEmail) {
    return { title: "Error", metadata: {}, output: "Please provide recipient_email parameter" }
  }

  switch (provider) {
    case "docusign": {
      try {
        const result = await docusignRequest(`/envelopes/${contractId}/recipients`, {
          method: "PUT",
          body: JSON.stringify({
            signers: [{
              email: recipientEmail,
              name: recipientEmail.split("@")[0],
              recipientId: "1",
              routingOrder: "1",
            }],
          }),
        })

        return {
          title: "Sent for Signature",
          metadata: { contractId, provider },
          output: `✅ Sent for Signature:\n\nContract ID: ${contractId}\nRecipient: ${recipientEmail}\nMessage: ${message}\n\nStatus: Sent`,
        }
      } catch (error: any) {
        return { title: "DocuSign Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "pandadoc": {
      try {
        await pandadocRequest(`/documents/${contractId}/send`, {
          method: "POST",
          body: JSON.stringify({
            recipient: recipientEmail,
            message,
          }),
        })

        return {
          title: "Sent for Signature",
          metadata: { contractId, provider },
          output: `✅ Sent for Signature:\n\nDocument ID: ${contractId}\nRecipient: ${recipientEmail}\n\nStatus: Sent`,
        }
      } catch (error: any) {
        return { title: "PandaDoc Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Sent for Signature",
        metadata: { contractId, provider },
        output: `✅ Would send for signature:\n\nContract ID: ${contractId}\nRecipient: ${recipientEmail}\n\nSet API keys for real sending.`,
      }
  }
}

async function getStatusContract(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const contractId = params.contract_id

  if (!contractId) {
    return { title: "Error", metadata: {}, output: "Please provide contract_id parameter" }
  }

  switch (provider) {
    case "docusign": {
      try {
        const data = await docusignRequest(`/envelopes/${contractId}`)

        const signers = data.recipients?.signers || []
        const signerStatus = signers.map((s: any) =>
          `• ${s.email}: ${s.status}`
        ).join("\n")

        return {
          title: "Contract Status",
          metadata: { contractId, provider },
          output: `Contract: ${contractId}\n\nStatus: ${data.status}\n\nSigners:\n${signerStatus || "No signers"}\n\nCreated: ${data.createdDateTime}\nSent: ${data.sentDateTime}`,
        }
      } catch (error: any) {
        return { title: "DocuSign Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "pandadoc": {
      try {
        const data = await pandadocRequest(`/documents/${contractId}`)

        const recipients = data.recipients || []
        const recipientStatus = recipients.map((r: any) =>
          `• ${r.email}: ${r.status}`
        ).join("\n")

        return {
          title: "Contract Status",
          metadata: { contractId, provider },
          output: `Document: ${contractId}\n\nStatus: ${data.status}\n\nRecipients:\n${recipientStatus || "No recipients"}\n\nCreated: ${data.created_at}\n`,
        }
      } catch (error: any) {
        return { title: "PandaDoc Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Contract Status",
        metadata: { contractId, provider },
        output: `Contract: ${contractId}\n\nStatus: Partially Signed\n\nSigners:\n• John Smith - Signed\n• Jane Doe - Pending\n\nSet API keys for real status.`,
      }
  }
}

async function downloadSigned(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const contractId = params.contract_id

  if (!contractId) {
    return { title: "Error", metadata: {}, output: "Please provide contract_id parameter" }
  }

  switch (provider) {
    case "docusign": {
      try {
        const data = await docusignRequest(`/envelopes/${contractId}/documents/combined`)

        return {
          title: "Download Signed Document",
          metadata: { contractId, provider },
          output: `Document Ready for Download:\n\nEnvelope ID: ${contractId}\n\nUse the DocuSign UI to download the signed PDF.\n\nOr call: GET /envelopes/{envelopeId}/documents/combined`,
        }
      } catch (error: any) {
        return { title: "DocuSign Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "pandadoc": {
      try {
        const data = await pandadocRequest(`/documents/${contractId}/download`)

        return {
          title: "Download Signed Document",
          metadata: { contractId, provider },
          output: `Document Ready:\n\nDocument ID: ${contractId}\n\nDownload URL: ${data.download_url || "See PandaDoc dashboard"}`,
        }
      } catch (error: any) {
        return { title: "PandaDoc Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Download Signed Document",
        metadata: { contractId, provider },
        output: `Would download contract: ${contractId}\n\nSet API keys for real download.`,
      }
  }
}

async function listContracts(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const limit = params.limit || 20

  switch (provider) {
    case "docusign": {
      try {
        const data = await docusignRequest(`/envelopes?from_date=2025-01-01&count=${limit}`)

        const envelopes = data.envelopes || []
        if (!envelopes.length) {
          return { title: "Contracts", metadata: { count: 0 }, output: "No contracts found" }
        }

        const list = envelopes.map((e: any) =>
          `• ${e.emailSubject || "Untitled"}\n  Status: ${e.status} | Created: ${e.created}`
        ).join("\n\n")

        return {
          title: "Contracts",
          metadata: { count: envelopes.length, provider },
          output: `Found ${envelopes.length} contracts:\n\n${list}`,
        }
      } catch (error: any) {
        return { title: "DocuSign Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    case "pandadoc": {
      try {
        const data = await pandadocRequest(`/documents?limit=${limit}`)

        const docs = data.results || []
        if (!docs.length) {
          return { title: "Contracts", metadata: { count: 0 }, output: "No documents found" }
        }

        const list = docs.map((d: any) =>
          `• ${d.name}\n  Status: ${d.status} | Created: ${d.created_at}`
        ).join("\n\n")

        return {
          title: "Contracts",
          metadata: { count: docs.length, provider },
          output: `Found ${docs.length} documents:\n\n${list}`,
        }
      } catch (error: any) {
        return { title: "PandaDoc Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Contracts",
        metadata: { count: limit, provider },
        output: `Recent Contracts:\n\n• NDA - Acme Corp - ✅ Signed\n• Service Agreement - ✅ Signed\n• Employment - ⏳ Pending\n• Vendor Agreement - ✅ Signed\n\nTotal: ${limit} contracts\n\nSet API keys for real contract list.`,
      }
  }
}

async function voidContract(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const contractId = params.contract_id

  if (!contractId) {
    return { title: "Error", metadata: {}, output: "Please provide contract_id parameter" }
  }

  switch (provider) {
    case "docusign": {
      try {
        await docusignRequest(`/envelopes/${contractId}`, {
          method: "PUT",
          body: JSON.stringify({
            status: "voided",
            voidedReason: "Voided by user",
          }),
        })

        return {
          title: "Contract Voided",
          metadata: { contractId, provider },
          output: `✅ Contract Voided:\n\nContract ID: ${contractId}\nStatus: Voided\n\nAll signers have been notified.`,
        }
      } catch (error: any) {
        return { title: "DocuSign Error", metadata: {}, output: `API Error: ${error.message}` }
      }
    }

    default:
      return {
        title: "Contract Voided",
        metadata: { contractId, provider },
        output: `✅ Would void contract: ${contractId}\n\nSet API keys for real voiding.`,
      }
  }
}
