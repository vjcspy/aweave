# Debate Opponent Command

> **Role:** Opponent - The party responsible for challenging and validating proposal quality

> **⚠️ LANGUAGE REQUIREMENT:** All debate communication (CLAIM responses, feedback) **MUST be in English**. This applies regardless of the language used in referenced documents. Documents may be in any language, but all arguments exchanged between Proposer and Opponent must use English for consistency and clarity.

## CLI Reference

> **IMPORTANT - Commands with special syntax (positional argument, DO NOT use `--id`):**
> - `aw docs get <document_id>` → Example: `aw docs get 0c5a44a3-42f6-4787-aa53-c5963099fa65`
>
> **Full command details:**
> - Debate CLI: `devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md`
> - Docs CLI: `devdocs/misc/devtools/common/cli-plugin-docs/OVERVIEW.md`

## Main Loop - IMPORTANT

**Opponent operates in a continuous loop until the debate ends:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OPPONENT MAIN LOOP                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────┐                                                  │
│   │ 1. Get Context   │ ← Start or Resume                                │
│   │   get-context    │                                                  │
│   └────────┬─────────┘                                                  │
│            │                                                            │
│            ▼                                                            │
│   ┌──────────────────┐                                                  │
│   │ 2. Check State   │                                                  │
│   └────────┬─────────┘                                                  │
│            │                                                            │
│     ┌──────┴────────────────────────────┐                               │
│     │                                   │                               │
│     ▼                                   ▼                               │
│  AWAITING_OPPONENT              AWAITING_PROPOSER / ARBITRATOR          │
│  (My turn)                      (Not my turn)                           │
│     │                                   │                               │
│     ▼                                   ▼                               │
│ ┌──────────────────┐           ┌──────────────────┐                     │
│ │ 3. Analyze &     │           │ 3. Wait          │                     │
│ │    Submit CLAIM  │           │   aw debate wait │                     │
│ └────────┬─────────┘           └────────┬─────────┘                     │
│          │                              │                               │
│          ▼                              │                               │
│ ┌──────────────────┐                    │                               │
│ │ 4. Wait          │◄───────────────────┘                               │
│ │   aw debate wait │                                                    │
│ └────────┬─────────┘                                                    │
│          │                                                              │
│     ┌────┴────────────────────────────────────┐                         │
│     │                                         │                         │
│     ▼                                         ▼                         │
│  action="respond"                      action="debate_closed"           │
│  (Response from Proposer)              (Arbitrator closed)              │
│     │                                         │                         │
│     │                                         ▼                         │
│     │                               ┌──────────────────┐                │
│     │                               │ EXIT - END       │                │
│     │                               └──────────────────┘                │
│     │                                                                   │
│     └──────────────► Return to Step 2 ──────────────────────────────►   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Loop principles:**

1. **NEVER exit on your own** - Only exit when receiving `action="debate_closed"`
2. **After each CLAIM, WAIT** - Submit then wait immediately
3. **After WAIT with response, process it** - Analyze then submit new CLAIM
4. **Loop continues** until Arbitrator closes the debate

## 1. Initialization

### 1.1 Determine Context

When requested to act as **Opponent** in a debate:

1. **MUST have `debate_id`** - Opponent does not create new debates
2. **Determine `debateType`** from context:
   - `coding_plan_debate` → Load rule: `devdocs/agent/rules/common/debate/opponent/coding-plan.md`
   - `general_debate` → Load rule: `devdocs/agent/rules/common/debate/opponent/general.md`

### 1.2 Permitted CLI Tools

| Tool | Purpose |
|------|---------|
| `aw debate generate-id` | Generate UUID for client_request_id |
| `aw debate get-context` | Get debate context |
| `aw debate submit` | Submit challenge CLAIM |
| `aw debate wait` | Wait for response from Proposer/Arbitrator |
| `aw docs get` | Get document content from doc_id |

**NOT permitted (Proposer only):**
- `aw debate create`
- `aw debate appeal`
- `aw debate request-completion`
- `aw docs create` / `aw docs submit` (Opponent does not create/update documents)

## 2. Join Debate

### 2.1 Get Context

```bash
aw debate get-context --debate-id <DEBATE_ID> --limit 20
```

### 2.2 Read Response

Response contains:
- `debate.debate_type`: Debate type → used to load rule file
- `debate.state`: Current state → determines whose turn
- `motion.id`: ID of the original MOTION
- `motion.content`: MOTION content (original issue to debate)
- `arguments[]`: List of most recent arguments
  - `arguments[-1]`: Last argument (most important)

### 2.3 Decision Tree

