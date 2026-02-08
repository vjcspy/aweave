---
name: devtools-builder
description: Guide for building devtools CLI tools with MCP-style responses for AI agent compatibility. Use when creating CLI tools in devtools, integrating external APIs, or building tools that need to return structured data for AI agents.
metadata:
  version: "1.0.0"
  author: "aweave"
---

# Devtools CLI Development Guide

## Overview

Build CLI tools in the `devtools/` monorepo that enable AI agents to interact with external services through well-designed commands. CLI tools follow MCP-style response format for AI agent compatibility and future MCP server conversion.

**Key Principles:**

1. **MCP-Compatible Response Format** - All CLI responses follow MCP format (`success`, `content`, `error`, `metadata`)
2. **Full Data Return** - CLI always returns complete data; AI agents should never need additional queries
3. **Auto-Pagination** - Handle pagination internally; response always has `has_more=false`
4. **Actionable Errors** - Error messages guide agents toward solutions
5. **Reusable Shared Code** - Generic utilities in `devtools/common/cli/devtool/aweave/`

---

## Architecture

### Directory Structure

```
devtools/
├── common/cli/devtool/aweave/         # Shared utilities (GENERIC - not domain-specific)
│   ├── http/                          # HTTP client utilities
│   │   ├── __init__.py
│   │   └── client.py                  # Base HTTP client with error handling
│   └── mcp/                           # MCP-style response models
│       ├── __init__.py
│       ├── response.py                # MCPResponse, MCPError, MCPContent
│       └── pagination.py              # Pagination helpers
│
└── <domain>/cli/<tool>/               # Domain-specific CLI tool
    ├── pyproject.toml
    ├── ruff.toml
    └── <namespace>/                   # Namespace package (e.g., tinybots, nab)
        ├── __init__.py
        └── <module>/                  # Tool module
            ├── __init__.py
            ├── cli.py                 # Typer CLI commands
            ├── client.py              # API client with MCP responses
            └── models.py              # Data models
```

### Shared vs Domain-Specific Code

| Location | Purpose | Rules |
|----------|---------|-------|
| `common/cli/devtool/aweave/` | Reusable utilities | **MUST be generic** - no domain/client-specific logic |
| `<domain>/cli/<tool>/` | Domain-specific tools | Can use domain-specific logic and models |

**Shared Code Guidelines:**

- Functions must work for ANY external API, not just one specific service
- No hardcoded URLs, credentials, or service-specific logic
- Use dependency injection for configuration
- Export clean public APIs via `__init__.py`

---

## MCP Response Format

### Success Response

```json
{
  "success": true,
  "content": [
    {
      "type": "json",
      "data": {
        "id": 126,
        "title": "Feature implementation",
        "author": { "display_name": "Developer" }
      }
    }
  ],
  "metadata": {
    "workspace": "my-workspace",
    "resource_type": "pull_request"
  }
}
```

### Paginated Response (Full Data)

```json
{
  "success": true,
  "content": [
    {"type": "json", "data": {"id": 1, "content": "First item"}},
    {"type": "json", "data": {"id": 2, "content": "Second item"}}
  ],
  "metadata": {
    "resource_type": "items"
  },
  "has_more": false,
  "total_count": 2
}
```

**Important:** `has_more` should **always be `false`** for CLI tools because we auto-fetch all data.

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Authentication failed",
    "suggestion": "Check your credentials (username/password or token)"
  }
}
```

**Error Code Convention:**

| Code | When to Use |
|------|-------------|
| `AUTH_FAILED` | 401 Unauthorized |
| `FORBIDDEN` | 403 Forbidden |
| `NOT_FOUND` | 404 Not Found |
| `BAD_JSON` | Invalid JSON response |
| `HTTP_<status>` | Other HTTP errors |

---

## Implementation Guide

### Phase 1: Shared Infrastructure (if needed)

Only add to `common/cli/devtool/aweave/` if the utility is **truly generic**.

#### HTTP Client (`aweave/http/client.py`)

```python
"""Base HTTP client with error handling."""

class HTTPClientError(Exception):
    """HTTP client error with actionable details."""

    def __init__(self, code: str, message: str, suggestion: str | None = None):
        self.code = code
        self.message = message
        self.suggestion = suggestion


