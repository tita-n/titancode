import z from "zod"
import { Tool } from "./tool"

const CODE_BLOCK_BASH = "```bash\nnpm install\n```"
const CODE_BLOCK_JS = "```javascript\nimport { example } from './index';\n```"
const CODE_BLOCK_JSON = "```json\n{\n  \"users\": [\n    { \"id\": 1, \"name\": \"John\" }\n  ],\n  \"total\": 100\n}\n```"

export const DocGeneratorTool = Tool.define("doc_generator", async () => {
  return {
    description: "Generate documentation from code, specs, or templates. Creates API docs, READMEs, changelogs, and technical documentation.",
    parameters: z.object({
      action: z.enum(["generate_readme", "generate_changelog", "generate_api_docs", "generate_spec", "generate_guide"]).describe("Documentation action"),
      title: z.string().optional().describe("Document title"),
      content: z.string().optional().describe("Content or context for documentation"),
      format: z.enum(["markdown", "html", "pdf"]).optional().describe("Output format"),
      template: z.string().optional().describe("Template to use"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const { action, title, content } = params

      if (action === "generate_readme") {
        return {
          title: "README Generated",
          metadata: { title: title || "Project" },
          output: "# " + (title || "Project Name") + "\n\n" + (content || "A brief description of the project.") + "\n\n## Installation\n\n" + CODE_BLOCK_BASH + "\n\n## Usage\n\n" + CODE_BLOCK_JS + "\n\n## API\n\n| Function | Description | Parameters |\n|----------|-------------|------------|\n| example() | Does something | none |\n\n## Contributing\n\n1. Fork the repository\n2. Create your feature branch\n3. Commit your changes\n4. Push to the branch\n5. Create a Pull Request\n\n## License\n\nMIT",
        }
      }

      if (action === "generate_changelog") {
        const date = new Date().toISOString().split("T")[0]
        return {
          title: "Changelog Generated",
          metadata: {},
          output: "# Changelog\n\n## [Unreleased]\n\n### Added\n- New feature description\n\n### Changed\n- Updated dependencies\n\n### Fixed\n- Bug fix description\n\n## [1.0.0] - " + date + "\n\n### Added\n- Initial release\n\n## [0.1.0] - 2026-01-15\n\n### Added\n- Alpha features",
        }
      }

      if (action === "generate_api_docs") {
        return {
          title: "API Documentation Generated",
          metadata: {},
          output: "# API Documentation\n\n## Endpoints\n\n### GET /api/users\n\nReturns a list of users.\n\n**Parameters:**\n- `limit` (optional): Max results (default: 10)\n- `offset` (optional): Pagination offset\n\n**Response:**\n" + CODE_BLOCK_JSON + "\n\n### POST /api/users\n\nCreate a new user.\n\n**Request Body:**\n```json\n{\n  \"name\": \"string\",\n  \"email\": \"string\"\n}\n```",
        }
      }

      if (action === "generate_spec") {
        return {
          title: "Specification Generated",
          metadata: { title },
          output: "# Specification: " + (title || "Feature") + "\n\n## Overview\n\n" + (content || "Brief description of the feature.") + "\n\n## Requirements\n\n### Functional\n- [ ] Requirement 1\n- [ ] Requirement 2\n- [ ] Requirement 3\n\n### Non-Functional\n- Performance: < 100ms response time\n- Availability: 99.9% uptime\n- Security: HTTPS only\n\n## User Stories\n\n1. As a user, I want to... so that...\n\n## Technical Notes\n\n- Frontend: React\n- Backend: Node.js\n- Database: PostgreSQL\n\n## Acceptance Criteria\n\n- [ ] Criterion 1\n- [ ] Criterion 2",
        }
      }

      if (action === "generate_guide") {
        return {
          title: "Guide Generated",
          metadata: { title },
          output: "# Guide: " + (title || "Getting Started") + "\n\n## Introduction\n\nWelcome to " + (title || "this guide") + ". This document will help you get started.\n\n## Prerequisites\n\n- Requirement 1\n- Requirement 2\n\n## Step 1: Setup\n\nFirst, do this...\n\n" + CODE_BLOCK_BASH + "\n\n## Step 2: Configure\n\nThen configure...\n\n```javascript\nconst config = {\n  key: 'value'\n};\n```\n\n## Step 3: Run\n\nFinally, run the application...\n\n" + CODE_BLOCK_BASH.replace("npm install", "npm start") + "\n\n## Troubleshooting\n\n### Common Issues\n\n**Issue:** Something doesn't work\n**Solution:** Try restarting\n\n## Next Steps\n\n- Explore advanced features\n- Read the API reference\n- Join our community",
        }
      }

      return { title: "Documentation", metadata: {}, output: "Documentation generated" }
    },
  }
})
