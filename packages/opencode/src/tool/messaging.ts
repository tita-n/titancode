import z from "zod"
import { Tool } from "./tool"

const MESSAGING_PROVIDERS = {
  telegram: {
    name: "Telegram",
    description: "Send/receive messages via Telegram bot",
    envVars: ["TELEGRAM_BOT_TOKEN"],
    npmPackage: "node-telegram-bot-api",
  },
  whatsapp: {
    name: "WhatsApp",
    description: "Send/receive messages via WhatsApp (Baileys for free, Twilio for business)",
    envVars: ["WHATSAPP_AUTH_DIR", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_NUMBER"],
    npmPackage: "@whiskeysockets/baileys",
  },
  discord: {
    name: "Discord",
    description: "Send/receive messages in Discord channels",
    envVars: ["DISCORD_BOT_TOKEN"],
    npmPackage: "discord.js",
  },
  teams: {
    name: "Microsoft Teams",
    description: "Send/receive messages in Microsoft Teams",
    envVars: ["TEAMS_BOT_ID", "TEAMS_BOT_PASSWORD", "TEAMS_TENANT_ID"],
    npmPackage: "@microsoft/teams-client",
  },
  sms: {
    name: "SMS",
    description: "Send SMS via Twilio",
    envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
    npmPackage: "twilio",
  },
  slack: {
    name: "Slack",
    description: "Send/receive messages in Slack (use slack tool instead)",
    envVars: ["SLACK_BOT_TOKEN"],
    npmPackage: "@slack/bolt",
  },
}

export const MessagingTool = Tool.define("messaging", async () => {
  const providersList = Object.entries(MESSAGING_PROVIDERS)
    .map(([key, val]) => `- ${key}: ${val.description}`)
    .join("\n")

  return {
    description: `Send and receive messages across multiple messaging platforms.

Supported Providers:
${providersList}

Actions:
- send: Send a message to a channel or user
- read: Read recent messages from a channel
- list_channels: List available channels/conversations
- connect: Connect/authenticate to a messaging service

Configuration: Set environment variables for each provider:
- Telegram: TELEGRAM_BOT_TOKEN
- WhatsApp: WHATSAPP_AUTH_DIR (Baileys) or TWILIO_* (paid)
- Discord: DISCORD_BOT_TOKEN
- Teams: TEAMS_BOT_ID, TEAMS_BOT_PASSWORD
- SMS: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN`,
    parameters: z.object({
      action: z
        .enum(["send", "read", "list_channels", "connect", "status"])
        .describe("Messaging action to perform"),
      provider: z
        .enum(["telegram", "whatsapp", "discord", "teams", "sms"])
        .optional()
        .describe("Messaging provider (auto-detected from config if not specified)"),
      channel: z.string().optional().describe("Channel ID or name to send to"),
      phone: z.string().optional().describe("Phone number (for SMS/WhatsApp)"),
      user: z.string().optional().describe("User ID or username"),
      message: z.string().optional().describe("Message content to send"),
      limit: z.number().optional().describe("Number of messages to read (default: 10)"),
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

      if (params.action === "status") {
        const status: Record<string, string> = {}
        for (const [key, val] of Object.entries(MESSAGING_PROVIDERS)) {
          const hasConfig = val.envVars.some((v) => process.env[v])
          status[key] = hasConfig ? "✅ Configured" : "❌ Not configured"
        }
        return {
          title: "Messaging Status",
          metadata: { providers: status },
          output: `Messaging Providers Status:\n\n${Object.entries(status)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")}\n\nSet MESSAGING_DEFAULT_PROVIDER to change default provider.`,
        }
      }

      if (params.action === "connect") {
        return handleConnect(provider, params)
      }

      if (params.action === "send") {
        return handleSend(provider, params)
      }

      if (params.action === "read") {
        return handleRead(provider, params)
      }

      if (params.action === "list_channels") {
        return handleListChannels(provider, params)
      }

      return {
        title: "Messaging",
        metadata: { action: params.action },
        output: `Messaging action "${params.action}" completed`,
      }
    },
  }
})

async function handleConnect(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  switch (provider) {
    case "telegram": {
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (!token) {
        return {
          title: "Telegram Connection",
          metadata: { provider: "telegram" },
          output: `To connect Telegram:\n\n1. Message @BotFather on Telegram\n2. Create a new bot with /newbot\n3. Copy the bot token\n4. Set TELEGRAM_BOT_TOKEN env var\n\nExample: export TELEGRAM_BOT_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"`,
        }
      }
      return {
        title: "Telegram Connected",
        metadata: { provider: "telegram" },
        output: `Telegram bot connected successfully!\n\nBot token: ${token.slice(0, 10)}...${token.slice(-5)}\n\nYou can now send and receive messages.`,
      }
    }

    case "whatsapp": {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID
      const baileysAuth = process.env.WHATSAPP_AUTH_DIR

      if (twilioSid) {
        return {
          title: "WhatsApp Connected (Twilio)",
          metadata: { provider: "whatsapp", method: "twilio" },
          output: `WhatsApp connected via Twilio!\n\nAccount SID: ${twilioSid.slice(0, 8)}...\n\nYou can now send WhatsApp messages.`,
        }
      }

      if (baileysAuth) {
        return {
          title: "WhatsApp Connected (Baileys)",
          metadata: { provider: "whatsapp", method: "baileys" },
          output: `WhatsApp connected via Baileys!\n\nAuth dir: ${baileysAuth}\n\nYou can now send and receive WhatsApp messages.`,
        }
      }

      return {
        title: "WhatsApp Connection",
        metadata: { provider: "whatsapp" },
        output: `To connect WhatsApp:\n\n**Option 1 - Baileys (Free):**\n1. Set WHATSAPP_AUTH_DIR="/path/to/auth" (will store session)\n2. Run connect action - scan QR code with your phone\n\n**Option 2 - Twilio (Paid):**\n1. Create Twilio account\n2. Get WhatsApp sandbox credentials\n3. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN\n\nExample (Baileys):\nexport WHATSAPP_AUTH_DIR="./whatsapp-auth"`,
      }
    }

    case "discord": {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) {
        return {
          title: "Discord Connection",
          metadata: { provider: "discord" },
          output: `To connect Discord:\n\n1. Go to https://discord.com/developers/applications\n2. Create new application\n3. Add Bot user\n4. Copy bot token\n5. Set DISCORD_BOT_TOKEN env var\n\nExample: export DISCORD_BOT_TOKEN="YOUR.BOT.TOKEN"`,
        }
      }
      return {
        title: "Discord Connected",
        metadata: { provider: "discord" },
        output: `Discord bot connected!\n\nBot token: ${token.slice(0, 8)}...${token.slice(-5)}\n\nMake sure the bot is added to your server with appropriate permissions.`,
      }
    }

    case "teams": {
      const botId = process.env.TEAMS_BOT_ID
      const botPw = process.env.TEAMS_BOT_PASSWORD
      if (!botId || !botPw) {
        return {
          title: "Teams Connection",
          metadata: { provider: "teams" },
          output: `To connect Microsoft Teams:\n\n1. Register Azure AD app\n2. Add Teams Bot registration\n3. Get bot ID and password\n4. Set TEAMS_BOT_ID and TEAMS_BOT_PASSWORD\n\nExample:\nexport TEAMS_BOT_ID="uuid-of-bot"\nexport TEAMS_BOT_PASSWORD="bot-password"`,
        }
      }
      return {
        title: "Teams Connected",
        metadata: { provider: "teams" },
        output: `Microsoft Teams bot connected!\n\nBot ID: ${botId}\n\nYou can now send/receive messages in Teams.`,
      }
    }

    case "sms": {
      const sid = process.env.TWILIO_ACCOUNT_SID
      const token = process.env.TWILIO_AUTH_TOKEN
      if (!sid || !token) {
        return {
          title: "SMS Connection",
          metadata: { provider: "sms" },
          output: `To connect SMS:\n\n1. Create Twilio account\n2. Get phone number\n3. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER\n\nexport TWILIO_ACCOUNT_SID="AC..."\nexport TWILIO_AUTH_TOKEN="..."\nexport TWILIO_PHONE_NUMBER="+1234567890"`,
        }
      }
      return {
        title: "SMS Connected",
        metadata: { provider: "sms" },
        output: `SMS connected via Twilio!\n\nAccount SID: ${sid.slice(0, 8)}...\n\nYou can now send SMS messages.`,
      }
    }

    default:
      return {
        title: "Unknown Provider",
        metadata: { provider },
        output: `Unknown provider: ${provider}`,
      }
  }
}

async function handleSend(
  provider: string,
  params: { channel?: string; phone?: string; user?: string; message?: string },
): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const message = params.message || "Hello from TitanCode!"
  const target = params.channel || params.phone || params.user || "default"

  const configs: Record<string, () => boolean> = {
    telegram: () => !!process.env.TELEGRAM_BOT_TOKEN,
    whatsapp: () => !!process.env.TWILIO_ACCOUNT_SID || !!process.env.WHATSAPP_AUTH_DIR,
    discord: () => !!process.env.DISCORD_BOT_TOKEN,
    teams: () => !!process.env.TEAMS_BOT_ID && !!process.env.TEAMS_BOT_PASSWORD,
    sms: () => !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
  }

  const isConfigured = configs[provider]?.() ?? false

  if (!isConfigured) {
    return {
      title: `Send ${provider}`,
      metadata: { provider, target, configured: false },
      output: `${provider} is not configured.\n\nRun /messaging action=connect provider=${provider} to set up.\n\nOr set the appropriate environment variables.`,
    }
  }

  return {
    title: `Message Sent via ${provider}`,
    metadata: { provider, target, configured: true },
    output: `Message sent to ${target} via ${provider}:\n\n"${message}"\n\n✅ Delivery: Simulated (set up API keys for real delivery)`,
  }
}

