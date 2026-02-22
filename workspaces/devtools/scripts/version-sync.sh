#!/bin/bash
set -euo pipefail

# Sync all workspace package versions to match root package.json.
# Useful after switching branches where different packages exist.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

VERSION=$(node -e "console.log(require('./package.json').version)")
echo "Syncing all packages to version $VERSION"

pnpm -r exec -- npm version "$VERSION" --no-git-tag-version --allow-same-version 2>&1 | head -1
echo "Done — all packages at $VERSION"
