import z from "zod"
import { Tool } from "./tool"

export const EmailTool = Tool.define("email", async () => {
  return {
    description: "Send and read emails via any email provider using SMTP/IMAP.",
    parameters: z.object({
      action: z.enum(["send", "read"]),
      smtp_host: z.string().optional().describe("SMTP host (or set SMTP_HOST)"),
      smtp_port: z.number().optional().describe("SMTP port (default 587)"),
      smtp_user: z.string().optional().describe("SMTP user (or set SMTP_USER)"),
      smtp_pass: z.string().optional().describe("SMTP pass (or set SMTP_PASS)"),
      from: z.string().optional().describe("From email"),
      to: z.string().optional().describe("Recipient email"),
      subject: z.string().optional().describe("Email subject"),
      body: z.string().optional().describe("Email body"),
      imap_host: z.string().optional().describe("IMAP host for reading"),
      imap_user: z.string().optional().describe("IMAP user"),
      imap_pass: z.string().optional().describe("IMAP pass"),
    }),
    async execute(params: any, ctx: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      
      if (params.action === "send") {
        const smtpHost = params.smtp_host || process.env.SMTP_HOST || "smtp.gmail.com"
        const smtpPort = params.smtp_port || process.env.SMTP_PORT || 587
        const smtpUser = params.smtp_user || process.env.SMTP_USER
        const smtpPass = params.smtp_pass || process.env.SMTP_PASS
        const from = params.from || process.env.SMTP_FROM || smtpUser
        
        if (!smtpUser || !smtpPass || !params.to || !params.subject) {
          throw new Error("SMTP credentials and (to, subject) required")
        }
        
        // Simple send using nodemailer pattern (simulated for now)
        return { 
          title: "Email send", 
          metadata: { to: params.to, subject: params.subject },
          output: `Would send email:\nFrom: ${from}\nTo: ${params.to}\nSubject: ${params.subject}\n\n${params.body || "(no body)"}` 
        }
      }
      
      if (params.action === "read") {
        const imapHost = params.imap_host || process.env.IMAP_HOST || "imap.gmail.com"
        const imapUser = params.imap_user || process.env.IMAP_USER
        const imapPass = params.imap_pass || process.env.IMAP_PASS
        
        if (!imapUser || !imapPass) {
          throw new Error("IMAP credentials required")
        }
        
        // For now, return info about how to set up
        return {
          title: "Email read",
          metadata: {},
          output: `IMAP read not fully implemented. Connect to ${imapHost} as ${imapUser} to read emails.`
        }
      }
      
      throw new Error(`Unknown action: ${params.action}`)
    },
  }
})
