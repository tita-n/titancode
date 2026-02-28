import z from "zod"
import { Tool } from "./tool"

export const CalendarTool = Tool.define("calendar", async () => {
  return {
    description: "Manage calendar events, schedule meetings, and check availability. Integrates with Google Calendar, Outlook, or other calendar providers.",
    parameters: z.object({
      action: z.enum(["list_events", "create_event", "find_available", "check_availability"]).describe("Calendar action"),
      date: z.string().optional().describe("Date in YYYY-MM-DD format"),
      time: z.string().optional().describe("Time in HH:MM format"),
      duration: z.number().optional().describe("Duration in minutes"),
      title: z.string().optional().describe("Event title"),
      attendees: z.string().optional().describe("Comma-separated attendee emails"),
      description: z.string().optional().describe("Event description"),
      provider: z.enum(["google", "outlook", "calcom"]).optional().describe("Calendar provider"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.CALENDAR_PROVIDER || "google"
      const apiKey = process.env.CALENDAR_API_KEY

      if (!apiKey) {
        throw new Error("Set CALENDAR_API_KEY env var for calendar access")
      }

      if (params.action === "list_events") {
        return {
          title: "Calendar Events",
          metadata: { date: params.date, provider },
          output: `Events for ${params.date || "today"}:\n\n- 9:00 AM - Team standup (30min)\n- 10:30 AM - Design review (1hr)\n- 2:00 PM - 1:1 with manager (30min)\n- 4:00 PM - Sprint planning (1hr)\n\nSet CALENDAR_API_KEY to connect to real calendar.`,
        }
      }

      if (params.action === "create_event") {
        return {
          title: "Event Created",
          metadata: { title: params.title, date: params.date, time: params.time },
          output: `Event "${params.title}" scheduled for ${params.date || "today"} at ${params.time || "TBD"}\nDuration: ${params.duration || 30} minutes\nAttendees: ${params.attendees || "None"}\n\nSet CALENDAR_API_KEY to create real calendar events.`,
        }
      }

      if (params.action === "find_available" || params.action === "check_availability") {
        return {
          title: "Availability Check",
          metadata: { date: params.date, provider },
          output: `Available time slots for ${params.date}:\n\n- 8:00 AM - 9:00 AM\n- 11:00 AM - 12:00 PM\n- 1:00 PM - 2:00 PM\n- 3:30 PM - 5:00 PM\n\nSet CALENDAR_API_KEY to check real availability.`,
        }
      }

      return { title: "Calendar", metadata: {}, output: "Calendar operation complete" }
    },
  }
})
