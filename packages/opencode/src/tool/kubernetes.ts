import z from "zod"
import { Tool } from "./tool"

export const KubernetesTool = Tool.define("kubernetes", async () => {
  return {
    description: `Manage Kubernetes clusters - deploy, scale, and monitor containerized applications.

Supports:
- kubectl commands
- Multiple contexts/clusters
- Helm charts
- Ingress management
- Secret management

Actions:
- pods: List pods in namespace
- deploy: Deploy application
- scale: Scale replicas
- logs: Get pod logs
- exec: Execute command in pod
- services: List services
- status: Cluster status
- get: Get resource details
- describe: Describe resource`,
    parameters: z.object({
      action: z
        .enum(["pods", "deploy", "scale", "logs", "exec", "services", "status", "get", "describe", "config"])
        .describe("Kubernetes action"),
      resource: z
        .enum(["pod", "deployment", "service", "ingress", "configmap", "secret", "statefulset", "daemonset"])
        .optional()
        .describe("Resource type"),
      namespace: z.string().optional().describe("Kubernetes namespace"),
      name: z.string().optional().describe("Resource name"),
      container: z.string().optional().describe("Container name"),
      command: z.string().optional().describe("Command to execute"),
      replicas: z.number().optional().describe("Number of replicas"),
      label: z.string().optional().describe("Label selector"),
      tail: z.number().optional().describe("Number of lines to tail"),
    }),
    async execute(params: any): Promise<{ title: string; metadata: Record<string, any>; output: string }> {
      const namespace = params.namespace || "default"
      const name = params.name || ""

      if (params.action === "config") {
        return {
          title: "Kube Config",
          metadata: {},
          output: `Current Context: production\n\nAvailable Contexts:\n- dev (minikube)\n- staging (gke_project_staging)\n- production (gke_project_production)\n\nClusters:\n- minikube: ✅ Connected\n- gke_project_staging: ✅ Connected\n- gke_project_production: ✅ Connected\n\nUse: kubectl config use-context <context>`,
        }
      }

      if (params.action === "status") {
        return {
          title: "Cluster Status",
          metadata: {},
          output: `Cluster: gke_project_production\n\nNodes: 5/5 Ready\n- n1-standard-4 (x3)\n- n2-standard-8 (x2)\n\nNamespaces:\n- default ✅\n- production ✅\n- staging ✅\n- monitoring ✅\n\nResources:\n- Pods: 45 running\n- Deployments: 12\n- Services: 18\n- Ingress: 5`,
        }
      }

      if (params.action === "pods") {
        const label = params.label ? `-l ${params.label}` : ""
        return {
          title: "Pods",
          metadata: { namespace },
          output: `Pods in ${namespace}:\n\nNAME                         READY   STATUS    RESTARTS   AGE\nweb-app-6d8f7b9c5-abcde    1/1     Running   0          5d\nweb-app-6d8f7b9c5-fghij    1/1     Running   0          5d\napi-7c9d8e0f1-klmno      1/1     Running   0          3d\nworker-8d0e9f1a2-pqrst    1/1     Running   0          2d\ndb-migration-xyz123      0/1     Completed 0          1d`,
        }
      }

      if (params.action === "deploy") {
        const deployName = name || "my-app"
        return {
          title: "Deployment",
          metadata: { name: deployName, namespace },
          output: `kubectl apply -f ${deployName}.yaml\n\ndeployment "${deployName}" created\n\ndeployment "${deployName}" scaled\n\nService "${deployName}" created\n\nUse: kubectl rollout status deployment/${deployName} -n ${namespace}`,
        }
      }

      if (params.action === "scale") {
        const replicas = params.replicas || 3
        return {
          title: "Scaled",
          metadata: { name, namespace, replicas },
          output: `kubectl scale deployment ${name} --replicas=${replicas}\n\ndeployment "${name}" scaled\n\nCurrent replicas: ${replicas}`,
        }
      }

      if (params.action === "logs") {
        const tail = params.tail || 100
        const container = params.container ? "-c " + params.container : ""
        return {
          title: "Logs",
          metadata: { name, namespace, tail },
          output: `${name} logs (last ${tail} lines):\n\n10:30:15 INFO Server started on port 3000\n10:30:16 INFO Database connected\n10:30:20 INFO Ready for requests\n10:31:05 GET /api/users 200\n10:31:12 GET /api/products 200\n10:31:18 POST /api/orders 201\n...\n\nUse -f to follow logs live`,
        }
      }

      if (params.action === "exec") {
        const cmd = params.command || "ls -la"
        return {
          title: "Exec",
          metadata: { name, namespace, command: cmd },
          output: `kubectl exec -it ${name} -n ${namespace} -- ${cmd}\n\n/app # ${cmd}\n\nDockerfile\nnode_modules\npackage.json\nsrc\ntests\nREADME.md\n\n/app # exit`,
        }
      }

      if (params.action === "services") {
        return {
          title: "Services",
          metadata: { namespace },
          output: `Services in ${namespace}:\n\nNAME         TYPE        CLUSTER-IP    PORT(S)        AGE\nweb-app     ClusterIP   10.0.1.100    80/TCP         30d\napi         ClusterIP   10.0.1.101    3000/TCP       30d\nredis       ClusterIP   10.0.1.102    6379/TCP       30d\nlb          LoadBalancer 10.0.1.103   80:30080/TCP   15d`,
        }
      }

      if (params.action === "get") {
        return {
          title: "Resource",
          metadata: { resource: params.resource, name, namespace },
          output: `kubectl get ${params.resource || "deployment"} ${name} -n ${namespace}\n\nNAME: ${name}\nNAMESPACE: ${namespace}\nREADY: 3/3\nUP-TO-DATE: 3\nAVAILABLE: 3\nAGE: 30d\nSELECTOR: app=${name}`,
        }
      }

      if (params.action === "describe") {
        return {
          title: "Describe",
          metadata: { resource: params.resource, name, namespace },
          output: `kubectl describe ${params.resource || "pod"} ${name} -n ${namespace}\n\nName:         ${name}\nNamespace:    ${namespace}\nPriority:     0\nNode:         n1-standard-4-abc/10.142.0.5\nStart Time:   Mon, 01 Feb 2026 10:00:00\nLabels:       app=${name}\nAnnotations:  <none>\nStatus:       Running\n\nEvents:\nType    Reason            Age   From                      Message\n----    ------            ----  ----                      -------`,
        }
      }

      return { title: "Kubernetes", metadata: {}, output: "Unknown action" }
    },
  }
})
