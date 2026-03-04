import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "messaging" })

interface MessagingConfig {
  telegram?: { token: string }
  whatsapp?: { type: "twilio" | "baileys"; config: any }
  discord?: { token: string }
  teams?: { botId: string; botPw: string; tenantId: string }
  sms?: { accountSid: string; authToken: string; from: string }
}

export const MessagingTool = Tool.define("messaging", async () => {
  return {
    description: `Send and receive messages across multiple messaging platforms.

Supported Providers:
- telegram: Send messages via Telegram bot (set TELEGRAM_BOT_TOKEN)
- whatsapp: Send via Twilio or Baileys
- discord: Send in Discord channels (set DISCORD_BOT_TOKEN)
- teams: Send in Microsoft Teams
- sms: Send SMS via Twilio

Actions:
- send: Send a message to a channel, user, or phone
- read: Read recent messages (where supported)
- list_channels: List available channels/conversations
- connect: Test connection to a provider
- status: Check provider configuration status

Configuration:
Set these environment variables:
- TELEGRAM_BOT_TOKEN
- DISCORD_BOT_TOKEN
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- WHATSAPP_AUTH_DIR (for Baileys)
- TEAMS_BOT_ID, TEAMS_BOT_PASSWORD, TEAMS_TENANT_ID`,
    parameters: z.object({
      action: z
        .enum(["send", "read", "list_channels", "connect", "status"])
        .describe("Messaging action to perform"),
      provider: z
        .enum(["telegram", "whatsapp", "discord", "teams", "sms"])
        .optional()
        .describe("Messaging provider"),
      channel: z.string().optional().describe("Channel ID, chat ID, or name"),
      phone: z.string().optional().describe("Phone number (for WhatsApp/SMS)"),
      user: z.string().optional().describe("User ID or username"),
      message: z.string().optional().describe("Message content to send"),
      limit: z.number().optional().describe("Number of messages to read"),
    }),
    async execute(
      params: {
        action: string
        provider?: string
        channel?: string
        phone?: string
        user?: string
        message?: string
        limit?: number
      },
      ctx: any,
    ): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.MESSAGING_DEFAULT_PROVIDER || "telegram"

      try {
        if (params.action === "status") {
          return getStatus()
        }

        if (params.action === "connect") {
          return await testConnection(provider)
        }

        if (params.action === "send") {
          return await sendMessage(provider, params)
        }

        if (params.action === "read") {
          return await readMessages(provider, params)
        }

        if (params.action === "list_channels") {
          return await listChannels(provider)
        }

        return {
          title: "Messaging",
          metadata: { action: params.action },
          output: `Unknown action: ${params.action}`,
        }
      } catch (error: any) {
        logger.error("Messaging error", { error: error.message })
        return {
          title: "Messaging Error",
          metadata: { provider, error: error.message },
          output: `Error: ${error.message}`,
        }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "telegram", var: "TELEGRAM_BOT_TOKEN" },
    { name: "discord", var: "DISCORD_BOT_TOKEN" },
    { name: "whatsapp (Twilio)", var: "TWILIO_ACCOUNT_SID" },
    { name: "whatsapp (Baileys)", var: "WHATSAPP_AUTH_DIR" },
    { name: "teams", var: "TEAMS_BOT_ID" },
    { name: "sms", var: "TWILIO_PHONE_NUMBER" },
  ]

  const status = checks.map((c) => {
    const configured = !!process.env[c.var]
    return `  ${c.name}: ${configured ? "✅" : "❌"}`
  })

  return {
    title: "Messaging Status",
    metadata: {},
    output: `Messaging Providers:\n\n${status.join("\n")}\n\nSet MESSAGING_DEFAULT_PROVIDER to change default.`,
  }
}

async function testConnection(provider: string): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  switch (provider) {
    case "telegram": {
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (!token) return { title: "Telegram", metadata: {}, output: "❌ TELEGRAM_BOT_TOKEN not set" }

      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`)
      if (!response.ok) return { title: "Telegram", metadata: {}, output: `❌ API error: ${response.status}` }

      const data = await response.json()
      if (data.ok) {
        return {
          title: "Telegram Connected",
          metadata: { bot: data.result.username },
          output: `✅ Connected as @${data.result.username}\nBot ID: ${data.result.id}`,
        }
      }
      return { title: "Telegram", metadata: {}, output: "❌ Connection failed" }
    }

    case "discord": {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return { title: "Discord", metadata: {}, output: "❌ DISCORD_BOT_TOKEN not set" }

      const response = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bot ${token}` },
      })
      if (!response.ok) return { title: "Discord", metadata: {}, output: `❌ API error: ${response.status}` }

      const data = await response.json()
      return {
        title: "Discord Connected",
        metadata: { user: data.username },
        output: `✅ Connected as ${data.username}#${data.discriminator}\nUser ID: ${data.id}`,
      }
    }

    case "whatsapp": {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID
      const baileysAuth = process.env.WHATSAPP_AUTH_DIR

      if (twilioSid) {
        return {
          title: "WhatsApp (Twilio)",
          metadata: {},
          output: `✅ Twilio configured\nAccount SID: ${twilioSid.slice(0, 8)}...`,
        }
      }

      if (baileysAuth) {
        return {
          title: "WhatsApp (Baileys)",
          metadata: {},
          output: `✅ Baileys configured\nAuth dir: ${baileysAuth}\n\nRun /messaging action=send to connect and scan QR code.`,
        }
      }

      return {
        title: "WhatsApp",
        metadata: {},
        output: `❌ Not configured\n\nSet TWILIO_ACCOUNT_SID or WHATSAPP_AUTH_DIR`,
      }
    }

    case "teams": {
      const botId = process.env.TEAMS_BOT_ID
      const botPw = process.env.TEAMS_BOT_PASSWORD

      if (!botId || !botPw) {
        return { title: "Teams", metadata: {}, output: "❌ TEAMS_BOT_ID or TEAMS_BOT_PASSWORD not set" }
      }

      return {
        title: "Teams Configured",
        metadata: { botId },
        output: `✅ Bot ID: ${botId}\n\nBot must be installed in Teams.`,
      }
    }

    case "sms": {
      const sid = process.env.TWILIO_ACCOUNT_SID
      const token = process.env.TWILIO_AUTH_TOKEN

      if (!sid || !token) {
        return { title: "SMS", metadata: {}, output: "❌ TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set" }
      }

      return {
        title: "SMS (Twilio) Configured",
        metadata: {},
        output: `✅ Account SID: ${sid.slice(0, 8)}...`,
      }
    }

    default:
      return { title: "Unknown", metadata: {}, output: `Unknown provider: ${provider}` }
  }
}

