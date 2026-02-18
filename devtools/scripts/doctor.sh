#!/bin/bash
# Doctor script - check and install environment requirements
# Dependencies: nvm → Node 22 → pnpm → pm2

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REQUIRED_NODE_MAJOR=22

info()  { echo -e "${BLUE}→${NC} $1"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}!${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; }

echo ""
echo "=== Devtools Doctor ==="
echo ""

# ─── 1. nvm ───────────────────────────────────────────────────────────

info "Checking nvm..."

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if command -v nvm &> /dev/null; then
    ok "nvm $(nvm --version)"
else
    warn "nvm not found — installing..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

    if command -v nvm &> /dev/null; then
        ok "nvm $(nvm --version) installed"
    else
        fail "Failed to install nvm"
        echo "  Please install manually: https://github.com/nvm-sh/nvm"
        exit 1
    fi
fi

# ─── 2. Node 22 ──────────────────────────────────────────────────────

info "Checking Node.js $REQUIRED_NODE_MAJOR..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d'.' -f1)

    if [ "$NODE_MAJOR" -ge "$REQUIRED_NODE_MAJOR" ]; then
        ok "Node $NODE_VERSION"
    else
        warn "Node $NODE_VERSION found, need v$REQUIRED_NODE_MAJOR+ — installing..."
        nvm install "$REQUIRED_NODE_MAJOR"
        nvm use "$REQUIRED_NODE_MAJOR"
        ok "Node $(node --version) installed"
    fi
else
    warn "Node not found — installing v$REQUIRED_NODE_MAJOR..."
    nvm install "$REQUIRED_NODE_MAJOR"
    nvm use "$REQUIRED_NODE_MAJOR"
    ok "Node $(node --version) installed"
fi

# ─── 3. pnpm ─────────────────────────────────────────────────────────

info "Checking pnpm..."

if command -v pnpm &> /dev/null; then
    ok "pnpm $(pnpm --version)"
else
    warn "pnpm not found — installing via corepack..."
    corepack enable
    corepack prepare pnpm@latest --activate

    if command -v pnpm &> /dev/null; then
        ok "pnpm $(pnpm --version) installed"
    else
        fail "Failed to install pnpm via corepack"
        echo "  Try: npm install -g pnpm"
        exit 1
    fi
fi

# ─── 4. pm2 (global) ─────────────────────────────────────────────────

info "Checking pm2..."

if command -v pm2 &> /dev/null; then
    ok "pm2 $(pm2 --version)"
else
    warn "pm2 not found — installing globally..."
    pnpm add -g pm2

    if command -v pm2 &> /dev/null; then
        ok "pm2 $(pm2 --version) installed"
    else
        fail "Failed to install pm2"
        echo "  Try: npm install -g pm2"
        exit 1
    fi
fi

# ─── Done ─────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}=== All checks passed ===${NC}"
echo ""
