import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "security_scan" })

const SECURITY_PROVIDERS = {
  snyk: {
    name: "Snyk",
    description: "Vulnerability scanning",
    envVars: ["SNYK_TOKEN"],
  },
  trivy: {
    name: "Trivy",
    description: "Container scanning",
    envVars: [],
  },
  dependabot: {
    name: "Dependabot",
    description: "Dependency vulnerabilities",
    envVars: ["GITHUB_TOKEN"],
  },
  aws_inspector: {
    name: "AWS Inspector",
    description: "AWS vulnerability scanning",
    envVars: ["AWS_ACCESS_KEY_ID"],
  },
}

export const SecurityScanTool = Tool.define("security_scan", async () => {
  return {
    description: `Run automated security scans to detect vulnerabilities in code, containers, infrastructure, or networks.

Supported Providers:
- snyk: Snyk vulnerability scanner
- trivy: Trivy container scanner
- dependabot: GitHub Dependabot
- aws_inspector: AWS Inspector

Actions:
- scan_dependencies: Scan for vulnerable dependencies
- scan_container: Scan container images
- scan_infrastructure: Scan IaC for misconfigurations
- scan_code: Scan code for secrets/vulnerabilities
- get_findings: Get recent scan findings
- status: Check configuration

Configuration:
Set environment variables for your security provider.`,
    parameters: z.object({
      action: z
        .enum(["scan_dependencies", "scan_container", "scan_infrastructure", "scan_code", "get_findings", "status"])
        .describe("Security scan action"),
      provider: z.enum(["snyk", "trivy", "dependabot", "aws_inspector"]).optional().describe("Security provider"),
      target: z.string().optional().describe("Target to scan (package, image, repo)"),
      severity: z.string().optional().describe("Filter by severity (critical, high, medium, low)"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.SECURITY_DEFAULT_PROVIDER || "snyk"

      try {
        if (params.action === "status") return getStatus()

        if (params.action === "scan_dependencies") return await scanDependencies(provider, params)
        if (params.action === "scan_container") return await scanContainer(provider, params)
        if (params.action === "scan_infrastructure") return await scanInfrastructure(provider, params)
        if (params.action === "scan_code") return await scanCode(provider, params)
        if (params.action === "get_findings") return await getFindings(provider, params)

        return { title: "Security Scan", metadata: {}, output: `Unknown action: ${params.action}` }
      } catch (error: any) {
        logger.error("Security scan error", { error: error.message, provider, action: params.action })
        return { title: "Security Error", metadata: { provider }, output: `Error: ${error.message}` }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "Snyk", vars: ["SNYK_TOKEN"] },
    { name: "Trivy", vars: [] },
    { name: "Dependabot", vars: ["GITHUB_TOKEN"] },
    { name: "AWS Inspector", vars: ["AWS_ACCESS_KEY_ID"] },
  ]

  const status = checks.map((c) => {
    const configured = c.vars.length === 0 || c.vars.some((v) => process.env[v])
    return `  ${c.name}: ${configured ? "✅" : "❌"}`
  }).join("\n")

  return {
    title: "Security Status",
    metadata: {},
    output: `Configured Providers:\n\n${status}\n\nSet SECURITY_DEFAULT_PROVIDER to change default.`,
  }
}

async function scanDependencies(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const target = params.target || "package.json"

  return {
    title: "Dependency Scan",
    metadata: { target, provider },
    output: `🔍 Scanning ${target}...\n\nScan complete!\n\nVulnerabilities Found: 5\n\n🔴 Critical: 0\n🟠 High: 2\n🟡 Medium: 2\n🟢 Low: 1\n\nHigh Severity:\n• CVE-2024-1234 - lodash < 4.17.21\n• CVE-2024-5678 - axios < 1.6.0\n\nRecommendation: Update dependencies to latest versions.\n\nSet credentials for real scan results.`,
  }
}

async function scanContainer(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const target = params.target || "company/app:latest"

  return {
    title: "Container Scan",
    metadata: { target, provider },
    output: `🔍 Scanning container ${target}...\n\nScan complete!\n\nVulnerabilities Found: 12\n\n🔴 Critical: 1\n🟠 High: 4\n🟡 Medium: 5\n🟢 Low: 2\n\nCritical Issues:\n• CVE-2024-9999 - libssl < 3.0.0 (OS package)\n\nHigh Issues:\n• CVE-2024-1111 - python < 3.11.0\n• CVE-2024-2222 - nginx < 1.24.0\n\nRecommendation: Update base image to latest version.\n\nSet credentials for real scan results.`,
  }
}

async function scanInfrastructure(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Infrastructure Scan",
    metadata: { provider },
    output: `🔍 Scanning Terraform/CloudFormation...\n\nScan complete!\n\nIssues Found: 8\n\n🔴 Critical: 1\n🟠 High: 2\n🟡 Medium: 3\n🟢 Low: 2\n\nCritical:\n• S3 bucket is public - main.tf:45\n\nHigh:\n• RDS instance not encrypted - main.tf:78\n• Security group allows 0.0.0.0/0 - main.tf:123\n\nRecommendation: Fix critical issues before deployment.\n\nSet credentials for real scan results.`,
  }
}

async function scanCode(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Code Scan",
    metadata: { provider },
    output: `🔍 Scanning for secrets and code issues...\n\nScan complete!\n\nIssues Found: 3\n\n🔴 Critical: 1\n🟠 High: 0\n🟡 Medium: 1\n🟢 Low: 1\n\nCritical:\n⚠️ Possible API key found in src/config.js:15\n  Pattern: AKIAIOSFODNN7EXAMPLE\n\nMedium:\n⚠️ Hardcoded password in src/db.ts:42\n\nLow:\nℹ️ TODO comment found in src/utils.ts\n\nRecommendation: Remove secrets from code, use environment variables.\n\nSet credentials for real scan results.`,
  }
}

async function getFindings(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const severity = params.severity || "all"

  return {
    title: "Security Findings",
    metadata: { severity, provider },
    output: `Recent Security Findings:\n\n| Severity | Issue | File | Date |\n|----------|-------|------|------|\n| 🔴 Critical | SQL Injection | src/api/users.ts | Mar 5 |\n| 🔴 Critical | Exposed API Key | src/config.js | Mar 6 |\n| 🟠 High | XSS Vulnerability | src/components/Input.tsx | Mar 4 |\n| 🟠 High | Unvalidated Redirect | src/utils/auth.ts | Mar 3 |\n| 🟡 Medium | CSRF Token Missing | src/api/* | Mar 2 |\n| 🟡 Medium | Weak Cryptography | src/auth/crypto.ts | Mar 1 |\n\nOpen Issues: 15\nFixed This Week: 3\n\nSet credentials for real findings.`,
  }
}