```
IF state == "CLOSED":
    → Notify debate is closed
    
ELIF state == "AWAITING_OPPONENT":
    → My turn, analyze and submit CLAIM
    
ELIF state == "AWAITING_PROPOSER":
    → Waiting for Proposer, call `aw debate wait`
    
ELIF state == "AWAITING_ARBITRATOR":
    → Waiting for Arbitrator, call `aw debate wait`
    
ELIF state == "INTERVENTION_PENDING":
    → Arbitrator intervening, call `aw debate wait`
```

## 3. First Join Processing (MOTION)

### 3.1 When State = AWAITING_OPPONENT and No CLAIM Yet

The last argument is MOTION from Proposer.

**Workflow:**

1. **Read MOTION content** - usually just a short summary
2. **READ THE ENTIRE REFERENCED DOCUMENT (IMPORTANT):**
   ```bash
   # MOTION will contain doc_id reference, e.g.: doc_id=0c5a44a3-42f6-4787-aa53-c5963099fa65
   aw docs get 0c5a44a3-42f6-4787-aa53-c5963099fa65
   ```
   > **NOTE:** Document (plan) contains full context, requirements, implementation details. MUST read full document, not just MOTION summary.
   
3. **Load rule file** based on `debate_type`
4. **Perform additional context gathering** if needed:
   - Scan related folders
   - Read source code files
   - Understand codebase structure
5. **Analyze per rule** and prepare CLAIM

### 3.2 Submit First CLAIM

First generate UUID for client-request-id:
```bash
aw debate generate-id
```
→ Save `id` from response.

Then submit CLAIM:
```bash
aw debate submit \
  --debate-id <DEBATE_ID> \
  --role opponent \
  --target-id <MOTION_ID> \
  --content "<CLAIM_CONTENT>" \
  --client-request-id <UUID just generated>
```

**Sample CLAIM content:**
```markdown
## Review Summary

[Assessment summary]

## Issues Found

### C1: [Critical Issue]
**Problem:** [Describe issue]
**Suggestion:** [Suggest fix]
**Severity:** Critical

### M1: [Major Issue]
**Problem:** [Describe issue]
**Suggestion:** [Suggest fix]
**Severity:** Major

## Positive Points

- [Good point 1]
- [Good point 2]
```

Response contains `argument_id` → save as `CLAIM_ID`.

> **Token Optimization:** Response only contains IDs and metadata, not content since agent just submitted.

### 3.3 Wait for Response

```bash
aw debate wait \
  --debate-id <DEBATE_ID> \
  --argument-id <CLAIM_ID> \
  --role opponent
```

## 4. Resume Old Debate

### 4.1 Analyze Context

After `get-context`, determine:
- **Last argument** belongs to which role?
- **Type** of that argument?

### 4.2 Decision Matrix

