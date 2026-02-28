import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const log = Log.create({ tool: "database" })

let poolInstance: any = null

async function getPool(connectionString: string) {
  if (poolInstance) return poolInstance

  try {
    const { default: pg } = await import("pg")
    poolInstance = new pg.Pool({ connectionString })
    log.info("database connected")
    return poolInstance
  } catch (error) {
    log.error("failed to connect to database", { error })
    throw error
  }
}

export const DatabaseTool = Tool.define("database", async () => {
  return {
    description:
      "Execute SQL queries against a PostgreSQL database. Use this to read data, run analytics queries, and explore database schemas.",

    parameters: z.object({
      action: z
        .enum(["query", "execute", "schema", "tables", "describe"])
        .describe("The database action to perform"),
      connection_string: z
        .string()
        .optional()
        .describe("PostgreSQL connection string (or set DATABASE_URL env var)"),
      query: z.string().optional().describe("SQL query to execute"),
      table: z.string().optional().describe("Table name for describe action"),
    }),

    async execute(
      params: {
        action: string
        connection_string?: string
        query?: string
        table?: string
      },
      ctx: any,
    ): Promise<{ title: string; metadata: Record<string, unknown>; output: string }> {
      const connectionString = params.connection_string || process.env.DATABASE_URL
      if (!connectionString) {
        throw new Error(
          "Database connection string required. Set DATABASE_URL env var or provide connection_string parameter.",
        )
      }

      const pool = await getPool(connectionString)
      const client = await pool.connect()

      try {
        switch (params.action) {
          case "query":
          case "execute": {
            if (!params.query) throw new Error("Query is required for query/execute action")
            const result = await client.query(params.query)
            const rows = result.rows || []
            const output = rows.length > 0 ? JSON.stringify(rows, null, 2) : "No rows returned"
            return {
              title: `Query executed: ${params.query.slice(0, 50)}...`,
              metadata: { rowCount: rows.length },
              output: `Returned ${rows.length} rows:\n${output.slice(0, 10000)}`,
            }
          }

          case "tables": {
            const result = await client.query(`
              SELECT table_name 
              FROM information_schema.tables 
              WHERE table_schema = 'public'
              ORDER BY table_name
            `)
            const tables = result.rows.map((r: any) => r.table_name).join("\n")
            return {
              title: "Database tables",
              metadata: { count: result.rows.length },
              output: `Tables (${result.rows.length}):\n${tables}`,
            }
          }

          case "schema": {
            const result = await client.query(`
              SELECT table_name, column_name, data_type, is_nullable
              FROM information_schema.columns
              WHERE table_schema = 'public'
              ORDER BY table_name, ordinal_position
            `)
            const output = JSON.stringify(result.rows, null, 2)
            return {
              title: "Database schema",
              metadata: { columns: result.rows.length },
              output: `Schema:\n${output.slice(0, 15000)}`,
            }
          }

          case "describe": {
            if (!params.table) throw new Error("Table name is required for describe action")
            const result = await client.query(
              `SELECT column_name, data_type, is_nullable, column_default
               FROM information_schema.columns
               WHERE table_name = $1
               ORDER BY ordinal_position`,
              [params.table],
            )
            const output = JSON.stringify(result.rows, null, 2)
            return {
              title: `Table: ${params.table}`,
              metadata: { columns: result.rows.length },
              output: `Columns:\n${output}`,
            }
          }

          default:
            throw new Error(`Unknown action: ${params.action}`)
        }
      } finally {
        client.release()
      }
    },
  }
})
