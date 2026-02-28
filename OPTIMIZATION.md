# Titan Code Optimization Plan

> Making Titan Code 30% better than Claude Code through superior orchestration

---

## Vision

Even with the same model, Titan Code can outperform Claude Code through:
1. Superior prompt engineering
2. Better tool definitions
3. Smarter context management
4. Unique checkpoint system

---

## Current State Analysis

### System Prompts
- **Location**: `src/session/prompt/*.txt`
- **Quality**: Generic defaults, provider-specific variants
- **Gap**: No task-specific optimization

### Tool Definitions
- **Location**: `src/tool/*.txt`
- **Quality**: Good error handling, inconsistent detail
- **Gap**: Basic descriptions, no smart retry

### Context Management
- **Location**: `src/session/compaction.ts`
- **Quality**: Pruning + summarization
- **Gap**: Rough token estimation, static buffer

---

## Implementation Phases

### Phase 1: Superior Prompt Engineering
**Priority**: 🔴 HIGH | **Impact**: 40% of improvement

#### 1.1 Task-Specific Prompts
Create specialized prompts for different tasks:

```
src/session/prompt/
├── debug.txt      # Chain-of-thought debugging
├── write.txt      # Architecture-first writing
├── review.txt     # Security-focused review
├── refactor.txt   # Safe minimal changes
└── analyze.txt    # Deep codebase analysis
```

#### 1.2 Debug Prompt (Priority)
```txt
# Chain-of-thought debugging
You are debugging code. Follow this process:

1. UNDERSTAND THE ERROR
   - Read the full error message
   - Identify the error type (TypeError, SyntaxError, etc.)
   - Locate the exact line and file

2. FIND THE ROOT CAUSE
   - Check variable values at error point
   - Trace back through call stack
   - Look for similar patterns in codebase

3. FORM HYPOTHESIS
   - State what you think is wrong
   - Explain WHY you think this

4. VERIFY
   - Add logging or breakpoints to confirm
   - Test your hypothesis

5. FIX
   - Apply minimal change
   - Test the fix

Always explain your reasoning step-by-step.
```

#### 1.3 Write Prompt (Priority)
```txt
# Architecture-first writing
Before writing code:

1. ANALYZE THE PROBLEM
   - What is the input?
   - What is the expected output?
   - What are edge cases?

2. DESIGN THE SOLUTION
   - Choose appropriate data structures
   - Consider performance implications
   - Plan for error handling

3. WRITE TESTS FIRST
   - Define success criteria
   - Cover edge cases
   - Write failing test

4. IMPLEMENT
   - Keep functions small and focused
   - Add comments for complex logic
   - Follow project conventions

5. VERIFY
   - Run tests
   - Check for lint errors
```

#### 1.4 Review Prompt
```txt
# Security-focused code review
Review code for:

1. SECURITY
   - SQL injection vulnerabilities
   - XSS vulnerabilities
   - Authentication/authorization issues
   - Secrets in code

2. ERROR HANDLING
   - Are errors handled?
   - Are exceptions caught appropriately?
   - Is logging adequate?

3. PERFORMANCE
   - N+1 queries
   - Unnecessary computations
   - Memory leaks

4. MAINTAINABILITY
   - Clear naming
   - Appropriate abstractions
   - Testability

Provide specific, actionable feedback.
```

---

### Phase 2: Enhanced Tool Definitions
**Priority**: 🔴 HIGH | **Impact**: 25% of improvement

#### 2.1 Standardize Tool Descriptions
All tools should have:
- Description (what it does)
- Parameters (with examples)
- Failure scenarios (what can go wrong)
- Retry strategy (how to recover)

#### 2.2 Add Smart Retry Logic
```typescript
// Example: bash tool retry
const retry = {
  maxAttempts: 3,
  backoff: 'exponential',
  conditions: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND'
  ]
}
```

#### 2.3 Tool-Specific Prompts
Add mini-prompts inside tool definitions:

