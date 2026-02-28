import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const log = Log.create({ service: "tool.browser" })

let browserInstance: any = null
let pageInstance: any = null

async function getBrowser() {
  if (browserInstance) return browserInstance

  try {
    const { chromium } = await import("playwright")
    browserInstance = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
    log.info("browser launched")
    return browserInstance
  } catch (error) {
    log.error("failed to launch browser", { error })
    throw error
  }
}

async function ensurePage() {
  if (!pageInstance) {
    const browser = await getBrowser()
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    })
    pageInstance = await context.newPage()
  }
  try {
    await pageInstance.goto("about:blank", { timeout: 1000 }).catch(() => {})
  } catch {
    const browser = await getBrowser()
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    pageInstance = await context.newPage()
  }
  return pageInstance
}

export const BrowserTool = Tool.define("browser", async () => {
  return {
    description:
      "Control a headless browser for web automation, scraping, and testing. Use this to navigate websites, fill forms, click elements, extract data, and take screenshots.",

    parameters: z.object({
      action: z
        .enum([
          "navigate",
          "click",
          "type",
          "screenshot",
          "extract",
          "getHtml",
          "scroll",
          "wait",
          "back",
          "forward",
        ])
        .describe("The browser action to perform"),
      url: z.string().optional().describe("URL to navigate to (for navigate action)"),
      selector: z.string().optional().describe("CSS selector for the element"),
      text: z.string().optional().describe("Text to type or extract"),
      direction: z.enum(["up", "down", "top", "bottom"]).optional().describe("Scroll direction"),
    }),

    async execute(params: {
      action: string
      url?: string
      selector?: string
      text?: string
      direction?: string
    }, ctx: any): Promise<{ title: string; metadata: Record<string, unknown>; output: string }> {
      const page = await ensurePage()

      switch (params.action) {
        case "navigate": {
          if (!params.url) throw new Error("URL is required for navigate action")
          const response = await page.goto(params.url, { waitUntil: "networkidle", timeout: 30000 })
          const title = await page.title()
          const url = page.url()
          return {
            title: `Navigated to ${url}`,
            metadata: { url, title, status: response?.status() || 200 },
            output: `Title: ${title}\nURL: ${url}`,
          }
        }

        case "click": {
          if (!params.selector) throw new Error("Selector is required for click action")
          await page.click(params.selector, { timeout: 10000 })
          return {
            title: `Clicked element: ${params.selector}`,
            metadata: {},
            output: `Successfully clicked ${params.selector}`,
          }
        }

        case "type": {
          if (!params.selector) throw new Error("Selector is required for type action")
          if (!params.text) throw new Error("Text is required for type action")
          await page.fill(params.selector, params.text)
          return {
            title: `Typed into: ${params.selector}`,
            metadata: {},
            output: `Typed "${params.text}" into ${params.selector}`,
          }
        }

        case "screenshot": {
          const screenshot = await page.screenshot({ fullPage: true })
          const base64 = screenshot.toString("base64")
          return {
            title: "Screenshot captured",
            metadata: { screenshot: base64 },
            output: `[Screenshot captured - ${screenshot.length} bytes]`,
          }
        }

        case "extract": {
          if (!params.selector) throw new Error("Selector is required for extract action")
          const elements = await page.locator(params.selector).all()
          const texts: string[] = []
          for (const el of elements) {
            const text = await el.textContent()
            if (text) texts.push(text)
          }
          return {
            title: `Extracted from: ${params.selector}`,
            metadata: { count: texts.length, content: texts.join("\n") },
            output: texts.join("\n"),
          }
        }

        case "getHtml": {
          const html = await page.content()
          return {
            title: "Page HTML retrieved",
            metadata: { html: html.slice(0, 50000), length: html.length },
            output: html.slice(0, 50000) + (html.length > 50000 ? "\n... (truncated)" : ""),
          }
        }

        case "scroll": {
          if (!params.direction) throw new Error("Direction is required for scroll action")
          switch (params.direction) {
            case "up":
              await page.evaluate(() => window.scrollBy(0, -500))
              break
            case "down":
              await page.evaluate(() => window.scrollBy(0, 500))
              break
            case "top":
              await page.evaluate(() => window.scrollTo(0, 0))
              break
            case "bottom":
              await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
              break
          }
          return {
            title: `Scrolled ${params.direction}`,
            metadata: {},
            output: `Scrolled ${params.direction}`,
          }
        }

        case "wait": {
          if (!params.selector) throw new Error("Selector is required for wait action")
          await page.waitForSelector(params.selector, { timeout: 30000 })
          return {
            title: `Waited for: ${params.selector}`,
            metadata: {},
            output: `Element ${params.selector} appeared`,
          }
        }

        case "back": {
          await page.goBack()
          const title = await page.title()
          return { title: "Went back", metadata: {}, output: `Now at: ${title}` }
        }

        case "forward": {
          await page.goForward()
          const title = await page.title()
          return { title: "Went forward", metadata: {}, output: `Now at: ${title}` }
        }

        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    },
  }
})
