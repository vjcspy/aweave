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
- ❌ Context, requirements (already in plan)
- ❌ Implementation steps (already in plan)  
- ❌ Technical decisions (already in plan)
- ❌ Risks (already in plan)
- ❌ Focus Areas / Key Technical Decisions to Review

**Rationale:** 
- Avoid duplication, keep argument lean, single source of truth is the document
- **Opponent is the expert** - let them determine what to focus on based on their own due diligence
- **Avoid bias** - don't direct Opponent to only look where Proposer points, may miss issues elsewhere

## 3. Document Update Workflow (IMPORTANT)

### 3.1 Core Principles

| Rule | Description |
|------|-------------|
| **Local-first** | Main document (plan.md) lives locally, edit directly |
| **Version on change** | Each document edit → MUST submit new version |
| **Notify Opponent** | Response MUST include version update info |

### 3.2 Workflow When Accepting Valid Feedback

```
Step 1: Read CLAIM from Opponent
        ↓
Step 2: Identify issues to address
        ↓
Step 3: Edit file ./plan.md directly at local
        ↓
Step 4: Submit new version
        $ aw docs submit <doc_id> --file ./plan.md --summary "..."
        → Response: { "version": N }
        ↓
Step 5: Submit CLAIM response with version info
```

### 3.3 Response Format (With Document Update)

> **Principle:** Response should be concise, DO NOT explain in detail what was changed. Document has full details - request Opponent to re-read.

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

**Please re-read the ENTIRE updated document** to:
1. Verify issues have been addressed
2. Continue review if there are remaining concerns

Command: `aw docs get <doc_id>`

---

## Document Version Summary

| Document | Previous | Current | Changes |
|----------|----------|---------|---------|
| doc_id=xxx (plan.md) | v1 | v2 | Fixed C1, M1 |

**Verify changes:** `aw docs get <doc_id>`
```

## 4. Response Guidelines

### 4.1 When Opponent Raises Valid Issue

**Actions (in order):**
1. Acknowledge issue
2. Analyze impact
3. **Edit document locally**
4. **Submit new version** (`aw docs submit`)
5. Compose response with version info

**Response format:**

```markdown
## Response to [Issue Name]

**Status:** ✅ Accepted

**Document:** doc_id=xxx updated to **v2**

**Action Required:** Please re-read document to verify change.
```

> **NOT needed:** Impact analysis, summary of change, details of what was changed. Document has full details - Opponent reading directly will understand better.

### 4.2 When Opponent Raises Invalid/Unclear Issue

**Actions:**
1. Clarify understanding
2. Provide counter-reasoning
3. Offer to discuss further

**Response format:**

```markdown
## Response to [Issue Name]

**My Understanding:** [Summarize issue as I understand it]

**Counter-argument:**
[Explain why current approach is still valid]

**Evidence/Reasoning:**
- [Point 1]
- [Point 2]

**Open to Discussion:** [If Opponent has additional context, willing to reconsider]
```

### 4.3 When Clarification Needed from Opponent

```markdown
## Clarification Needed

Before addressing [Issue], I need to understand better:

1. [Question 1]
2. [Question 2]

Please clarify so I can respond accurately.
```

## 5. Revision Guidelines

### 5.1 When to Revise?

| Scenario | Action | Submit Version? |
|----------|--------|-----------------|
| Technical flaw pointed out | Revise immediately | ✅ Yes |
| Better alternative suggested | Evaluate and revise if better | ✅ Yes |
| Missing edge case | Add handling | ✅ Yes |
| Unclear documentation | Clarify and update | ✅ Yes |
| Style preference | No need to revise unless strong reason | ❌ No |

### 5.2 Revision Tracking (in Response)

```markdown
## Changes in This Revision

| Section | Change | Reason | Doc Version |
|---------|--------|--------|-------------|
| [Section 1] | [What changed] | [Why] | v1 → v2 |
| [Section 2] | [What changed] | [Why] | v1 → v2 |

## Document Updates

- **doc_id=xxx (plan.md):** v1 → v2
- Verify: `aw docs get <doc_id>`