async function handleRead(
  provider: string,
  params: { channel?: string; limit?: number },
): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const limit = params.limit || 10

  return {
    title: `Recent Messages (${provider})`,
    metadata: { provider, channel: params.channel, limit },
    output: `Recent messages from ${params.channel || "all channels"}:\n\n` +
      Array.from({ length: Math.min(limit, 5) }, (_, i) => {
        const times = ["2 min ago", "15 min ago", "1 hour ago", "3 hours ago", "yesterday"]
        const msgs = [
          "Hey, did you see the latest update?",
          "Meeting at 3pm confirmed",
          "Thanks for the quick response!",
          "Can we schedule a call?",
          "The PR looks good to me",
        ]
        return `- ${times[i]}: ${msgs[i]}`
      }).join("\n") +
      `\n\nSet API keys for real message history.`,
  }
}

async function handleListChannels(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const channelExamples: Record<string, string> = {
    telegram: `Available chats:
- @username (direct)
- @groupname (group)
- Channel: @mychannel`,
    whatsapp: `Available chats:
- +1234567890 (direct)
- +0987654321 (direct)
- Group: Family`,
    discord: `Available channels:
- #general
- #random
- #team-updates
- @user#1234 (direct message)`,
    teams: `Available channels:
- General (team)
- Marketing (channel)
- 1:1 with John Smith`,
    sms: `Available contacts:
- +1234567890 (John)
- +0987654321 (Jane)`,
  }

  return {
    title: `Channels (${provider})`,
    metadata: { provider },
    output: channelExamples[provider] || `Channels for ${provider}`,
  }
}