class HTTPClient:
    """Base HTTP client with error handling."""

    def __init__(
        self,
        base_url: str,
        auth: tuple[str, str] | None = None,
        headers: dict[str, str] | None = None,
        timeout: float = 30.0,
    ):
        # Configuration via dependency injection
        ...

    def get(self, path: str, params: dict | None = None) -> dict:
        """GET request, returns raw JSON response."""
        ...

    def get_url(self, url: str) -> dict:
        """GET request using full URL (for pagination next links)."""
        ...

    def _handle_response(self, response) -> dict:
        """Handle HTTP response with error codes and actionable suggestions."""
        ...
```

#### MCP Response Models (`aweave/mcp/response.py`)

```python
"""MCP-style response models for CLI tools."""

from dataclasses import dataclass, field
from enum import Enum


class ContentType(str, Enum):
    TEXT = "text"
    JSON = "json"


@dataclass
class MCPContent:
    type: ContentType
    text: str | None = None
    data: dict | None = None

    def to_dict(self) -> dict:
        ...


@dataclass
class MCPError:
    code: str
    message: str
    suggestion: str | None = None  # Actionable next step

    def to_dict(self) -> dict:
        ...


@dataclass
class MCPResponse:
    success: bool
    content: list[MCPContent] = field(default_factory=list)
    error: MCPError | None = None
    metadata: dict = field(default_factory=dict)
    has_more: bool = False
    next_offset: int | None = None
    total_count: int | None = None

    def to_dict(self) -> dict:
        ...

    def to_json(self, indent: int = 2) -> str:
        ...

    def to_markdown(self) -> str:
        ...
```

#### Pagination Helper (`aweave/mcp/pagination.py`)

```python
"""Pagination utilities for MCP responses."""

def create_paginated_response(
    items: list[T],
    total: int | None,
    has_more: bool,
    next_offset: int | None,
    formatter: Callable[[T], MCPContent],
    metadata: dict | None = None,
) -> MCPResponse:
    """Create MCP response with pagination metadata."""
    content = [formatter(item) for item in items]

    return MCPResponse(
        success=True,
        content=content,
        metadata=metadata or {},
        has_more=has_more,
        next_offset=next_offset,
        total_count=total,
    )
