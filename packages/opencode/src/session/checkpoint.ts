import { Identifier } from "../id/id"
import { SessionTable, MessageTable, PartTable } from "./session.sql"
import { BranchTable, CommitTable } from "./checkpoint.sql"
import { Database } from "../storage/db"
import { eq } from "drizzle-orm"
import { Snapshot } from "../snapshot"
import { Log } from "../util/log"

const log = Log.create({ service: "checkpoint" })

export namespace Checkpoint {
  export async function createCheckpoint(sessionID: string, message: string) {
    const branches = await listBranches(sessionID)
    let branch = branches.find((b) => b.name === "main")

    if (!branch) {
      const branchID = await createBranch(sessionID, "main")
      branch = await getBranch(branchID)
    }

    if (!branch) {
      throw new Error("Failed to create or find main branch")
    }

    const snapshotHash = await Snapshot.track()

    const commitID = Identifier.ascending("commit")

    await Database.use((db) =>
      db.insert(CommitTable).values({
        id: commitID,
        branch_id: branch.id,
        message,
        snapshot_hash: snapshotHash ?? undefined,
        created_at: Date.now(),
      }),
    )

    await Database.use((db) =>
      db
        .update(BranchTable)
        .set({ head_commit_id: commitID, updated_at: Date.now() })
        .where(eq(BranchTable.id, branch.id)),
    )

    log.info("checkpoint created", { sessionID, commitID, message })

    return { commitID, branchID: branch.id }
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

    log.info("branch created", { sessionID, branchID, name })

    return branchID
  }

  export async function createCommit(sessionID: string, branchID: string, message: string) {
    const commitID = Identifier.ascending("commit")
    const snapshotHash = await Snapshot.track()

    await Database.use((db) =>
      db.insert(CommitTable).values({
        id: commitID,
        branch_id: branchID,
        message,
        snapshot_hash: snapshotHash ?? undefined,
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

  export async function listBranches(sessionID: string) {
    return Database.use((db) =>
      db.select().from(BranchTable).where(eq(BranchTable.session_id, sessionID)),
    )
  }

  export async function listCommits(branchID: string) {
    return Database.use((db) =>
      db.select().from(CommitTable).where(eq(CommitTable.branch_id, branchID)),
    )
  }

  export async function getBranch(branchID: string) {
    const branches = await Database.use((db) =>
      db.select().from(BranchTable).where(eq(BranchTable.id, branchID)),
    )
    return branches[0]
  }

  export async function getBranchByName(sessionID: string, name: string) {
    const branches = await Database.use((db) =>
      db
        .select()
        .from(BranchTable)
        .where(eq(BranchTable.session_id, sessionID)),
    )
    return branches.find((b) => b.name === name)
  }

  export async function getCommit(commitID: string) {
    const commits = await Database.use((db) =>
      db.select().from(CommitTable).where(eq(CommitTable.id, commitID)),
    )
    return commits[0]
  }

  export async function restoreToCommit(commitID: string) {
    const commit = await getCommit(commitID)
    if (!commit) {
      throw new Error("Commit not found")
    }

    if (commit.snapshot_hash) {
      await Snapshot.restore(commit.snapshot_hash)
      log.info("restored to checkpoint", { commitID, snapshot: commit.snapshot_hash })
    }

    return commit
  }

  export async function deleteBranch(branchID: string) {
    const commits = await listCommits(branchID)
    for (const commit of commits) {
      await Database.use((db) =>
        db.delete(CommitTable).where(eq(CommitTable.id, commit.id)),
      )
    }

    await Database.use((db) =>
      db.delete(BranchTable).where(eq(BranchTable.id, branchID)),
    )

    log.info("branch deleted", { branchID })
  }
}
