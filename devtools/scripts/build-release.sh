#!/bin/bash
set -euo pipefail

# =============================================================================
# Build & Publish all @aweave/* packages to npm.
#
# Usage:
#   bash scripts/build-release.sh              # Build + bump patch + publish
#   bash scripts/build-release.sh minor        # Build + bump minor + publish
#   bash scripts/build-release.sh major        # Build + bump major + publish
#   bash scripts/build-release.sh --dry-run    # Build + bump + dry-run (no publish)
#
# What it does:
#   1. Build all packages (turbo)
#   2. Generate oclif manifest
#   3. Bump version in all workspace packages
#   4. Publish to npm (pnpm -r publish)
#
# pnpm -r publish handles:
#   - Dependency order (publishes deps before dependents)
#   - Rewriting workspace:* → actual versions
#   - Rewriting catalog: → actual versions
#   - Skipping packages whose version already exists on npm
# =============================================================================

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Parse args
BUMP="patch"
DRY_RUN=""
for arg in "$@"; do
  case "$arg" in
    major|minor|patch) BUMP="$arg" ;;
    --dry-run) DRY_RUN="--dry-run" ;;
    *) echo "Usage: $0 [major|minor|patch] [--dry-run]"; exit 1 ;;
  esac
done

echo "=== Build ==="
pnpm turbo build

echo ""
echo "=== Generate oclif manifest ==="
cd common/cli && pnpm exec oclif manifest && cd "$ROOT_DIR"

echo ""
echo "=== Bump version ($BUMP) ==="
pnpm -r exec -- npm version "$BUMP" --no-git-tag-version 2>&1 | grep -E "^v" | while read v; do echo "  $v"; done
echo ""

# Show current versions
echo "=== Package versions ==="
pnpm -r exec -- node -e "const p=require('./package.json'); process.stdout.write(p.name.padEnd(40) + p.version + '\n')" 2>/dev/null

echo ""
if [ -n "$DRY_RUN" ]; then
  echo "=== Dry run (no publish) ==="
  pnpm -r publish --access public --no-git-checks --dry-run 2>&1 | grep -E "^\+ |npm notice name|npm notice version"
  echo ""
  echo "Done (dry-run). To publish for real: bash scripts/build-release.sh $BUMP"
else
  echo "=== Publishing to npm ==="
  pnpm -r publish --access public --no-git-checks 2>&1 | grep -E "^\+ " | sort
  echo ""
  echo "=== Published ==="
  echo "Test: npx @aweave/cli server start --open"
fi