## Outstanding Issues

- [ ] [Issue still being discussed]
- [x] [Issue resolved in this revision]
```

### 5.3 Anti-pattern: Editing Without Submitting Version

❌ **DON'T DO:**
```
1. Edit ./plan.md
2. Submit response saying "fixed"
3. Forget to submit version
→ Opponent has no way to verify!
```

✅ **ALWAYS DO:**
```
1. Edit ./plan.md
2. aw docs submit <doc_id> --file ./plan.md --summary "..." → v2
3. Submit response with "doc_id=xxx updated to v2"
→ Opponent can verify changes
```

## 6. APPEAL Guidelines

### 6.1 When to APPEAL?

- Dispute over fundamental design decision
- Cannot reach consensus after 3 rounds
- Need business/product decision (not technical)
- Trade-off needs stakeholder input

### 6.2 APPEAL Content for Coding Plan

```markdown
## Appeal: [Decision/Issue Name]

### Context

Debating about: [implementation plan for X]

### Point of Contention

[Describe the point of disagreement]

### Proposer's Position

**Approach:** [My approach]

**Reasoning:**
- [Reason 1]
- [Reason 2]

**Trade-offs accepted:**
- [Trade-off 1]

### Opponent's Position

**Approach:** [Their approach]

**Their reasoning:**
- [Their reason 1]
- [Their reason 2]

### Options for Arbitrator

1. **Option A (Proposer's approach):**
   - Pros: [...]
   - Cons: [...]

2. **Option B (Opponent's approach):**
   - Pros: [...]
   - Cons: [...]

3. **Option C (Hybrid):**
   - [Describe hybrid approach]

4. **Option D:** Arbitrator proposes alternative approach

### Additional Context

- Timeline pressure: [Yes/No]
- Reversibility: [Easy/Hard to change later]
- Team expertise: [Relevant info]
```

## 7. Request Completion Guidelines

### 7.1 When to Request?

- All Critical/Major issues resolved
- Opponent explicitly agrees or raises no new issues
- Plan has been stable for at least 1 round

### 7.2 Completion Content

```markdown
## Resolution Summary

### Agreed Implementation Plan

[Final version of plan]

### Changes from Original

| Original | Final | Reason for Change |
|----------|-------|-------------------|
| [Old approach 1] | [New approach 1] | [Why] |
| [Old approach 2] | [New approach 2] | [Why] |

### Outstanding Items (accepted as-is)

- [Minor item 1] - Accepted because [reason]
- [Minor item 2] - Will address in separate PR

### Acknowledgments

- Thank Opponent for [specific valuable feedback]

### Next Steps (after debate closes)

1. [ ] Start implementation
2. [ ] [Other action items]
```

## 8. Quality Checklist

Before each submission, verify:

- [ ] Response addresses ALL points Opponent raised?
- [ ] Technical reasoning clear and accurate?
- [ ] Plan sections updated consistently?
- [ ] No contradictions with previous statements?
- [ ] Changes tracked properly?
- [ ] Tone professional and constructive?
- [ ] **Document edited locally?** (if accepting feedback)
- [ ] **Ran `aw docs submit` to create new version?**
- [ ] **Response includes version info for Opponent to verify?**

## 9. Anti-patterns to Avoid

| Anti-pattern | Why Bad | Instead |
|--------------|---------|---------|
| Defensive reactions | Not productive | Acknowledge valid points |
| Ignoring issues | Trust breakdown | Address every issue |
| Vague responses | Doesn't resolve | Be specific |
| Changing without explaining | Confusing | Track all changes |
| APPEAL too early | Waste Arbitrator time | Try to resolve first |
| APPEAL too late | Deadlock | APPEAL when needed |
| **Edit doc without submitting version** | Opponent cannot verify | ALWAYS `aw docs submit` after edit |
| **Paste full doc into argument** | Bloat, hard to track changes | Only summary + doc_id reference |
| **Create new file each response** | Clutter, hard to manage | Use `--content` or fixed file |
