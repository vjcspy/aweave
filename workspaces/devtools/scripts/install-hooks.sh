#!/bin/bash
# =============================================================================
# Install git hooks by symlinking devtools/scripts/hooks/* into .git/hooks/
#
# Usage: ./devtools/scripts/install-hooks.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# --- Resolve paths ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_SOURCE="$SCRIPT_DIR/hooks"
HOOKS_TARGET="$REPO_ROOT/.git/hooks"

echo ""
echo -e "${BOLD}=== Installing Git Hooks ===${NC}"
echo ""

if [ ! -d "$HOOKS_SOURCE" ]; then
    echo -e "${RED}[ERROR]${NC} Hooks source not found: $HOOKS_SOURCE"
    exit 1
fi

if [ ! -d "$HOOKS_TARGET" ]; then
    echo -e "${RED}[ERROR]${NC} .git/hooks not found. Are you inside a git repository?"
    exit 1
fi

INSTALLED=0

for hook_file in "$HOOKS_SOURCE"/*; do
    [ -f "$hook_file" ] || continue

    hook_name="$(basename "$hook_file")"

    # Skip non-hook files (e.g. .json config)
    [[ "$hook_name" == *.* ]] && continue

    target="$HOOKS_TARGET/$hook_name"

    # Backup existing hook if not already a symlink
    if [ -e "$target" ] && [ ! -L "$target" ]; then
        backup="$target.backup.$(date +%Y%m%d%H%M%S)"
        echo -e "${YELLOW}[BACKUP]${NC} $hook_name → $(basename "$backup")"
        mv "$target" "$backup"
    fi

    # Create symlink
    ln -sf "$hook_file" "$target"
    chmod +x "$target"

    echo -e "${GREEN}[OK]${NC}     $hook_name"
    INSTALLED=$((INSTALLED + 1))
done

echo ""
if [ "$INSTALLED" -gt 0 ]; then
    echo -e "${GREEN}${BOLD}=== $INSTALLED hook(s) installed ===${NC}"
else
    echo -e "${YELLOW}No hooks found in $HOOKS_SOURCE${NC}"
fi
echo ""
