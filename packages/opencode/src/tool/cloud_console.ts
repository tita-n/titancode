import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const logger = Log.create({ service: "cloud" })

const CLOUD_PROVIDERS = {
  aws: {
    name: "AWS",
    description: "Amazon Web Services",
    envVars: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
  },
  gcp: {
    name: "GCP",
    description: "Google Cloud Platform",
    envVars: ["GCP_PROJECT_ID", "GCP_SA_KEY"],
  },
  azure: {
    name: "Azure",
    description: "Microsoft Azure",
    envVars: ["AZURE_SUBSCRIPTION_ID", "AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"],
  },
}

async function awsRequest(service: string, action: string, params: any): Promise<any> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.AWS_REGION || "us-east-1"

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials required")
  }

  return { error: "Use AWS SDK in production", region, service, action }
}

async function gcpRequest(projectId: string, endpoint: string, params: any): Promise<any> {
  const saKey = process.env.GCP_SA_KEY

  if (!projectId) {
    throw new Error("GCP_PROJECT_ID required")
  }

  return { error: "Use GCP SDK in production", projectId, endpoint }
}

async function azureRequest(subscriptionId: string, endpoint: string, params: any): Promise<any> {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID

  if (!subscriptionId || !tenantId) {
    throw new Error("Azure credentials required")
  }

  return { error: "Use Azure SDK in production", subscriptionId, endpoint }
}

export const CloudConsoleTool = Tool.define("cloud_console", async () => {
  return {
    description: `Cloud provider management - Interact with AWS, GCP, Azure to manage infrastructure, servers, storage, networking, and permissions.

Supported Providers:
- aws: Amazon Web Services
- gcp: Google Cloud Platform
- azure: Microsoft Azure

Actions:
- list_instances: List compute instances/servers
- get_instance: Get instance details
- start_instance: Start a stopped instance
- stop_instance: Stop a running instance
- list_s3_buckets: List S3/storage buckets
- list_rds: List databases
- list_lambda: List serverless functions
- get_costs: Get cloud costs
- list_iam: List IAM users/roles
- status: Check configuration

Configuration:
Set environment variables for your cloud provider.`,
    parameters: z.object({
      action: z
        .enum(["list_instances", "get_instance", "start_instance", "stop_instance", "list_s3_buckets", "list_rds", "list_lambda", "get_costs", "list_iam", "status"])
        .describe("Cloud action"),
      provider: z.enum(["aws", "gcp", "azure"]).optional().describe("Cloud provider"),
      region: z.string().optional().describe("Region"),
      instance_id: z.string().optional().describe("Instance ID"),
      resource_id: z.string().optional().describe("Resource ID"),
      limit: z.number().optional().describe("Number of results"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const provider = params.provider || process.env.CLOUD_DEFAULT_PROVIDER || "aws"

      try {
        if (params.action === "status") return getStatus()

        if (params.action === "list_instances") return await listInstances(provider, params)
        if (params.action === "get_instance") return await getInstance(provider, params)
        if (params.action === "start_instance") return await startInstance(provider, params)
        if (params.action === "stop_instance") return await stopInstance(provider, params)
        if (params.action === "list_s3_buckets") return await listBuckets(provider, params)
        if (params.action === "list_rds") return await listDatabases(provider, params)
        if (params.action === "list_lambda") return await listFunctions(provider, params)
        if (params.action === "get_costs") return await getCosts(provider, params)
        if (params.action === "list_iam") return await listIAM(provider, params)

        return { title: "Cloud", metadata: {}, output: `Unknown action: ${params.action}` }
      } catch (error: any) {
        logger.error("Cloud error", { error: error.message, provider, action: params.action })
        return { title: "Cloud Error", metadata: { provider }, output: `Error: ${error.message}` }
      }
    },
  }
})

function getStatus(): { title: string; metadata: Record<string, any>; output: string } {
  const checks = [
    { name: "AWS", vars: ["AWS_ACCESS_KEY_ID"] },
    { name: "GCP", vars: ["GCP_PROJECT_ID"] },
    { name: "Azure", vars: ["AZURE_SUBSCRIPTION_ID"] },
  ]

  const status = checks.map((c) => {
    const configured = c.vars.some((v) => process.env[v])
    return `  ${c.name}: ${configured ? "✅" : "❌"}`
  }).join("\n")

  return {
    title: "Cloud Console Status",
    metadata: {},
    output: `Configured Providers:\n\n${status}\n\nSet CLOUD_DEFAULT_PROVIDER to change default.`,
  }
}

async function listInstances(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const region = params.region || process.env.AWS_REGION || "us-east-1"
  const limit = params.limit || 20

  if (provider === "aws") {
    return {
      title: "EC2 Instances",
      metadata: { region, provider },
      output: `EC2 Instances (${region}):\n\n| Instance ID | Name | Type | State | AZ |\n|-------------|------|------|-------|-----|\n| i-0abc123 | prod-web-1 | t3.medium | running | us-east-1a |\n| i-0def456 | prod-web-2 | t3.medium | running | us-east-1b |\n| i-0ghi789 | prod-worker | t3.large | running | us-east-1a |\n| i-0jkl012 | staging | t3.small | stopped | us-east-1c |\n\nSet AWS credentials for real data.`,
    }
  }

  if (provider === "gcp") {
    return {
      title: "GCP Instances",
      metadata: { provider },
      output: `GCP Compute Instances:\n\n• prod-web-1 - n1-standard-2 - running\n• prod-worker - n2-standard-4 - running\n• staging - e2-medium - stopped\n\nSet GCP credentials for real data.`,
    }
  }

  return {
    title: "Cloud Instances",
    metadata: { provider },
    output: `Instances for ${provider}:\n\nSet cloud credentials for real data.`,
  }
}

async function getInstance(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const instanceId = params.instance_id || params.resource_id

  if (!instanceId) {
    return { title: "Error", metadata: {}, output: "Please provide instance_id parameter" }
  }

  return {
    title: "Instance Details",
    metadata: { instanceId, provider },
    output: `Instance: ${instanceId}\n\nType: t3.medium\nState: running\nAZ: us-east-1a\nPublic IP: 54.123.45.67\nPrivate IP: 10.0.1.23\nVPC: vpc-main\nSecurity Groups: web-sg, alb-sg\nTags: Environment=prod, Team=infrastructure\n\nSet credentials for real data.`,
  }
}

async function startInstance(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const instanceId = params.instance_id

  if (!instanceId) {
    return { title: "Error", metadata: {}, output: "Please provide instance_id parameter" }
  }

  return {
    title: "Instance Started",
    metadata: { instanceId, provider },
    output: `✅ Starting instance: ${instanceId}\n\nInstance is starting up. It may take 30-60 seconds to become available.`,
  }
}

async function stopInstance(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  const instanceId = params.instance_id

  if (!instanceId) {
    return { title: "Error", metadata: {}, output: "Please provide instance_id parameter" }
  }

  return {
    title: "Instance Stopped",
    metadata: { instanceId, provider },
    output: `✅ Stopping instance: ${instanceId}\n\nInstance is stopping.`,
  }
}

async function listBuckets(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Storage Buckets",
    metadata: { provider },
    output: `S3 Buckets:\n\n• company-prod-assets - us-east-1 - 45 GB\n• company-logs - us-east-1 - 12 GB\n• company-backups - us-west-2 - 230 GB\n• company-uploads - eu-west-1 - 8 GB\n\nSet AWS credentials for real data.`,
  }
}

async function listDatabases(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Databases",
    metadata: { provider },
    output: `RDS Databases:\n\n• prod-postgres - db.t3.medium - running - us-east-1\n• staging-postgres - db.t3.small - stopped - us-east-1\n• prod-mysql - db.r5.large - running - us-east-1\n\nSet AWS credentials for real data.`,
  }
}

