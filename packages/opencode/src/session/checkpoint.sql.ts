import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/storage/schema.sql"

export const BranchTable = sqliteTable(
  "branch",
  {
    id: text().primaryKey(),
    session_id: text().notNull(),
    name: text().notNull(),
    parent_commit_id: text(),
    head_commit_id: text(),
    created_at: integer().notNull(),
    updated_at: integer().notNull(),
  },
  (table) => [index("branch_session_idx").on(table.session_id)],
)

export const CommitTable = sqliteTable(
  "commit",
  {
    id: text().primaryKey(),
    branch_id: text().notNull(),
    message: text().notNull(),
    snapshot_hash: text(),
    context: text(),
    created_at: integer().notNull(),
  },
  (table) => [index("commit_branch_idx").on(table.branch_id)],
)
