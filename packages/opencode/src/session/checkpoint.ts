import { Identifier } from "../id/id"
import { SessionTable, MessageTable, PartTable } from "./session.sql"
import { BranchTable, CommitTable } from "./checkpoint.sql"
import { Database } from "../storage/db"
import { eq } from "drizzle-orm"

export namespace Checkpoint {
  export async function createCommit(sessionID: string, branchID: string, message: string) {
    const commitID = Identifier.ascending("commit")

    await Database.use((db) =>
      db.insert(CommitTable).values({
        id: commitID,
        branch_id: branchID,
        message,
        created_at: Date.now(),
      }),
    )

    await Database.use((db) =>
      db
        .update(BranchTable)
        .set({ head_commit_id: commitID, updated_at: Date.now() })
        .where(eq(BranchTable.id, branchID)),
    )

    return commitID
  }

  export async function createBranch(sessionID: string, name: string, parentCommitID?: string) {
    const branchID = Identifier.ascending("branch")

    await Database.use((db) =>
      db.insert(BranchTable).values({
        id: branchID,
        session_id: sessionID,
        name,
        parent_commit_id: parentCommitID,
        created_at: Date.now(),
        updated_at: Date.now(),
      }),
    )

    return branchID
  }

  export async function listBranches(sessionID: string) {
    return Database.use((db) => db.select().from(BranchTable).where(eq(BranchTable.session_id, sessionID)))
  }

  export async function listCommits(branchID: string) {
    return Database.use((db) => db.select().from(CommitTable).where(eq(CommitTable.branch_id, branchID)))
  }

  export async function getBranch(branchID: string) {
    const branches = await Database.use((db) =>
      db.select().from(BranchTable).where(eq(BranchTable.id, branchID)),
    )
    return branches[0]
  }

  export async function getCommit(commitID: string) {
    const commits = await Database.use((db) =>
      db.select().from(CommitTable).where(eq(CommitTable.id, commitID)),
    )
    return commits[0]
  }
}