async function sendMessage(
  provider: string,
  params: { channel?: string; phone?: string; user?: string; message?: string },
): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const message = params.message || "Hello from TitanCode!"
  const target = params.channel || params.phone || params.user

  if (!target) {
    return {
      title: "Missing Target",
      metadata: { provider },
      output: `Please specify channel, phone, or user parameter`,
    }
  }

  switch (provider) {
    case "telegram": {
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (!token) return { title: "Telegram", metadata: {}, output: "❌ TELEGRAM_BOT_TOKEN not set" }

      const chatId = parseInt(target) || target
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
      })

      const data = await response.json()
      if (data.ok) {
        return {
          title: "Message Sent",
          metadata: { messageId: data.result.message_id, chat: data.result.chat.title },
          output: `✅ Sent to ${data.result.chat.title || chatId}:\n\n"${message}"`,
        }
      }
      return { title: "Error", metadata: {}, output: `❌ ${data.description}` }
    }

    case "discord": {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return { title: "Discord", metadata: {}, output: "❌ DISCORD_BOT_TOKEN not set" }

      const response = await fetch(`https://discord.com/api/channels/${target}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: message }),
      })

      if (!response.ok) {
        const error = await response.text()
        return { title: "Error", metadata: {}, output: `❌ ${response.status}: ${error}` }
      }

      const data = await response.json()
      return {
        title: "Message Sent",
        metadata: { messageId: data.id },
        output: `✅ Sent to channel ${target}:\n\n"${message}"`,
      }
    }

    case "whatsapp": {
      const sid = process.env.TWILIO_ACCOUNT_SID
      const token = process.env.TWILIO_AUTH_TOKEN
      const from = process.env.TWILIO_WHATSAPP_NUMBER
      const baileysAuth = process.env.WHATSAPP_AUTH_DIR

      // Use Baileys if auth directory is set
      if (baileysAuth) {
        try {
          const { makeWASocket, useMultiFileAuthState } = await import("@whiskeysockets/baileys")
          const { state, saveCreds } = await useMultiFileAuthState(baileysAuth)
          const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
          })

          sock.ev.on("creds.update", saveCreds)

          // Send message
          const jid = target.includes("@s.whatsapp.net") ? target : `${target}@s.whatsapp.net`
          const result = await sock.sendMessage(jid, { text: message })

          return {
            title: "WhatsApp Sent (Baileys)",
            metadata: { jid },
            output: `✅ Sent via Baileys to ${target}:\n\n"${message}"`,
          }
        } catch (e: any) {
          return {
            title: "Baileys Error",
            metadata: {},
            output: `❌ Baileys error: ${e.message}\n\nMake sure @whiskeysockets/baileys is installed.`,
          }
        }
      }

      // Fall back to Twilio
      if (!sid || !token || !from) {
        return {
          title: "WhatsApp Not Configured",
          metadata: {},
          output: `❌ Neither Baileys nor Twilio configured.\n\nOptions:\n1. Baileys (free): Set WHATSAPP_AUTH_DIR="/path/to/auth"\n2. Twilio: Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER`,
        }
      }

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: target.startsWith("whatsapp:") ? target : `whatsapp:${target}`,
          From: `whatsapp:${from}`,
          Body: message,
        }),
      })

      const data = await response.json()
      if (data.sid) {
        return {
          title: "WhatsApp Sent",
          metadata: { sid: data.sid },
          output: `✅ Sent to ${target}:\n\n"${message}"`,
        }
      }
      return { title: "Error", metadata: {}, output: `❌ ${data.message || "Failed"}` }
    }

    case "sms": {
      const sid = process.env.TWILIO_ACCOUNT_SID
      const token = process.env.TWILIO_AUTH_TOKEN
      const from = process.env.TWILIO_PHONE_NUMBER

      if (!sid || !token || !from) {
        return {
          title: "SMS Not Configured",
          metadata: {},
          output: `❌ Twilio not configured\n\nSet TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER`,
        }
      }

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: target,
          From: from,
          Body: message,
        }),
      })

      const data = await response.json()
      if (data.sid) {
        return {
          title: "SMS Sent",
          metadata: { sid: data.sid },
          output: `✅ Sent to ${target}:\n\n"${message}"`,
        }
      }
      return { title: "Error", metadata: {}, output: `❌ ${data.message || "Failed"}` }
    }

    case "teams": {
      return {
        title: "Teams",
        metadata: {},
        output: `⚠️ Teams requires Bot Framework SDK\n\nFor now, use Incoming Webhooks for Teams:\n1. Go to Teams channel settings\n2. Add Incoming Webhook\n3. Use webhook URL directly`,
      }
    }

    default:
      return { title: "Unknown", metadata: {}, output: `Unknown provider: ${provider}` }
  }
}

async function readMessages(
  provider: string,
  params: { channel?: string; limit?: number },
): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const limit = params.limit || 10
  const target = params.channel

  if (!target) {
    return {
      title: "Missing Channel",
      metadata: {},
      output: `Please specify channel parameter`,
    }
  }

  switch (provider) {
    case "telegram": {
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (!token) return { title: "Telegram", metadata: {}, output: "❌ TELEGRAM_BOT_TOKEN not set" }

      const response = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?limit=${limit}`,
      )
      const data = await response.json()

      if (!data.ok) return { title: "Error", metadata: {}, output: `❌ ${data.description}` }

      const messages = data.result
        .slice(-limit)
        .map((m: any) => ({
          from: m.message?.from?.first_name || "Unknown",
          text: m.message?.text || "[media/sticker]",
          time: new Date(m.message?.date * 1000).toLocaleTimeString(),
        }))

      if (!messages.length) {
        return { title: "No Messages", metadata: {}, output: "No messages found. Bot may need to be started by a user." }
      }

      return {
        title: "Telegram Messages",
        metadata: { count: messages.length },
        output: `Recent messages:\n\n${messages
          .map((m: any) => `• ${m.time} ${m.from}: ${m.text}`)
          .join("\n")}`,
      }
    }

    case "discord": {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return { title: "Discord", metadata: {}, output: "❌ DISCORD_BOT_TOKEN not set" }

      const response = await fetch(
        `https://discord.com/api/channels/${target}/messages?limit=${limit}`,
        { headers: { Authorization: `Bot ${token}` } },
      )

      if (!response.ok) return { title: "Error", metadata: {}, output: `❌ ${response.status}` }

      const messages = await response.json()

      return {
        title: "Discord Messages",
        metadata: { count: messages.length },
        output: `Recent messages:\n\n${messages
          .reverse()
          .map((m: any) => `• ${m.author.username}: ${m.content.slice(0, 100)}`)
          .join("\n")}`,
      }
    }

    default:
      return {
        title: "Not Supported",
        metadata: { provider },
        output: `Message reading is not supported for ${provider}`,
      }
  }
}