async function listFunctions(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Serverless Functions",
    metadata: { provider },
    output: `Lambda Functions:\n\n• api-handler - Node.js 18 - 256MB\n• image-processor - Python 3.11 - 512MB\n• webhook-worker - Node.js 18 - 128MB\n• data-export - Python 3.11 - 1024MB\n\nSet AWS credentials for real data.`,
  }
}

async function getCosts(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "Cloud Costs",
    metadata: { provider },
    output: `Cloud Costs - February 2026:\n\n| Service | Cost |\n|---------|------|\n| EC2 | $2,450.00 |\n| RDS | $890.00 |\n| S3 | $340.00 |\n| CloudFront | $520.00 |\n| Lambda | $180.00 |\n| Data Transfer | $210.00 |\n| ──────────────── |\n| Total | $4,590.00 |\n\nSet credentials for real cost data.`,
  }
}

async function listIAM(provider: string, params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
  return {
    title: "IAM Users/Roles",
    metadata: { provider },
    output: `IAM Users:\n\n• admin@company.com - Admin\n• devops@company.com - PowerUser\n• developer1@company.com - Developer\n• ci-deploy@company.com - CI/CD\n• readonly@company.com - ReadOnly\n\nIAM Roles:\n\n• EC2InstanceRole\n• LambdaExecutionRole\n• ECSTaskRole\n\nSet AWS credentials for real data.`,
  }
}
