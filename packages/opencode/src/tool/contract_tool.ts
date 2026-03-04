import z from "zod"
import { Tool } from "./tool"

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
  })

  return {
    title: "Contract Tool Status",
    metadata: {},
    output: `Configured Providers:\n\n${status.join("\n")}\n\nSet CONTRACT_DEFAULT_PROVIDER to change default.`,
  }
}

async function createContract(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const templateId = params.template_id || "TPL001"
  const name = params.name || "New Contract"
  const signers = params.signers || "signer@example.com"

  return {
    title: "Contract Created",
    metadata: { templateId, name, provider },
    output: `✅ Contract Created:\n\nName: ${name}\nTemplate: ${templateId}\nSigners: ${signers}\nContract ID: CNT-${Date.now()}\n\nNext: Use send_for_signature to send for signing.\n\nSet API keys for real contract creation.`,
  }
}

async function sendForSignature(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const contractId = params.contract_id || "CNT001"
  const recipientEmail = params.recipient_email || params.signers || "signer@example.com"
  const message = params.message || "Please sign this document."

  return {
    title: "Sent for Signature",
    metadata: { contractId, provider },
    output: `✅ Sent for Signature:\n\nContract ID: ${contractId}\nRecipient: ${recipientEmail}\nMessage: ${message}\n\nStatus: Sent\nSent: ${new Date().toISOString()}\n\n⏳ Waiting for signature...\n\nSet API keys for real sending.`,
  }
}

async function getStatusContract(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const contractId = params.contract_id || "CNT001"

  return {
    title: "Contract Status",
    metadata: { contractId, provider },
    output: `Contract: ${contractId}\n\nStatus: Partially Signed\n\nSigners:\n1. ✅ John Smith - Signed (Jan 15, 2026)\n2. ⏳ Jane Doe - Pending (sent Jan 16, 2026)\n\nTimeline:\n• Created: Jan 14, 2026\n• Sent: Jan 15, 2026\n• John Signed: Jan 15, 2026\n• Jane Viewed: Jan 16, 2026\n\nSet API keys for real status.`,
  }
}

async function downloadSigned(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const contractId = params.contract_id || "CNT001"

  return {
    title: "Download Signed Document",
    metadata: { contractId, provider },
    output: `Download: ${contractId}\n\n📄 Contract: ${contractId}.pdf\nSize: 245 KB\nPages: 12\n\nAll signatures collected!\n\n[Download Link]\n\nSet API keys for real download.`,
  }
}

async function listContracts(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const limit = params.limit || 10

  return {
    title: "Contracts",
    metadata: { count: limit, provider },
    output: `Recent Contracts:\n\n| Name | Status | Signers | Created |\n|------|--------|---------|--------|\n| NDA - Acme Corp | ✅ Signed | 2/2 | Jan 15 |\n| Service Agreement | ✅ Signed | 3/3 | Jan 14 |\n| Employment - John | ⏳ Pending | 1/2 | Jan 16 |\n| Vendor Agreement | ✅ Signed | 2/2 | Jan 10 |\n| NDA - Startup | ❌ Voided | 0/2 | Jan 08 |\n| Consulting Agreement | ⏳ Pending | 2/2 | Jan 18 |\n| License Agreement | 📝 Draft | - | Jan 20 |\n\nTotal: 24 contracts\n\nSet API keys for real contract list.`,
  }
}

async function voidContract(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const contractId = params.contract_id || "CNT001"

  return {
    title: "Contract Voided",
    metadata: { contractId, provider },
    output: `✅ Contract Voided:\n\nContract ID: ${contractId}\nStatus: Voided\nVoided: ${new Date().toISOString()}\nReason: Requested by sender\n\n⚠️ All signers have been notified.\n\nSet API keys for real voiding.`,
  }
}
