import z from "zod"
import { Tool } from "./tool"

export const PlanningTool = Tool.define("planning", async () => {
  return {
    description: "Create plans, roadmaps, and strategic documents. Use for planning product strategy, feature roadmaps, and project planning.",
    parameters: z.object({
      action: z.enum(["create_plan", "create_roadmap", "create_user_stories", "estimate_effort", "identify_risks"]).describe("Planning action"),
      title: z.string().describe("Title of the plan"),
      content: z.string().describe("Details/content for the plan"),
      format: z.enum(["markdown", "表格", "bullet_points"]).optional().describe("Output format"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const { action, title, content } = params

      if (action === "create_plan") {
        return {
          title: "Plan Created",
          metadata: { action, title },
          output: `# ${title}\n\n${content}\n\n## Next Steps\n- [ ] Define scope\n- [ ] Identify stakeholders\n- [ ] Set timeline\n- [ ] Allocate resources`,
        }
      }

      if (action === "create_roadmap") {
        return {
          title: "Roadmap Created",
          metadata: { action, title },
          output: `# ${title} - Roadmap\n\n## Q1\n- [ ] ${content}\n\n## Q2\n- [ ] Plan feature\n\n## Q3\n- [ ] Future work\n\n## Q4\n- [ ] Future work`,
        }
      }

      if (action === "create_user_stories") {
        const stories = content.split("\n").filter(Boolean).map((item: string) => 
          `As a ${item.split(",")[0] || "user"}, I want to ${item.split(",")[1] || "accomplish goal"} so that ${item.split(",")[2] || "I get value"}`
        ).join("\n\n")
        return {
          title: "User Stories Created",
          metadata: { action, count: stories.split("\n").length },
          output: `# User Stories\n\n${stories}\n\n## Acceptance Criteria\n- [ ] Define clear acceptance criteria for each story\n- [ ] Include edge cases\n- [ ] Add acceptance tests`,
        }
      }

      if (action === "identify_risks") {
        return {
          title: "Risks Identified",
          metadata: { action, title },
          output: `# Risk Assessment - ${title}\n\n## Identified Risks\n${content}\n\n## Mitigation Strategies\n- [ ] Risk 1: Mitigation strategy\n- [ ] Risk 2: Mitigation strategy\n\n## Contingency Plans\n- [ ] Have backup plans ready`,
        }
      }

      return {
        title: "Planning Complete",
        metadata: { action, title },
        output: `Planning completed for: ${title}\n\n${content}`,
      }
    },
  }
})