```typescript
Tool.define("bash", async () => ({
  description: "Execute shell commands...",
  guidance: `
    - Always cd to correct directory first
    - Use relative paths from project root
    - Check command success with $?
    - For git, always check status first
  `,
  examples: [
    { command: "npm run build", context: "Building project" },
    { command: "git status", context: "Check repo state" }
  ]
}))
```

---

### Phase 3: Context Optimization
**Priority**: 🟡 MEDIUM | **Impact**: 20% of improvement

#### 3.1 Better Token Estimation
Replace 4 char/token with tiktoken:
```typescript
// Current (rough)
const tokens = content.length / 4

// Proposed (accurate)
import { encoding_for_model } from 'tiktoken'
const enc = encoding_for_model('claude-3-5-sonnet-20241022')
const tokens = enc.encode(content).length
```

#### 3.2 Dynamic Buffer
```typescript
// Based on model's actual context
const buffer = model.contextWindow * 0.2  // 20% buffer
```

#### 3.3 Async Compaction
```typescript
// Don't block the main loop
async function compact() {
  // Run in background
  const summary = await llm.summarize(messages)
  // Apply when ready
  applySummary(summary)
}
```

---

### Phase 4: Checkpoint System (Killer Feature)
**Priority**: 🔴 HIGH | **Impact**: 15% of improvement

This is unique to Titan Code - Claude Code doesn't have it.

#### 4.1 Data Model
```sql
-- Branches table
CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_commit_id TEXT,
  created_at INTEGER NOT NULL,
  head_commit_id TEXT
);

-- Commits table
CREATE TABLE commits (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  message TEXT,
  snapshot_hash TEXT,
  diff TEXT,
  context TEXT,
  created_at INTEGER NOT NULL
);
```

#### 4.2 Commands
- `/checkpoint` - Create named checkpoint
- `/branch create <name>` - Create branch
- `/branch list` - List branches
- `/branch checkout <name>` - Switch branches
- `/branch merge <source>` - Merge branch

---

### Phase 5: Model-Specific Optimization
**Priority**: 🟡 MEDIUM | **Impact**: Included in prompts

#### 5.1 DeepSeek Optimizations
```txt
# DeepSeek-specific
- Be more explicit in reasoning
- Break complex tasks into smaller steps
- Use fewer parallel tool calls
- Verify each step before proceeding
```

#### 5.2 Sonnet Optimizations
```txt
# Claude Sonnet-specific
- Can handle complex multi-step reasoning
- Good at architecture decisions
- Excellent code generation
- Trust its suggestions
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Code completion success | >90% |
| Debug success rate | >85% |
| Token efficiency | 20% improvement |
| Checkpoint reliability | >99% |

---

## File Changes Required

### New Files
```
src/session/prompt/debug.txt      # NEW
src/session/prompt/write.txt     # NEW
src/session/prompt/review.txt    # NEW
src/session/prompt/refactor.txt  # NEW
src/session/prompt/analyze.txt   # NEW
src/session/compaction-v2.ts     # NEW (async)
src/session/branch.ts            # NEW
src/session/checkpoint.ts        # NEW
```

### Modified Files
```
src/session/prompt.ts            # Add task routing
src/session/system.ts            # Add model-specific
src/tool/registry.ts             # Add retry logic
src/tool/bash.ts                # Add guidance
src/tool/read.ts                # Add examples
src/tool/edit.ts                # Add examples
```

---

## Quick Wins (Start Here)

1. **Create debug.txt** - Biggest immediate impact
2. **Add retry logic to bash** - Fixes common failures
3. **Improve token estimation** - Better context usage
4. **Add checkpoint commands** - Unique feature

---

## Testing Strategy

1. **Baseline**: Run same task in Claude Code and Titan Code
2. **Metrics**: Track success rate, tokens used, time taken
3. **A/B Test**: Toggle optimizations on/off
4. **User Feedback**: Collect real-world usage data

---

*Last updated: 2026-02-28*
*Status: PLANNING*
*Phase: Ready for implementation*
