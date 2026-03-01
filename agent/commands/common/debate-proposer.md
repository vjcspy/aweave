# Debate Proposer Command

> **Role:** Proposer - The party that proposes and maintains the debate direction

> **⚠️ LANGUAGE REQUIREMENT:**
>
> - Read `user/preferences.yaml` > `debate_language` to determine the language for all debate communication (MOTION, CLAIM, APPEAL, RESOLUTION). If not set, default to English.
> - **Technical terms MUST ALWAYS remain in English** regardless of chosen language: variable/function/class names, file paths, CLI commands, code snippets, architectural concepts (e.g., dependency injection, event-driven), design patterns, severity labels (Critical/Major/Minor), and industry-standard terminology.

> **🚨 MANDATORY — pnpm EXECUTION POLICY:**
> **ALL `aw` commands MUST be executed through `pnpm`.** Running bare `aw` directly is **STRICTLY FORBIDDEN** and will be blocked by company policy. You MUST ALWAYS prefix every command with `pnpm`, e.g. `pnpm aw debate list` instead of `aw debate list`. **NEVER** run `aw` without the `pnpm` prefix. This applies to EVERY command in this document without exception. Working directory MUST be `workspaces/devtools`.

## CLI Reference

> **IMPORTANT - Commands with special syntax (positional argument, DO NOT use `--id`):**
>
> - `pnpm aw docs get <document_id>` → Example: `pnpm aw docs get 0c5a44a3-42f6-...`
> - `pnpm aw docs submit <document_id> --summary "..." --file <path>` → Example: `pnpm aw docs submit 0c5a44a3-... --summary "v2" --file ./plan.md`
>
> **Full command details:**
>
> - Debate CLI: `resources/workspaces/devtools/common/cli-plugin-debate/OVERVIEW.md`
> - Docs CLI: `resources/workspaces/devtools/common/cli-plugin-docs/OVERVIEW.md`

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
│   │   pnpm aw debate wait │                                                  │
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
│   │   pnpm aw debate wait │                                                  │
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
   - `coding_plan_debate` → Load rule: `agent/rules/common/debate/proposer/coding-plan.md`
   - `general_debate` → Load rule: `agent/rules/common/debate/proposer/general.md`

### 1.2 Permitted CLI Tools

| Tool | Purpose |
|------|---------|
| `pnpm aw debate generate-id` | Generate UUID for debate_id, client_request_id |
| `pnpm aw debate create` | Create new debate with MOTION |
| `pnpm aw debate get-context` | Get existing debate context |
| `pnpm aw debate submit` | Submit response CLAIM |
| `pnpm aw debate wait` | Wait for response from Opponent/Arbitrator |
| `pnpm aw debate appeal` | Request Arbitrator judgment |
| `pnpm aw debate request-completion` | Request debate completion |
| `pnpm aw docs create` | Create new document (first upload) |
| `pnpm aw docs submit` | Update document version (after local edit) |
| `pnpm aw docs get` | Get document content |

### 1.3 Document Management - IMPORTANT

**Core principles:**

1. **Document lives LOCALLY** - Proposer works directly on local file (e.g., `./plan.md`)
2. **`pnpm aw docs` for versioning** - Submit to save version after each change
3. **Argument only contains summary + doc_id** - DO NOT paste entire content into argument

**Workflow:**

```
Local file: ./plan.md
        ↓
Create debate → pnpm aw docs create → doc_id=xxx (version 1)
        ↓
Opponent feedback → Edit ./plan.md directly
        ↓
pnpm aw docs submit xxx --summary "v2" --file ./plan.md → version 2
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
pnpm aw debate generate-id
```

Response contains `id` - save as `DEBATE_ID`.