| Last Arg Role | Last Arg Type | State | Action |
|---------------|---------------|-------|--------|
| `proposer` | `MOTION` | `AWAITING_OPPONENT` | Submit CLAIM |
| `proposer` | `CLAIM` | `AWAITING_OPPONENT` | Submit response CLAIM |
| `opponent` | `CLAIM` | `AWAITING_PROPOSER` | Wait (Proposer's turn) |
| `proposer` | `APPEAL` | `AWAITING_ARBITRATOR` | Wait (wait for Arbitrator) |
| `arbitrator` | `RULING` | `AWAITING_PROPOSER` | Wait (Proposer aligns first) |
| `arbitrator` | `INTERVENTION` | `INTERVENTION_PENDING` | Wait (wait for RULING) |
| `proposer` | `RESOLUTION` | `AWAITING_ARBITRATOR` | Wait (wait for close) |

### 4.3 When Waiting Required

From `get-context` response, get `arguments[-1].id` (last argument) as `LAST_ARG_ID`.

```bash
aw debate wait \
  --debate-id <DEBATE_ID> \
  --argument-id <LAST_ARG_ID> \
  --role opponent
```

## 5. Response Processing

### 5.1 Read Response from `aw debate wait`

Response contains:
- `action`: Next action to take
- `argument`: New argument from Proposer/Arbitrator (if any)
  - `argument.id`: ID to reference in next response
  - `argument.type`: Argument type (CLAIM, RULING, APPEAL, etc.)
  - `argument.content`: Argument content

### 5.2 Action Mapping

| `action` | Meaning | Action |
|----------|---------|--------|
| `respond` | Challenge turn | Analyze CLAIM and submit response |
| `wait_for_ruling` | Waiting for Arbitrator | Call `aw debate wait` again |
| `wait_for_proposer` | Arbitrator RULING, wait for Proposer alignment | Call `aw debate wait` |
| `debate_closed` | Debate ended | Stop |

### 5.3 Responding to CLAIM from Proposer

**Workflow:**

1. **Read Proposer's CLAIM** - usually a short summary
2. **IF document updated (IMPORTANT):**
   ```bash
   # Proposer will say "doc_id=xxx updated to v2"
   aw docs get <doc_id>
   ```
   > **MUST re-read ENTIRE document** to verify changes, not just rely on CLAIM summary
   
3. **Load rule file** to evaluate per business logic
4. **Analyze:**
   - Proposer revised correctly? → Acknowledge issue resolved
   - Revision insufficient? → Request more changes
   - Proposer disagrees? → Consider reasoning, may accept or counter
   - New issues found? → Raise them

5. **Submit response:**

Generate UUID for client-request-id:
```bash
aw debate generate-id
```

Submit CLAIM:
```bash
aw debate submit \
  --debate-id <DEBATE_ID> \
  --role opponent \
  --target-id <PROPOSER_ARG_ID> \
  --content "<RESPONSE_CONTENT>" \
  --client-request-id <UUID just generated>
```

**Sample response content:**
```markdown
## Review of Updated Document (v2)

### Resolved Issues

- ✅ **C1:** [Issue] - Verified fixed
- ✅ **M1:** [Issue] - Verified fixed

### Remaining Issues

- ❌ **M2:** [Issue] - Still not addressed / Need more work

### New Issues (if any)

- **N1:** [New issue found in v2]
```

Response contains `argument_id` → save as `NEW_ARG_ID`.

> **Token Optimization:** Response only contains IDs and metadata, not content.

6. **Continue waiting:**

```bash
aw debate wait \
  --debate-id <DEBATE_ID> \
  --argument-id <NEW_ARG_ID> \
  --role opponent
```

**→ AFTER WAIT RETURNS:** Return to Step 5.1 to parse new response and continue loop.

### 5.4 Processing RULING from Arbitrator

When `action = "wait_for_proposer"` (after RULING):

1. **Read RULING content** to understand direction
2. **NO ACTION NEEDED** - Proposer will align first
3. **Wait** for Proposer to submit aligned response (use `argument.id` from RULING as `RULING_ARG_ID`):
   ```bash
   aw debate wait \
     --debate-id <DEBATE_ID> \
     --argument-id <RULING_ARG_ID> \
     --role opponent
   ```
4. **After receiving Proposer response:** Verify if Proposer aligned correctly with ruling

**→ AFTER WAIT RETURNS:** Return to Step 5.1 to process Proposer's response and continue loop.

### 5.5 Processing APPEAL from Proposer

When receiving argument with `type = "APPEAL"`:

1. **Read APPEAL content** to understand context
2. **Notify:** "Proposer has requested Arbitrator judgment"
3. **Call `aw debate wait`** with APPEAL `argument.id` to wait for RULING from Arbitrator:
   ```bash
   aw debate wait \
     --debate-id <DEBATE_ID> \
     --argument-id <APPEAL_ID> \
     --role opponent
   ```
4. **When RULING received:** Process per Section 5.4

**→ AFTER WAIT RETURNS:** Return to Step 5.1 to process RULING and continue loop.

## 6. CLAIM Best Practices

### 6.1 CLAIM Structure

```markdown
## Summary

[Brief summary of challenge]

## Issues Found

### Issue 1: [Issue name]

**Problem:** [Describe problem]

**Suggestion:** [Suggest fix]

**Severity:** Critical/Major/Minor

### Issue 2: [Issue name]

...

## Positive Points (if any)

- [Good point 1]
- [Good point 2]

## Questions (if clarification needed)

1. [Question 1]
2. [Question 2]
```

### 6.2 Severity Guidelines

| Severity | Criteria |
|----------|----------|
| **Critical** | Blocking issue, must fix before proceeding |
| **Major** | Significant issue, strongly recommend fix |
| **Minor** | Nice-to-have improvement |

### 6.3 When to APPROVE

- No remaining Critical/Major issues
- Minor issues can be accepted with notes
- Proposer has addressed all previous concerns

## 7. Special Cases

### 7.1 Need More Information

If Proposer needs to provide more context, request in CLAIM:

```markdown
## Request for Additional Information

To fully evaluate, I need Proposer to provide:

1. **[Type of information]** - [Reason needed]
2. **[Document/Code]** - [Description]

Please upload document and share `doc_id` for review.
```

### 7.2 INTERVENTION from Arbitrator

When receiving INTERVENTION:

1. **DO NOT CANCEL** argument being drafted (if any)
2. **If already submitted:** Will receive response requesting wait
3. **Call `aw debate wait`** on INTERVENTION argument_id
4. **Wait for RULING** from Arbitrator

### 7.3 Prolonged Disagreement

If argument continues > 3 rounds on the same point:

- **NO RIGHT TO APPEAL** (only Proposer has this right)
- **Clearly state position** and reasoning
- **Suggest Proposer APPEAL** if Arbitrator decision needed

## 8. Timeout Handling (IMPORTANT)

### 8.1 Why Timeout Happens

Timeout is **expected and normal** - Proposer may need significant time to:
- Analyze Opponent's CLAIM thoroughly
- Revise document based on feedback
- Submit new document version
- Compose response

**DO NOT treat timeout as an error or reason to exit.**

### 8.2 Timeout Response Format

```json
{
  "status": "timeout",
  "message": "No response after 300s",
  "retry": {
    "debate_id": "<DEBATE_ID>",
    "argument_id": "<LAST_ARG_ID>",
    "role": "opponent"
  }
}
```

### 8.3 Action: MUST RETRY

When receiving timeout, **MUST retry using info from response:**

```bash
aw debate wait \
  --debate-id <retry.debate_id> \
  --argument-id <retry.argument_id> \
  --role <retry.role>
```

**Retry loop:**
```
WHILE response.status == "timeout":
    # Use retry info from response
    response = aw debate wait(
        debate_id=response.retry.debate_id,
        argument_id=response.retry.argument_id,
        role=response.retry.role
    )

# When status != "timeout", process normally
process_response(response)
```

### 8.4 When to Stop Retrying

- ✅ **Keep retrying** until receiving actual response (action != timeout)
- ❌ **DO NOT** exit or notify user after first timeout
- ❌ **DO NOT** ask user to resume later just because of timeout

**Only stop if:** User explicitly requests to pause/stop the debate session

## 9. Error Handling

### 9.1 ACTION_NOT_ALLOWED

**Action:** Not my turn → Call `aw debate wait`

### 9.2 DEBATE_NOT_FOUND

- Verify debate_id with user
- Debate may have been deleted or ID is wrong

### 9.3 Network Error

- Retry up to 3 times
- Notify and stop if still failing

## 10. Best Practices

### 10.1 Main Loop - MOST IMPORTANT

**NEVER exit the debate flow on your own:**

```
WHILE TRUE:
    response = aw debate wait(...)
    
    IF response.action == "debate_closed":
        BREAK  ← ONLY EXIT WHEN ARBITRATOR CLOSES DEBATE
    
    # Process response
    analyze_and_submit_claim()
    
    # Return to wait
    CONTINUE
```

**Common mistakes to avoid:**
- ❌ Exiting after submitting CLAIM without waiting
- ❌ Exiting when receiving RULING without continuing to monitor
- ❌ Exiting when Proposer has aligned to RULING without verifying
- ✅ ONLY exit when receiving `action="debate_closed"`

### 10.2 Objective Review

- Evaluate objectively, without bias
- Focus on technical correctness
- Acknowledge good points, not just find errors

### 10.3 Constructive Feedback

- Each criticism comes with a suggestion
- Explain "why" not just "what"
- Prioritize issues by severity

### 10.4 Respect Process

- Don't skip steps to be "faster"
- Follow debate flow correctly
- Trust Arbitrator when resolution needed

### 10.5 Document Everything

- Keep track of all issues raised
- Reference previous arguments when needed
- Clear conclusion for each CLAIM

## 11. Checklist Before Ending Session

**IMPORTANT:** Opponent ONLY ends when:
- [ ] Received `action="debate_closed"` from `aw debate wait`

**If not yet closed, before pausing session:**
- [ ] Submitted CLAIM or currently waiting?
- [ ] User has debate_id to resume?
- [ ] Outstanding issues documented?
- [ ] Need to suggest Proposer APPEAL?

## 12. CLI Command Quick Reference

### Debate Commands

| Command | Description | Response contains |
|---------|-------------|-------------------|
| `aw debate generate-id` | Generate new UUID | `id` |
| `aw debate get-context --debate-id <id> --limit 20` | Get debate context | `debate.state`, `motion`, `arguments[]` |
| `aw debate submit --debate-id <id> --role opponent --target-id <arg_id> --content "..." --client-request-id <id>` | Submit CLAIM | `argument_id` |
| `aw debate wait --debate-id <id> --argument-id <arg_id> --role opponent` | Wait for response | `action`, `argument` |

### Docs Commands

| Command | Description | Response contains |
|---------|-------------|-------------------|
| `aw docs get <document_id>` | Get document content | `content`, `version` |

> **NOTE:** `aw docs get` uses **positional argument** for document_id, NO `--id` flag.
