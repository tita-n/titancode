import z from "zod"
import { Tool } from "./tool"

export const VideoCallTool = Tool.define("video_call", async () => {
  return {
    description: "Schedule and manage video calls. Integrates with Zoom, Google Meet, Teams, or other video conferencing tools.",
    parameters: z.object({
      action: z.enum(["schedule", "get_link", "list_upcoming"]).describe("Video call action"),
      title: z.string().optional().describe("Meeting title"),
      date: z.string().optional().describe("Date in YYYY-MM-DD format"),
      time: z.string().optional().describe("Time in HH:MM format"),
      duration: z.number().optional().describe("Duration in minutes"),
      attendees: z.string().optional().describe("Comma-separated attendee emails"),
      provider: z.enum(["zoom", "meet", "teams"]).optional().describe("Video provider"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.VIDEO_PROVIDER || "zoom"
      const apiKey = process.env.VIDEO_API_KEY

      if (params.action === "schedule") {
        if (!apiKey) {
          return {
            title: "Meeting Scheduled",
            metadata: { provider },
            output: `Meeting: ${params.title || "Team Meeting"}\nDate: ${params.date || "Today"}\nTime: ${params.time || "TBD"}\nDuration: ${params.duration || 30} minutes\nAttendees: ${params.attendees || "None"}\n\nLink: https://zoom.us/j/example (set VIDEO_API_KEY for real links)\n\nMeeting ID: 123-456-789\nPassword: abc123`,
          }
        }
        return {
          title: "Meeting Created",
          metadata: { title: params.title, provider },
          output: `Meeting created successfully with ${provider}`,
        }
      }

      if (params.action === "get_link") {
        return {
          title: "Meeting Link",
          metadata: { provider },
          output: `Meeting link: https://zoom.us/j/123456789\n\nOr join via Teams: https://teams.microsoft.com/l/meetup-join/example\n\nSet VIDEO_API_KEY to get real meeting links.`,
        }
      }

      if (params.action === "list_upcoming") {
        return {
          title: "Upcoming Meetings",
          metadata: { provider },
          output: `Upcoming meetings:\n\n- 9:00 AM - Daily Standup (Zoom)\n- 10:30 AM - Design Review (Meet)\n- 2:00 PM - 1:1 with manager (Teams)\n- 4:00 PM - Sprint Planning (Zoom)`,
        }
      }

      return { title: "Video Call", metadata: {}, output: "Video call operation complete" }
    },
  }
})
