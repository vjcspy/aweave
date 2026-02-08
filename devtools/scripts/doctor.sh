#!/bin/bash
# Doctor script - check environment requirements

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Environment Check ==="
echo ""

# Check Python
echo -n "Python: "
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    echo -e "${GREEN}$PYTHON_VERSION${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
    echo "  Please install Python 3.12+"
    exit 1
fi

# Check Python version >= 3.12
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 12 ]); then
    echo -e "  ${YELLOW}Warning: Python 3.12+ recommended (found $PYTHON_VERSION)${NC}"
fi

# Check pip
echo -n "pip: "
if command -v pip3 &> /dev/null; then
    PIP_VERSION=$(pip3 --version 2>&1 | cut -d' ' -f2)
    echo -e "${GREEN}$PIP_VERSION${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
fi

# Check uv (optional)
echo -n "uv: "
if command -v uv &> /dev/null; then
    UV_VERSION=$(uv --version 2>&1 | cut -d' ' -f2)
    echo -e "${GREEN}$UV_VERSION${NC}"
else
    echo -e "${YELLOW}NOT FOUND (optional, will use pip)${NC}"
fi

# Check Node
echo -n "Node: "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    echo -e "${GREEN}$NODE_VERSION${NC}"
else
    echo -e "${YELLOW}NOT FOUND (needed for Node plugins)${NC}"
fi

# Check pnpm
echo -n "pnpm: "
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version 2>&1)
    echo -e "${GREEN}$PNPM_VERSION${NC}"
else
    echo -e "${YELLOW}NOT FOUND (needed for Node plugins)${NC}"
fi

echo ""
echo "=== Check Complete ==="