```

### Phase 2: Domain-Specific Implementation

#### Data Models (`models.py`)

```python
"""Data models for the API."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class User:
    uuid: str
    display_name: str

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "User":
        """Create from API response - handle missing fields gracefully."""
        return cls(
            uuid=data.get("uuid", ""),
            display_name=data.get("display_name", "Unknown"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "uuid": self.uuid,
            "display_name": self.display_name,
        }


@dataclass
class Resource:
    id: int
    title: str
    author: User
    created_on: datetime | None = None

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "Resource":
        """Create from API response."""
        created_on = None
        if data.get("created_on"):
            created_on = datetime.fromisoformat(
                data["created_on"].replace("Z", "+00:00")
            )

        return cls(
            id=data.get("id", 0),
            title=data.get("title", ""),
            author=User.from_api(data.get("author", {})),
            created_on=created_on,
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "author": self.author.to_dict(),
            "created_on": self.created_on.isoformat() if self.created_on else None,
        }
```

**Model Guidelines:**

- Always use `@classmethod from_api()` to parse API responses
- Always use `to_dict()` for serialization
- Handle missing fields gracefully with `.get()` and defaults
- Use `datetime` for timestamps, convert ISO format strings

#### API Client (`client.py`)

```python
"""API client with MCP-style responses."""

from aweave.http import HTTPClient, HTTPClientError
from aweave.mcp import (
    ContentType,
    MCPContent,
    MCPError,
    MCPResponse,
    create_paginated_response,
)

from .models import Resource


class MyAPIClient:
    """API client with MCP-style responses."""

    BASE_URL = "https://api.example.com"

    def __init__(self, workspace: str, username: str, api_key: str):
        self._workspace = workspace
        self._http = HTTPClient(
            base_url=self.BASE_URL,
            auth=(username, api_key),
            headers={"Accept": "application/json"},
        )

    def _fetch_all_pages(
        self,
        path: str,
        params: dict | None = None,
        max_items: int = 500,
    ) -> tuple[list[dict], int | None]:
        """
        Fetch all pages from a paginated endpoint.

        Returns:
            Tuple of (all_items, total_count_if_available)
        """
        all_items: list[dict] = []
        total_count: int | None = None
        params = params or {}
        params["pagelen"] = 100  # Max page size for efficiency

        current_url: str | None = None
        first_request = True

        while True:
            if first_request:
                data = self._http.get(path, params=params)
                first_request = False
            else:
                data = self._http.get_url(current_url)

            values = data.get("values", [])
            all_items.extend(values)

            if total_count is None:
                total_count = data.get("size")

            current_url = data.get("next")
            if not current_url or len(all_items) >= max_items:
                break

        return all_items[:max_items], total_count

    def get_resource(self, resource_id: int) -> MCPResponse:
        """Get single resource."""
        try:
            path = f"/resources/{resource_id}"
            data = self._http.get(path)
            resource = Resource.from_api(data)

            return MCPResponse(
                success=True,
                content=[MCPContent(type=ContentType.JSON, data=resource.to_dict())],
                metadata={
                    "workspace": self._workspace,
                    "resource_type": "resource",
                },
            )
        except HTTPClientError as e:
            return MCPResponse(
                success=False,
                error=MCPError(code=e.code, message=e.message, suggestion=e.suggestion),
            )

    def list_resources(self, max_items: int = 500) -> MCPResponse:
        """List all resources (auto-fetches all pages)."""
        try:
            path = "/resources"
            all_data, total_count = self._fetch_all_pages(path, max_items=max_items)

            resources = [Resource.from_api(r) for r in all_data]

            return create_paginated_response(
                items=resources,
                total=total_count or len(resources),
                has_more=False,      # Always false - we fetch everything
                next_offset=None,    # No pagination for consumer
                formatter=lambda r: MCPContent(type=ContentType.JSON, data=r.to_dict()),
                metadata={
                    "workspace": self._workspace,
                    "resource_type": "resources",
                },
            )
        except HTTPClientError as e:
            return MCPResponse(
                success=False,
                error=MCPError(code=e.code, message=e.message, suggestion=e.suggestion),
            )
```

**Client Guidelines:**

- Always return `MCPResponse` (never raise exceptions to caller)
- Convert `HTTPClientError` to `MCPError` in response
- Use `_fetch_all_pages()` for paginated endpoints
- Always set `has_more=False` since we auto-fetch all data

#### CLI Commands (`cli.py`)

```python
"""CLI commands using Typer."""

import os
from enum import Enum
from typing import Annotated

import typer

from .client import MyAPIClient

app = typer.Typer(help="My API tools")


class OutputFormat(str, Enum):
    json = "json"
    markdown = "markdown"


def _get_client(workspace: str) -> MyAPIClient:
    """Create client from environment variables."""
    username = os.environ.get("API_USER")
    api_key = os.environ.get("API_KEY")

    if not username or not api_key:
        typer.echo(
            "Error: API_USER and API_KEY environment variables required.",
            err=True,
        )
        raise typer.Exit(code=1)

    return MyAPIClient(workspace, username, api_key)


def _output(response, fmt: OutputFormat) -> None:
    """Output response in specified format."""
    if fmt == OutputFormat.json:
        typer.echo(response.to_json())
    else:
        typer.echo(response.to_markdown())


@app.command("get")
def get_resource(
    resource_id: Annotated[int, typer.Argument(help="Resource ID")],
    workspace: Annotated[
        str, typer.Option("--workspace", "-w", help="Workspace name")
    ] = "default",
    fmt: Annotated[
        OutputFormat, typer.Option("--format", "-f", help="Output format")
    ] = OutputFormat.json,
) -> None:
    """Get resource details."""
    client = _get_client(workspace)
    response = client.get_resource(resource_id)
    _output(response, fmt)


@app.command("list")
def list_resources(
    workspace: Annotated[
        str, typer.Option("--workspace", "-w", help="Workspace name")
    ] = "default",
    fmt: Annotated[
        OutputFormat, typer.Option("--format", "-f", help="Output format")
    ] = OutputFormat.json,
    max_items: Annotated[
        int, typer.Option("--max", "-m", help="Maximum items to fetch")
    ] = 500,
) -> None:
    """List all resources (auto-fetches all pages)."""
    client = _get_client(workspace)
    response = client.list_resources(max_items=max_items)
    _output(response, fmt)
```

**CLI Guidelines:**

- Use `typer.Annotated` for argument/option definitions
- Credentials via environment variables only (security)
- Default output format is JSON (for AI agents)
- Include `--max` option as safety limit

### Phase 3: Package Configuration

#### `pyproject.toml`

```toml
[project]
name = "<namespace>-<module>"
version = "0.1.0"
description = "CLI tool for API"
dependencies = ["aweave", "typer>=0.9.0"]

[project.entry-points."aw.plugins"]
<command> = "<namespace>.<module>.cli:app"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["<namespace>"]

[tool.uv.sources]
aweave = { workspace = true }
```

#### Update Workspace Root `pyproject.toml`

```toml
[tool.uv.workspace]
members = [
    # ... existing
    "<domain>/cli/<tool>",
]

[tool.uv.sources]
<namespace>-<module> = { workspace = true }

[project]
dependencies = [
    # ... existing
    "<namespace>-<module>",
]
```

---

## Key Design Decisions

### 1. Auto-Pagination (No Consumer Pagination)

**Why:** CLI tools are not real-time MCP servers. AI agents should get complete data in one call.

```python
# Client handles pagination internally
all_data, total = self._fetch_all_pages(path, max_items=500)

# Response always has has_more=False
return create_paginated_response(
    items=items,
    has_more=False,       # Always false
    next_offset=None,     # No need
    ...
)
```

### 2. Actionable Error Messages

**Why:** AI agents need clear guidance on how to fix issues.

```python
raise HTTPClientError(
    code="AUTH_FAILED",
    message="Authentication failed",
    suggestion="Check your credentials (username/password or token)",  # Actionable!
)
```

### 3. MCP Response Format

**Why:** Standardized format for AI agent compatibility and future MCP server conversion.

```python
# All responses use same structure
MCPResponse(
    success=True/False,
    content=[...],      # Array of MCPContent
    error=MCPError(...) if failed,
    metadata={...},     # Context for AI agent
)
```

### 4. Environment Variables for Credentials

**Why:** Security - credentials should never be CLI arguments (visible in shell history).

```python
username = os.environ.get("API_USER")
if not username:
    typer.echo("Error: API_USER environment variable required.", err=True)
    raise typer.Exit(code=1)
```

---

## Checklist

### Before Implementation

- [ ] Read `devtools/README.md` for workspace setup
- [ ] Identify if shared utilities exist in `aweave/` already
- [ ] Plan data models based on API response structure

### Implementation

- [ ] Create namespace package structure
- [ ] Implement data models with `from_api()` and `to_dict()`
- [ ] Implement API client with MCP responses
- [ ] Implement auto-pagination in client
- [ ] Implement CLI commands with Typer
- [ ] Configure `pyproject.toml` with entry points

### Testing

- [ ] Test CLI with `uv run aw <command> --help`
- [ ] Test JSON output format
- [ ] Test markdown output format
- [ ] Test error handling (missing credentials, 404, 401)
- [ ] Test with large datasets (pagination)

### Integration

- [ ] Add to workspace root `pyproject.toml`
- [ ] Run `uv sync` to install
- [ ] Verify command available via `aw <command>`

---

## Reference Implementation

For a complete working example, see the Bitbucket CLI implementation:

- **Shared Code:** `devtools/common/cli/devtool/aweave/mcp/` and `aweave/http/`
- **Domain Code:** `devtools/tinybots/cli/bitbucket/`
- **Implementation Plans:**
  - `devdocs/misc/devtools/tinybots/260130-bitbucket-cli-implementation.md`
  - `devdocs/misc/devtools/tinybots/260130-bitbucket-cli-enhancements-option-a.md`
  - `devdocs/misc/devtools/tinybots/260131-bitbucket-cli-auto-pagination.md`

---

## Future: Converting to MCP Server

The CLI structure is designed for easy MCP server conversion:

1. **Client layer** → MCP tool handlers
2. **MCP response format** → Already compatible
3. **Data models** → Same serialization
4. **Auto-pagination** → Expose as MCP pagination if needed

See `devdocs/agent/skills/common/mcp-builder/SKILL.md` for MCP server implementation guide.
