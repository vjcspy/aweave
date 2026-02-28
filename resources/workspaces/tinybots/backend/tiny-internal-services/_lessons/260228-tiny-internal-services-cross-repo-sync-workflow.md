---
name: "Cross-repo sync workflow for tiny-internal-services git dependency"
description: "When tiny-internal-services changes are not synchronized as a git dependency update in downstream repos, runtime and typing can diverge; use a fixed branch-based sync workflow."
category: "dependency-management"
tags: ["tiny-internal-services", "dependency", "workflow", "cross-repo", "lessons"]
created: 2026-02-28
---

# Context
`tiny-internal-services` is consumed by downstream services through a git dependency, not through npm publish.
If a downstream repository keeps pointing to an old commit or branch, runtime behavior and typings can diverge from the latest source changes.

# What Went Wrong
- Changes were made in `tiny-internal-services`, but downstream repositories were still using a previous dependency reference.
- This created confusion where local code changes seemed correct, but consuming repositories still executed or typed against outdated library code.

# Root Cause
- Missing explicit dependency synchronization step after updating `tiny-internal-services`.
- Missing mandatory guidance in overview docs for the cross-repo update flow.

# Resolution
Use this mandatory sequence:

1. Create a feature branch in `tiny-internal-services` from `master`.
2. Bump minor version and run `yarn build`.
3. Commit source and generated artifacts (`dist/`, and `docs/` when regenerated).
4. Push the feature branch.
5. Update dependent repositories to reference that branch in `package.json`.
6. Run `yarn install` in dependent repositories.
7. Run build/tests in dependent repositories to verify compatibility.

# Preventive Rule
Every change in `tiny-internal-services` that introduces new methods, typing changes, or behavioral changes MUST include dependency sync in all impacted downstream repositories before validation is considered complete.