**Step 2: Upload document (if there's a plan file):**

```bash
pnpm aw docs create --file ./plan.md --summary "Implementation Plan v1"
```

Response contains:

- `document_id`: Document UUID → save as `DOC_ID`
- `version`: Version number (= 1 for new document)

**Step 3: Create debate**

```bash
pnpm aw debate create \
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
- Command: `pnpm aw docs get <DOC_ID>`

## Action Required

Please read the ENTIRE plan and review.
```

Response contains `argument_id` → save as `MOTION_ID`.

> **Token Optimization:** Response only contains IDs and metadata, not content since agent just submitted.

**Step 4: Wait for Opponent**

```bash
pnpm aw debate wait \
  --debate-id <DEBATE_ID> \
  --argument-id <MOTION_ID> \
  --role proposer
```

## 3. Resume Old Debate

### 3.1 Get Context

```bash
pnpm aw debate get-context --debate-id <DEBATE_ID> --limit 20
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
    → Waiting for Opponent, call `pnpm aw debate wait`
    
ELIF state == "AWAITING_PROPOSER":
    → My turn, read last argument and respond
    
ELIF state == "AWAITING_ARBITRATOR":
    → Both waiting for Arbitrator, call `pnpm aw debate wait`
    
ELIF state == "INTERVENTION_PENDING":
    → Arbitrator intervening, call `pnpm aw debate wait` for RULING
```

### 3.3 After Determination

- If need to **wait**: Call `pnpm aw debate wait` with last argument_id
- If it's **my turn**: → Section 4 to process and respond

## 4. Response Processing

### 4.1 Read Response from `pnpm aw debate wait`

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
| `wait_for_ruling` | Waiting for Arbitrator | Call `pnpm aw debate wait` again |
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
pnpm aw docs submit <DOC_ID> --summary "Updated based on feedback" --file ./plan.md
```

Response contains new `version` (e.g., 2).

1. **Submit response:**

```bash
pnpm aw debate submit \
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

1. **Continue waiting:**

```bash
pnpm aw debate wait \
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
pnpm aw debate appeal \
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

**After APPEAL:** Call `pnpm aw debate wait` and wait for RULING

```bash
pnpm aw debate wait \
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
pnpm aw debate request-completion \
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

**After Request:** Call `pnpm aw debate wait` to wait for Arbitrator confirm close

```bash
pnpm aw debate wait \
  --debate-id <DEBATE_ID> \
  --argument-id <RESOLUTION_ID> \
  --role proposer
```

## 7. Timeout Handling (CRITICAL)

> **⚠️ Multiple consecutive timeouts is the DEFAULT behavior, NOT an edge case.**
> The CLI returns timeout after ~120s. Opponent typically needs 5-15+ minutes to read the entire document, perform due diligence (read references, source code, project rules), and formulate thorough CLAIM. This means you WILL receive **multiple consecutive timeouts** before getting a real response. This is completely normal.

### 7.1 Why Timeout Happens

Opponent needs significant time to:

- **Read the ENTIRE referenced document** (plans can be lengthy)
- Perform due diligence (scan source code, read project rules, understand codebase)
- Formulate thorough CLAIM with structured issues and suggestions

**DO NOT treat timeout as an error or reason to exit. Timeout IS the normal wait state.**

### 7.2 Timeout Response Format

```json
{
  "success": true,
  "content": [
    {
      "type": "json",
      "data": {
        "status": "timeout",
        "message": "No response after 120s. you MUST retry by using: pnpm aw debate wait --debate-id <DEBATE_ID> --role proposer --argument-id <LAST_ARG_ID>",
        "debate_id": "<DEBATE_ID>",
        "last_argument_id": "<LAST_ARG_ID>",
        "last_seen_seq": 2,
        "retry_command": "pnpm aw debate wait --debate-id <DEBATE_ID> --role proposer --argument-id <LAST_ARG_ID>"
      }
    }
  ]
}
```

### 7.3 Action: MUST RETRY Immediately

When receiving timeout, **run the `retry_command` from the response directly:**

```bash
# Just copy and execute data.retry_command from the timeout response
pnpm aw debate wait --debate-id <DEBATE_ID> --role proposer --argument-id <LAST_ARG_ID>
```

**Retry loop:**

```
WHILE response.data.status == "timeout":
    # Execute retry_command from response
    response = execute(response.data.retry_command)

# When status != "timeout", process normally
process_response(response)
```

### 7.4 When to Stop Retrying

- ✅ **Keep retrying indefinitely** until receiving actual response (status != "timeout")
- ✅ **Multiple consecutive timeouts is normal** - just keep looping
- ❌ **DO NOT** exit or notify user after ANY number of timeouts
- ❌ **DO NOT** ask user to resume later just because of timeout
- ❌ **DO NOT** summarize or comment on timeouts to the user

**Only stop if:** User explicitly requests to pause/stop the debate session

## 8. Error Handling

### 8.1 ACTION_NOT_ALLOWED

**Action:** Not my turn → Call `pnpm aw debate wait`

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
    response = pnpm aw debate wait(...)
    
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
- **Each edit → Submit version** - `pnpm aw docs submit` after each edit
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

- [ ] Received `action="debate_closed"` from `pnpm aw debate wait`

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
| `pnpm aw debate generate-id` | Generate new UUID | `id` |
| `pnpm aw debate create --debate-id <id> --title "..." --type <type> --content "..." --client-request-id <id>` | Create new debate | `argument_id` (MOTION) |
| `pnpm aw debate get-context --debate-id <id> --limit 20` | Get debate context | `debate.state`, `arguments[]` |
| `pnpm aw debate submit --debate-id <id> --role proposer --target-id <arg_id> --content "..." --client-request-id <id>` | Submit CLAIM | `argument_id` |
| `pnpm aw debate wait --debate-id <id> --argument-id <arg_id> --role proposer` | Wait for response | `action`, `argument` |
| `pnpm aw debate appeal --debate-id <id> --target-id <arg_id> --content "..." --client-request-id <id>` | Request judgment | `argument_id` |
| `pnpm aw debate request-completion --debate-id <id> --target-id <arg_id> --content "..." --client-request-id <id>` | Request completion | `argument_id` |

### Docs Commands

| Command | Description | Response contains |
|---------|-------------|-------------------|
| `pnpm aw docs create --file <path> --summary "..."` | Create new document | `document_id`, `version` |
| `pnpm aw docs submit <document_id> --file <path> --summary "..."` | Update version | `version` |
| `pnpm aw docs get <document_id>` | Get document content | `content`, `version` |

> **NOTE:** `pnpm aw docs get` and `pnpm aw docs submit` use **positional argument** for document_id, NO `--id` flag.
