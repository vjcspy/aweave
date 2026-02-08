# Debate Proposer Command

> **Role:** Proposer - The party that proposes and maintains the debate direction

> **⚠️ LANGUAGE REQUIREMENT:** All debate communication (MOTION, CLAIM, APPEAL, RESOLUTION) **MUST be in English**. This applies regardless of the language used in referenced documents. Documents may be in any language, but all arguments exchanged between Proposer and Opponent must use English for consistency and clarity.

## CLI Reference

> **IMPORTANT - Commands with special syntax (positional argument, DO NOT use `--id`):**
> - `aw docs get <document_id>` → Example: `aw docs get 0c5a44a3-42f6-...`
> - `aw docs submit <document_id> --summary "..." --file <path>` → Example: `aw docs submit 0c5a44a3-... --summary "v2" --file ./plan.md`
>
> **Full command details:**
> - Debate CLI: `devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md`
> - Docs CLI: `devdocs/misc/devtools/common/cli-plugin-docs/OVERVIEW.md`

## Main Loop - IMPORTANT

**Proposer operates in a continuous loop until the debate ends:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROPOSER MAIN LOOP                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────┐                                                  │
│   │ 1. Create/Resume │ ← Start or Resume                                │
│   │   create / get   │                                                  │
│   └────────┬─────────┘                                                  │
│            │                                                            │
│            ▼                                                            │
│   ┌──────────────────┐                                                  │
│   │ 2. Wait          │                                                  │
│   │   aw debate wait │                                                  │
│   └────────┬─────────┘                                                  │
│            │                                                            │
│     ┌──────┴──────────────────────────────────────┐                     │
│     │                                             │                     │
│     ▼                                             ▼                     │
│  action="respond"                          action="debate_closed"       │
│  (CLAIM from Opponent)                     (Arbitrator closed)          │
│     │                                             │                     │
│     ▼                                             ▼                     │
│ ┌──────────────────┐                    ┌──────────────────┐            │
│ │ 3. Analyze &     │                    │ EXIT - END       │            │
│ │    Process CLAIM │                    └──────────────────┘            │
│ └────────┬─────────┘                                                    │
│          │                                                              │
│     ┌────┴────────────────────────────┐                                 │
│     │              │                  │                                 │
│     ▼              ▼                  ▼                                 │
│  Accept &       Disagree &         Cannot                               │
│  Revise         Counter            Agree                                │
│     │              │                  │                                 │
│     ▼              ▼                  ▼                                 │
│  submit         submit             appeal                               │
│  CLAIM          CLAIM              OR                                   │
│     │              │           request-completion                       │
│     │              │                  │                                 │
│     └──────────────┴──────────────────┘                                 │
│                    │                                                    │
│                    ▼                                                    │
│   ┌──────────────────┐                                                  │
│   │ 4. Wait          │                                                  │
│   │   aw debate wait │                                                  │
│   └────────┬─────────┘                                                  │
│            │                                                            │
│            └──────────────► Return to Step 2 ───────────────────────►   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Loop principles:**

1. **NEVER exit on your own** - Only exit when receiving `action="debate_closed"`
2. **After each submit, WAIT** - Submit then wait immediately
3. **After WAIT with response, process it** - Analyze then submit response
4. **Loop continues** until Arbitrator closes the debate

## 1. Initialization

### 1.1 Determine Context

When requested to act as **Proposer** in a debate, MUST determine:

1. **Have `debate_id`?**
   - **YES** → Resume old debate (Section 3)
   - **NO** → Create new debate (Section 2)

2. **What is `debateType`?**
   - `coding_plan_debate` → Load rule: `devdocs/agent/rules/common/debate/proposer/coding-plan.md`
   - `general_debate` → Load rule: `devdocs/agent/rules/common/debate/proposer/general.md`

### 1.2 Permitted CLI Tools

| Tool | Purpose |
|------|---------|
| `aw debate generate-id` | Generate UUID for debate_id, client_request_id |
| `aw debate create` | Create new debate with MOTION |
| `aw debate get-context` | Get existing debate context |
| `aw debate submit` | Submit response CLAIM |
| `aw debate wait` | Wait for response from Opponent/Arbitrator |
| `aw debate appeal` | Request Arbitrator judgment |
| `aw debate request-completion` | Request debate completion |
| `aw docs create` | Create new document (first upload) |
| `aw docs submit` | Update document version (after local edit) |
| `aw docs get` | Get document content |

