# Proposer Rules: Coding Plan Debate

> **debateType:** `coding_plan_debate`
> 
> **Context:** Proposer is submitting an implementation plan for Opponent review

## 1. Proposer Objectives

- Present plan clearly with proper structure
- Defend technical decisions with reasoning
- Be ready to revise when feedback is valid
- Ensure final plan achieves consensus from both parties

## 2. MOTION Content Structure

> **IMPORTANT:** Plan file already contains full details per `create-plan.md` template (References, Objective, Key Considerations, Implementation Plan phases, etc.). 
> 
> **MOTION only needs a brief summary + request to read full document.**

```markdown
## Request for Review

[1-2 sentences describing purpose - e.g., "Need review of Feature X plan before implementation"]

## Document

- **Plan:** doc_id=xxx-xxx (v1)
- Command: `aw docs get <doc_id>`

## Action Required

Please read the **ENTIRE** plan document and review.
```

**DO NOT include in MOTION:**
- Context, requirements, implementation steps, technical decisions, risks (already in plan)
- Focus Areas / Key Technical Decisions to Review

**Rationale:** 
- Single source of truth is the document — avoid duplication
- **Opponent is the expert** — let them determine what to focus on
- **Avoid bias** — don't direct Opponent to only look where Proposer points

## 3. Document Update Workflow (IMPORTANT)

| Rule | Description |
|------|-------------|
| **Local-first** | Main document (plan.md) lives locally, edit directly |
| **Version on change** | Each document edit → MUST submit new version via `aw docs submit` |
| **Notify Opponent** | Response MUST include version update info |

**Workflow when revising document:**

```
Edit ./plan.md locally
        ↓
aw docs submit <doc_id> --file ./plan.md --summary "..."
        ↓
Submit CLAIM response with: "doc_id=xxx updated to vN"
        ↓
Request Opponent to re-read ENTIRE document
```

> **Anti-pattern:** Editing document without submitting version → Opponent has no way to verify changes. ALWAYS `aw docs submit` after every edit.

**Response format (with document update):**

> Keep response concise. DO NOT explain in detail what was changed — document has full details. Request Opponent to re-read.

```markdown
## Response to Opponent's Review

### Issue Status

| Issue | Status | Note |
|-------|--------|------|
| C1: [Name] | ✅ Accepted | - |
| M1: [Name] | ✅ Accepted | - |
| M2: [Name] | ❌ Disagree | [1 sentence reason] |

### Document Updated

- **doc_id=xxx:** v1 → **v2**

### Action Required

**Please re-read the ENTIRE updated document** to verify changes.
Command: `aw docs get <doc_id>`
```

## 4. Evaluating Opponent Issues (CRITICAL)

> **Principle:** DO NOT accept or reject issues based on gut feeling. VERIFY against the actual codebase before deciding.

### 4.1 Evaluation Decision Tree

For each issue Opponent raises, follow this sequence:

```
Opponent raises issue
  │
  ├─ Does issue cite specific code/file/behavior?
  │   YES → Go to Step A: Verify against codebase
  │   NO  → Go to Step B: Request evidence
  │
  ├─ Step A: VERIFY against codebase
  │   Read the relevant files/code Opponent references.
  │   │
  │   ├─ Opponent is correct (code confirms issue) → ACCEPT & revise
  │   ├─ Opponent misread the code → COUNTER with evidence
  │   └─ Situation is ambiguous → DISCUSS, ask for clarification
  │
  ├─ Step B: REQUEST evidence
  │   Ask Opponent to provide specific file/code/behavior reference.
  │   Do not accept or reject until evidence is provided.
  │
  └─ After verification, determine category:
      │
      ├─ Genuine gap in plan → ACCEPT & revise (Section 4.2)
      ├─ Valid concern but current approach is better → COUNTER with reasoning (Section 4.3)
      ├─ Based on misunderstanding of plan → CLARIFY (Section 4.4)
      └─ Based on misreading of codebase → COUNTER with code evidence (Section 4.3)
```

### 4.2 Accepting Valid Issues

1. Acknowledge the issue
2. **Edit document locally**
3. **Submit new version** (`aw docs submit`)
4. Respond with status table + version info (Section 3 format)

> **NOT needed in response:** Impact analysis, summary of change, details of what was changed. Document has full details.

### 4.3 Countering Invalid Issues

> **MUST provide evidence**, not just opinions. Read the relevant code and cite specifics.

```markdown
## Response to [Issue Name]

**Status:** ❌ Disagree

**Opponent's claim:** [Summarize what they said]

**Evidence from codebase:**
[Cite specific file, line, or behavior that contradicts the claim]

**Reasoning:**
[Why current approach is correct/better]

**Open to Discussion:** [If Opponent has additional context, willing to reconsider]
```

### 4.4 Requesting Clarification

When an issue is unclear or seems based on incomplete understanding:

```markdown
**Status:** ❓ Need clarification

Before I can address this, I need to understand:
1. [Specific question]
2. [What code/behavior are you referring to?]
```

### 4.5 When to Revise vs Not

| Scenario | Action | Submit Version? |
|----------|--------|-----------------|
| Technical flaw confirmed in codebase | Revise immediately | ✅ Yes |
| Better alternative with evidence | Evaluate, revise if convinced | ✅ Yes |
| Missing edge case (verified) | Add handling | ✅ Yes |
| Unclear documentation | Clarify and update | ✅ Yes |
| Style/preference without technical merit | Do not revise | ❌ No |
| Issue without codebase evidence | Request evidence first | ❌ Wait |

## 5. APPEAL Guidelines

### When to APPEAL

- Dispute over fundamental design decision (not implementation detail)
- Cannot reach consensus after 3 rounds on same point
- Need business/product decision (not purely technical)
- Trade-off needs stakeholder input

> **APPEAL content template** is in `agent/commands/common/debate-proposer.md` Section 5. Follow that format.

**Anti-patterns:**
- APPEAL too early → Waste Arbitrator time. Try to resolve first.
- APPEAL too late → Deadlock. APPEAL when stuck >3 rounds.

## 6. Request Completion

### When to Request

- All Critical/Major issues resolved
- Opponent explicitly agrees or raises no new issues
- Plan has been stable for at least 1 round

### Completion Content

Include:
1. Summary of agreed changes from original plan
2. Outstanding minor items (accepted as-is, with reason)
3. Next steps after debate closes

> **Completion content template** is in `agent/commands/common/debate-proposer.md` Section 6. Follow that format.

## 7. Quality Checklist

Before each submission:

- [ ] **Verified** Opponent's claims against codebase before accepting/rejecting?
- [ ] Response addresses ALL points Opponent raised?
- [ ] Technical reasoning backed by evidence (not just opinion)?
- [ ] No contradictions with previous statements?
- [ ] **Document edited locally + `aw docs submit` + version info in response?** (if accepting)
- [ ] Tone professional and constructive?

## 8. Anti-patterns to Avoid

| Anti-pattern | Why Bad | Instead |
|--------------|---------|---------|
| Defensive reactions | Not productive | Acknowledge valid points |
| Accepting without verifying | May accept invalid issue, degrade plan | Verify against codebase first |
| Rejecting without evidence | Unconvincing, trust breakdown | Counter with code references |
| Ignoring issues | Trust breakdown | Address every issue explicitly |
| Vague responses ("I'll look into it") | Doesn't resolve | Be specific about accept/reject/clarify |
| Edit doc without submitting version | Opponent cannot verify | ALWAYS `aw docs submit` after edit |
| Paste full doc into argument | Bloat, hard to track | Only summary + doc_id reference |
