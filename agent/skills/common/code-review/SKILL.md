---
name: code-review
description: Review code for quality, security, performance, maintainability, and best practices. Use when reviewing pull requests, code changes, examining diffs, auditing code, or when the user asks for a code review or feedback on their implementation.
---

# Code Review

## Quick Start

When performing a code review:

1. **Understand context**: Read PR description, related issues, and understand the intent
2. **Review systematically**: Go through each category below
3. **Prioritize feedback**: Critical > Suggestions > Nits
4. **Be constructive**: Explain WHY something is an issue and HOW to fix it

## Review Workflow

Copy this checklist and track progress:

```
Review Progress:
- [ ] Step 1: Understand the change (PR description, related issues)
- [ ] Step 2: Security review
- [ ] Step 3: Performance review
- [ ] Step 4: Code quality review
- [ ] Step 5: Testing review
- [ ] Step 6: Maintainability review
- [ ] Step 7: Documentation review
- [ ] Step 8: Summarize findings
```

## Review Categories

### 1. Security Review

| Check | Description |
|-------|-------------|
| Injection | SQL, NoSQL, Command, LDAP injection |
| XSS | Cross-Site Scripting in user input/output |
| Auth | Authentication/Authorization flaws |
| Secrets | Hardcoded credentials, API keys, tokens |
| Data exposure | Sensitive data in logs, errors, responses |
| Input validation | Missing or insufficient validation |
| CSRF | Missing CSRF protection on state-changing ops |

### 2. Performance Review

| Check | Description |
|-------|-------------|
| N+1 queries | Loop queries instead of batch |
| Missing indexes | Queries on non-indexed columns |
| Memory leaks | Unreleased resources, event listeners |
| Blocking I/O | Sync operations in async context |
| Caching | Missing or improper cache usage |
| Bundle size | Unnecessary imports, large dependencies |
| Re-renders | Unnecessary component re-renders (React) |

### 3. Code Quality Review

| Check | Description |
|-------|-------------|
| DRY | Code duplication |
| SRP | Functions/classes doing too much |
| Complexity | Deep nesting, complex conditionals |
| Naming | Unclear variable/function names |
| Magic values | Hardcoded numbers/strings without context |
| Error handling | Missing try/catch, swallowed errors |
| Type safety | Missing types, `any` abuse |

### 4. Testing Review

| Check | Description |
|-------|-------------|
| Coverage | New code has corresponding tests |
| Behavior tests | Tests verify behavior, not implementation |
| Edge cases | Boundary conditions, null, empty values |
| Error paths | Error scenarios are tested |
| Flaky patterns | Time-dependent, order-dependent tests |
| Mocking | External dependencies properly mocked |

### 5. Maintainability Review

| Check | Description |
|-------|-------------|
| Readability | Code is easy to understand |
| Modularity | Proper separation of concerns |
| Dependencies | Minimal, justified dependencies |
| Coupling | Low coupling between modules |
| Extensibility | Easy to extend without modification |
| Consistency | Follows existing patterns in codebase |

### 6. Documentation Review

| Check | Description |
|-------|-------------|
| Code comments | Complex logic is explained |
| API docs | Public APIs are documented |
| README updates | New features documented |
| Breaking changes | Migration guide provided |
| Inline types | Self-documenting type definitions |

### 7. API Design Review (for API endpoints)

| Check | Description |
|-------|-------------|
| RESTful | Proper HTTP methods, status codes |
| Versioning | API versioning strategy |
| Pagination | Large collections are paginated |
| Error format | Consistent error response format |
| Rate limiting | Protection against abuse |
| Idempotency | Safe to retry operations |

### 8. Logging & Observability

| Check | Description |
|-------|-------------|
| Log levels | Appropriate INFO/WARN/ERROR usage |
| Context | Logs include request ID, user context |
| No secrets | Sensitive data not logged |
| Tracing | Distributed tracing support |
| Metrics | Key operations emit metrics |

## Feedback Format

Use this template for review output:

```markdown
## Code Review Summary

**PR:** [PR title/link]
**Scope:** [Brief description of changes]

### 🔴 Critical (Must Fix)

- **[file:line]** Issue description
  - **Why:** Explanation of the problem
  - **Fix:** Suggested solution

### 🟡 Suggestions (Should Consider)

- **[file:line]** Issue description
  - **Why:** Explanation
  - **Fix:** Suggestion

### 🟢 Nits (Optional)

- **[file:line]** Minor suggestion

### ✅ What's Good

- Positive observations about the code
- Good patterns used
- Well-handled edge cases
```

## Severity Guidelines

| Level | Criteria | Action |
|-------|----------|--------|
| 🔴 Critical | Security vulnerability, data loss risk, broken functionality, production impact | Must fix before merge |
| 🟡 Suggestion | Performance issue, maintainability concern, missing tests, code smell | Should address, can discuss |
| 🟢 Nit | Style preference, minor improvement, optional enhancement | Nice to have |

## Additional Resources

For detailed code patterns and examples, see [patterns.md](patterns.md).