### 1.3 Document Management - IMPORTANT

**Core principles:**

1. **Document lives LOCALLY** - Proposer works directly on local file (e.g., `./plan.md`)
2. **`aw docs` for versioning** - Submit to save version after each change
3. **Argument only contains summary + doc_id** - DO NOT paste entire content into argument

**Workflow:**

```
Local file: ./plan.md
        ↓
Create debate → aw docs create → doc_id=xxx (version 1)
        ↓
Opponent feedback → Edit ./plan.md directly
        ↓
aw docs submit xxx --summary "v2" --file ./plan.md → version 2
        ↓
Submit CLAIM response with: "Updated doc_id=xxx to v2"
```

**ALWAYS submit new version after editing document!** This is how to:
- Keep audit trail of all changes
- Allow Opponent to verify changes
- Rollback if needed

## 2. Create New Debate

### 2.1 Process

```
Step 1: Generate IDs
       ↓
Step 2: Upload document (if any)
       ↓
Step 3: Create debate with MOTION
       ↓
Step 4: Wait for Opponent
```

### 2.2 Step Details

**Step 1: Generate debate ID**

```bash
aw debate generate-id
```

Response contains `id` - save as `DEBATE_ID`.

**Step 2: Upload document (if there's a plan file):**

```bash
aw docs create --file ./plan.md --summary "Implementation Plan v1"
```

Response contains:
- `document_id`: Document UUID → save as `DOC_ID`
- `version`: Version number (= 1 for new document)

**Step 3: Create debate**

```bash
aw debate create \
  --debate-id <DEBATE_ID> \
  --title "Review: Implementation Plan for Feature X" \
  --type coding_plan_debate \
  --content "<MOTION_CONTENT>" \
  --client-request-id <generate new UUID>
```

**Sample MOTION content:**
```markdown
## Request for Review

Need review of implementation plan for Feature X before implementation.

## Document

- **Plan:** document_id=<DOC_ID> (v1)
- Command: `aw docs get <DOC_ID>`

## Action Required

Please read the ENTIRE plan and review.
```

Response contains `argument_id` → save as `MOTION_ID`.

> **Token Optimization:** Response only contains IDs and metadata, not content since agent just submitted.

**Step 4: Wait for Opponent**

```bash
aw debate wait \
  --debate-id <DEBATE_ID> \
  --argument-id <MOTION_ID> \
  --role proposer
```

## 3. Resume Old Debate

### 3.1 Get Context

```bash
aw debate get-context --debate-id <DEBATE_ID> --limit 20
```

Response contains:
- `debate.state`: Current debate state
- `debate.debate_type`: Debate type (to load rule file)
- `motion`: Original MOTION argument
- `arguments`: List of most recent arguments

### 3.2 Decision Tree

```
IF state == "CLOSED":
    → Notify debate is closed, no action needed
    
ELIF state == "AWAITING_OPPONENT":
    → Waiting for Opponent, call `aw debate wait`
    
ELIF state == "AWAITING_PROPOSER":
    → My turn, read last argument and respond
    
ELIF state == "AWAITING_ARBITRATOR":
    → Both waiting for Arbitrator, call `aw debate wait`
    
ELIF state == "INTERVENTION_PENDING":
    → Arbitrator intervening, call `aw debate wait` for RULING
```

### 3.3 After Determination

- If need to **wait**: Call `aw debate wait` with last argument_id
- If it's **my turn**: → Section 4 to process and respond

## 4. Response Processing

### 4.1 Read Response from `aw debate wait`

Response contains:
- `action`: Next action to take
- `argument`: New argument from Opponent/Arbitrator (if any)
  - `argument.id`: ID to reference in next response
  - `argument.type`: Argument type (CLAIM, RULING, etc.)
  - `argument.content`: Argument content

### 4.2 Action Mapping

| `action` | Meaning | Action |
|----------|---------|--------|
| `respond` | Response turn | Analyze CLAIM and submit response |
| `align_to_ruling` | Arbitrator has ruled | Follow ruling and submit |
| `wait_for_ruling` | Waiting for Arbitrator | Call `aw debate wait` again |
| `debate_closed` | Debate ended | Stop |

### 4.3 Responding to CLAIM from Opponent

**Workflow:**

1. **Read Opponent's CLAIM** carefully
2. **Load rule file** by debateType to process per business logic
3. **Evaluate each issue in CLAIM:**
   - **Valid** → **Edit document locally** → Submit new version → Acknowledge in response
   - **Not valid** → Counter with reasoning
   - **Cannot agree** → APPEAL (Section 5)
   - **All agreed** → REQUEST COMPLETION (Section 6)

4. **If document edited:**

```bash
aw docs submit <DOC_ID> --summary "Updated based on feedback" --file ./plan.md
```

Response contains new `version` (e.g., 2).

5. **Submit response:**

```bash
aw debate submit \
  --debate-id <DEBATE_ID> \
  --role proposer \
  --target-id <OPPONENT_ARG_ID> \
  --content "<RESPONSE_CONTENT>" \
  --client-request-id <generate new UUID>
```

**Sample response content:**
```markdown
## Response to Opponent's CLAIM

### Issue C1: [Issue name]
**Status:** ✅ Accepted

### Issue M1: [Issue name]  
**Status:** ❌ Disagree
**Reasoning:** [Brief explanation]

## Document Updated

- **document_id=xxx:** v1 → **v2**

## Action Required

**Please read the ENTIRE updated document** to verify changes.
```

Response contains `argument_id` → save as `RESPONSE_ID`.

> **Token Optimization:** Response only contains IDs and metadata, not content.

6. **Continue waiting:**

```bash
aw debate wait \
  --debate-id <DEBATE_ID> \
  --argument-id <RESPONSE_ID> \
  --role proposer
```

### 4.4 Processing RULING from Arbitrator

When `action = "align_to_ruling"`:

1. **Read RULING content** in `argument.content`
2. **Determine direction** from Arbitrator
3. **Align proposal** per ruling
4. **Submit response** with aligned content
5. **Wait** for Opponent's response

## 5. Submit APPEAL

### 5.1 When to APPEAL?

- Cannot reach consensus with Opponent
- Argument continues > 3 rounds on same point
- Need decision from human (Arbitrator)

### 5.2 How to APPEAL

**IMPORTANT:** APPEAL content MUST include:
- Full context of disputed point
- Proposer's position (mine)
- Opponent's position
- **Options** for Arbitrator to choose (ALWAYS have final option as "Alternative approach")

```bash
aw debate appeal \
  --debate-id <DEBATE_ID> \
  --target-id <DISPUTED_ARG_ID> \
  --content "<APPEAL_CONTENT>" \
  --client-request-id <generate new UUID>
```

**Sample APPEAL content:**
```markdown
## Context

[Brief description of disputed point]

## Proposer's Position

[My viewpoint]

## Opponent's Position

[Opponent's viewpoint]

## Proposed Options

1. **Option A:** [Follow Proposer's direction]
2. **Option B:** [Follow Opponent's direction]
3. **Option C:** [Compromise approach]
4. **Option D:** Arbitrator provides alternative approach
```

Response contains `argument_id` → save as `APPEAL_ID`.

> **Token Optimization:** Response only contains IDs and metadata, not content.

**After APPEAL:** Call `aw debate wait` and wait for RULING

```bash
aw debate wait \
  --debate-id <DEBATE_ID> \
  --argument-id <APPEAL_ID> \
  --role proposer
```

## 6. Request Completion

### 6.1 When to Request?

- Consensus reached on all points
- Opponent agrees with final proposal
- No outstanding issues

### 6.2 How to Request

```bash
aw debate request-completion \
  --debate-id <DEBATE_ID> \
  --target-id <LAST_ARG_ID> \
  --content "<RESOLUTION_CONTENT>" \
  --client-request-id <generate new UUID>
```

**Sample RESOLUTION content:**
```markdown
## Summary

[Summary of agreed points]

## Final Agreement

[Final agreed content]

## Final Document Versions

| Document | Final Version |
|----------|---------------|
| document_id=xxx | v3 |

## Action Items (if any)

- [ ] Item 1
- [ ] Item 2
```

Response contains `argument_id` → save as `RESOLUTION_ID`.

> **Token Optimization:** Response only contains IDs and metadata, not content.

**After Request:** Call `aw debate wait` to wait for Arbitrator confirm close

```bash
aw debate wait \
  --debate-id <DEBATE_ID> \
  --argument-id <RESOLUTION_ID> \
  --role proposer
```

## 7. Timeout Handling (IMPORTANT)

### 7.1 Why Timeout Happens

Timeout is **expected and normal** - Opponent may need significant time to:
- Read and analyze the entire document
- Perform due diligence (read references, source code, project rules)
- Formulate thorough CLAIM with suggestions

**DO NOT treat timeout as an error or reason to exit.**

### 7.2 Timeout Response Format

```json
{
  "status": "timeout",
  "message": "No response after 300s",
  "retry": {
    "debate_id": "<DEBATE_ID>",
    "argument_id": "<LAST_ARG_ID>",
    "role": "proposer"
  }
}
```

### 7.3 Action: MUST RETRY

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

### 7.4 When to Stop Retrying

- ✅ **Keep retrying** until receiving actual response (action != timeout)
- ❌ **DO NOT** exit or notify user after first timeout
- ❌ **DO NOT** ask user to resume later just because of timeout

**Only stop if:** User explicitly requests to pause/stop the debate session

## 8. Error Handling

### 8.1 ACTION_NOT_ALLOWED

**Action:** Not my turn → Call `aw debate wait`

### 8.2 DEBATE_NOT_FOUND

- Debate ID does not exist or typo
- Notify error and ask user to verify debate_id

### 8.3 Network/Server Error

- Retry up to 3 times with exponential backoff
- If still failing, notify and stop

## 9. Best Practices

### 9.1 Main Loop - MOST IMPORTANT

**NEVER exit the debate flow on your own:**

```
WHILE TRUE:
    response = aw debate wait(...)
    
    IF response.action == "debate_closed":
        BREAK  ← ONLY EXIT WHEN ARBITRATOR CLOSES DEBATE
    
    # Process response
    analyze_and_respond()
    
    # Return to wait
    CONTINUE
```

**Common mistakes to avoid:**
- ❌ Exiting after submitting without waiting
- ❌ Exiting when receiving RULING without aligning
- ❌ Exiting after request-completion without waiting for confirmation
- ✅ ONLY exit when receiving `action="debate_closed"`

### 9.2 Document Management (IMPORTANT)

**Principles:**
- **Main document lives LOCALLY** - Edit directly, don't create new files
- **Each edit → Submit version** - `aw docs submit` after each edit
- **Argument only contains summary** - Reference doc_id, don't paste content

**DO NOT:**
- ❌ Paste entire document into argument
- ❌ Edit document without submitting new version
- ❌ Create new file for each response

### 9.3 Response Quality

- Respond with clear structure
- Address each point from Opponent
- Provide reasoning for each decision
- **ALWAYS include document version info** when updated

### 9.4 When Uncertain

- DO NOT guess - APPEAL for Arbitrator decision
- Provide full context in APPEAL

## 10. Checklist Before Ending Session

**IMPORTANT:** Proposer ONLY ends when:
- [ ] Received `action="debate_closed"` from `aw debate wait`

**If not yet closed, before pausing session:**
- [ ] Submitted response or currently waiting?
- [ ] User has debate_id to resume?
- [ ] Outstanding issues to highlight?
- [ ] **Document submitted new version?** (if edited)
- [ ] **Opponent notified about version update?**

## 11. CLI Command Quick Reference

### Debate Commands

| Command | Description | Response contains |
|---------|-------------|-------------------|
| `aw debate generate-id` | Generate new UUID | `id` |
| `aw debate create --debate-id <id> --title "..." --type <type> --content "..." --client-request-id <id>` | Create new debate | `argument_id` (MOTION) |
| `aw debate get-context --debate-id <id> --limit 20` | Get debate context | `debate.state`, `arguments[]` |
| `aw debate submit --debate-id <id> --role proposer --target-id <arg_id> --content "..." --client-request-id <id>` | Submit CLAIM | `argument_id` |
| `aw debate wait --debate-id <id> --argument-id <arg_id> --role proposer` | Wait for response | `action`, `argument` |
| `aw debate appeal --debate-id <id> --target-id <arg_id> --content "..." --client-request-id <id>` | Request judgment | `argument_id` |
| `aw debate request-completion --debate-id <id> --target-id <arg_id> --content "..." --client-request-id <id>` | Request completion | `argument_id` |

### Docs Commands

| Command | Description | Response contains |
|---------|-------------|-------------------|
| `aw docs create --file <path> --summary "..."` | Create new document | `document_id`, `version` |
| `aw docs submit <document_id> --file <path> --summary "..."` | Update version | `version` |
| `aw docs get <document_id>` | Get document content | `content`, `version` |

> **NOTE:** `aw docs get` and `aw docs submit` use **positional argument** for document_id, NO `--id` flag.