async function listChannels(provider: string): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  switch (provider) {
    case "telegram": {
      return {
        title: "Telegram",
        metadata: {},
        output: `For Telegram:\n\n1. Add bot to group: @BotFather → /mybots → Manage Groups\n2. For private chats, users must start conversation with bot\n3. Use chat ID (found in @userinfobot)`,
      }
    }

    case "discord": {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return { title: "Discord", metadata: {}, output: "❌ DISCORD_BOT_TOKEN not set" }

      const response = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bot ${token}` },
      })

      if (!response.ok) return { title: "Error", metadata: {}, output: `❌ ${response.status}` }

      const guilds = await response.json()

      return {
        title: "Discord Servers",
        metadata: { count: guilds.length },
        output: `Bot is in ${guilds.length} servers:\n\n${guilds
          .slice(0, 10)
          .map((g: any) => `• ${g.name}`)
          .join("\n")}`,
      }
    }

    case "whatsapp":
    case "sms":
      return {
        title: provider,
        metadata: {},
        output: `Use phone numbers directly:\n\nExamples:\n• +1234567890\n• +0987654321`,
      }

    case "teams":
      return {
        title: "Teams",
        metadata: {},
        output: `Teams requires Azure Bot registration.\n\n1. Register bot in Azure AD\n2. Add to Teams via App Studio\n3. Get channel IDs from Teams admin`,
      }

    default:
      return { title: "Unknown", metadata: {}, output: `Unknown provider: ${provider}` }
  }
}
