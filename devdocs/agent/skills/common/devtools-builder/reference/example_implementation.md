# Complete Implementation Example: Bitbucket CLI

This document shows a complete implementation based on the Bitbucket CLI in `devtools/tinybots/cli/bitbucket/`.

## Directory Structure

```
devtools/
├── common/cli/devtool/
│   ├── pyproject.toml              # Add httpx dependency
│   └── aweave/
│       ├── __init__.py
│       ├── http/
│       │   ├── __init__.py         # Export HTTPClient, HTTPClientError
│       │   └── client.py           # Base HTTP client
│       └── mcp/
│           ├── __init__.py         # Export all MCP types
│           ├── response.py         # MCPResponse, MCPContent, MCPError
│           └── pagination.py       # create_paginated_response
│
└── tinybots/cli/bitbucket/
    ├── pyproject.toml
    ├── ruff.toml
    └── tinybots/
        ├── __init__.py             # Namespace package
        └── bitbucket/
            ├── __init__.py
            ├── cli.py              # Typer commands
            ├── client.py           # BitbucketClient
            └── models.py           # Data models
```

---

## Shared Code (aweave)

### `aweave/http/__init__.py`

```python
"""HTTP client utilities."""

from .client import HTTPClient, HTTPClientError

__all__ = ["HTTPClient", "HTTPClientError"]
```

### `aweave/http/client.py`

```python
"""Base HTTP client with error handling."""

import json
from typing import Any

import httpx


class HTTPClientError(Exception):
    """HTTP client error with actionable details."""

    def __init__(self, code: str, message: str, suggestion: str | None = None):
        self.code = code
        self.message = message
        self.suggestion = suggestion
        super().__init__(message)


class HTTPClient:
    """Base HTTP client with retry, timeout, and error handling."""

    def __init__(
        self,
        base_url: str,
        auth: tuple[str, str] | None = None,
        headers: dict[str, str] | None = None,
        timeout: float = 30.0,
    ):
        self._base_url = base_url.rstrip("/")
        self._auth = auth
        self._headers = headers or {}
        self._timeout = timeout

    def _build_client(self) -> httpx.Client:
        return httpx.Client(
            base_url=self._base_url,
            auth=self._auth,
            headers=self._headers,
            timeout=self._timeout,
        )

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """GET request, returns raw JSON response."""
        with self._build_client() as client:
            response = client.get(path, params=params)
            return self._handle_response(response)

    def post(self, path: str, json: dict[str, Any] | None = None) -> dict[str, Any]:
        """POST request, returns raw JSON response."""
        with self._build_client() as client:
            response = client.post(path, json=json)
            return self._handle_response(response)

    def get_url(self, url: str) -> dict[str, Any]:
        """GET request using full URL (for pagination next links)."""
        with self._build_client() as client:
            response = client.get(url)
            return self._handle_response(response)

    def _handle_response(self, response: httpx.Response) -> dict[str, Any]:
        """Handle HTTP response, raise on error."""
        if response.status_code == 401:
            raise HTTPClientError(
                code="AUTH_FAILED",
                message="Authentication failed",
                suggestion="Check your credentials (username/password or token)",
            )

        if response.status_code == 403:
            raise HTTPClientError(
                code="FORBIDDEN",
                message="Access denied",
                suggestion="Check if you have the required permissions",
            )

        if response.status_code == 404:
            raise HTTPClientError(
                code="NOT_FOUND",
                message="Resource not found",
                suggestion="Verify the resource ID/path is correct",
            )

        if response.status_code >= 400:
            raise HTTPClientError(
                code=f"HTTP_{response.status_code}",
                message=f"Request failed: {response.text}",
            )

        if response.status_code == 204:
            return {}

        try:
            return response.json()
        except (ValueError, json.JSONDecodeError) as e:
            raise HTTPClientError(
                code="BAD_JSON",
                message=f"Invalid JSON response: {e}",
                suggestion="Check if endpoint returns JSON or verify Accept header",
            ) from e
```

### `aweave/mcp/__init__.py`

```python
"""MCP-style response utilities for CLI tools."""

from .pagination import create_paginated_response
from .response import ContentType, MCPContent, MCPError, MCPResponse

__all__ = [
    "MCPResponse",
    "MCPContent",
    "MCPError",
    "ContentType",
    "create_paginated_response",
]
```

### `aweave/mcp/response.py`

```python
"""MCP-style response models for CLI tools."""

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ContentType(str, Enum):
    """MCP content types."""
    TEXT = "text"
    JSON = "json"


@dataclass
class MCPContent:
    """MCP-style content block."""
    type: ContentType
    text: str | None = None
    data: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"type": self.type.value}
        if self.text is not None:
            result["text"] = self.text
        if self.data is not None:
            result["data"] = self.data
        return result


@dataclass
class MCPError:
    """MCP-style error with actionable message."""
    code: str
    message: str
    suggestion: str | None = None

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.suggestion:
            result["suggestion"] = self.suggestion
        return result


@dataclass
class MCPResponse:
    """MCP-inspired response format for CLI tools."""
    success: bool
    content: list[MCPContent] = field(default_factory=list)
    error: MCPError | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    has_more: bool = False
    next_offset: int | None = None
    total_count: int | None = None

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"success": self.success}

        if self.content:
            result["content"] = [c.to_dict() for c in self.content]

        if self.error:
            result["error"] = self.error.to_dict()

        if self.metadata:
            result["metadata"] = self.metadata

        if self.has_more or self.total_count is not None:
            result["has_more"] = self.has_more
            if self.next_offset is not None:
                result["next_offset"] = self.next_offset
            if self.total_count is not None:
                result["total_count"] = self.total_count

        return result

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, default=str)

    def to_markdown(self) -> str:
        lines: list[str] = []

        if not self.success and self.error:
            lines.append(f"## ❌ Error: {self.error.code}")
            lines.append(f"\n{self.error.message}")
            if self.error.suggestion:
                lines.append(f"\n**Suggestion:** {self.error.suggestion}")
            return "\n".join(lines)

        for item in self.content:
            if item.type == ContentType.TEXT:
                lines.append(item.text or "")
            elif item.type == ContentType.JSON and item.data:
                lines.append(f"```json\n{json.dumps(item.data, indent=2, default=str)}\n```")

        if self.has_more:
            if self.total_count is not None:
                msg = f"Showing {len(self.content)} of {self.total_count} items."
            else:
                msg = f"Showing {len(self.content)} items. More available."
            lines.append(f"\n---\n*{msg} Use --offset {self.next_offset} to see more.*")

        return "\n".join(lines)
```

### `aweave/mcp/pagination.py`

```python
"""Pagination utilities for MCP responses."""

from typing import Any, Callable, TypeVar

from .response import MCPContent, MCPResponse

T = TypeVar("T")


def create_paginated_response(
    items: list[T],
    total: int | None,
    has_more: bool,
    next_offset: int | None,
    formatter: Callable[[T], MCPContent],
    metadata: dict[str, Any] | None = None,
) -> MCPResponse:
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

---

## Domain Code (Bitbucket)

### `tinybots/__init__.py`

```python
"""TinyBots CLI tools namespace package."""
```

### `tinybots/bitbucket/models.py`

```python
"""Bitbucket data models."""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any


class TaskState(str, Enum):
    RESOLVED = "RESOLVED"
    UNRESOLVED = "UNRESOLVED"


class PRState(str, Enum):
    OPEN = "OPEN"
    MERGED = "MERGED"
    DECLINED = "DECLINED"
    SUPERSEDED = "SUPERSEDED"


@dataclass
class BitbucketUser:
    uuid: str
    display_name: str
    account_id: str | None = None

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "BitbucketUser":
        return cls(
            uuid=data.get("uuid", ""),
            display_name=data.get("display_name", "Unknown"),
            account_id=data.get("account_id"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "uuid": self.uuid,
            "display_name": self.display_name,
            "account_id": self.account_id,
        }


@dataclass
class PRComment:
    id: int
    content: str
    author: BitbucketUser
    file_path: str | None = None
    line: int | None = None
    created_on: datetime | None = None

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "PRComment":
        inline = data.get("inline", {})
        created_on = None
        if data.get("created_on"):
            created_on = datetime.fromisoformat(data["created_on"].replace("Z", "+00:00"))

        return cls(
            id=data.get("id", 0),
            content=data.get("content", {}).get("raw", ""),
            author=BitbucketUser.from_api(data.get("user", {})),
            file_path=inline.get("path"),
            line=inline.get("to"),
            created_on=created_on,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "author": self.author.to_dict(),
            "file_path": self.file_path,
            "line": self.line,
            "created_on": self.created_on.isoformat() if self.created_on else None,
        }


@dataclass
class PullRequest:
    id: int
    title: str
    description: str | None
    author: BitbucketUser
    source_branch: str
    destination_branch: str
    state: PRState
    created_on: datetime | None = None

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "PullRequest":
        created_on = None
        if data.get("created_on"):
            created_on = datetime.fromisoformat(data["created_on"].replace("Z", "+00:00"))

        return cls(
            id=data.get("id", 0),
            title=data.get("title", ""),
            description=data.get("description", ""),
            author=BitbucketUser.from_api(data.get("author", {})),
            source_branch=data.get("source", {}).get("branch", {}).get("name", ""),
            destination_branch=data.get("destination", {}).get("branch", {}).get("name", ""),
            state=PRState(data.get("state", "OPEN")),
            created_on=created_on,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "author": self.author.to_dict(),
            "source_branch": self.source_branch,
            "destination_branch": self.destination_branch,
            "state": self.state.value,
            "created_on": self.created_on.isoformat() if self.created_on else None,
        }
```

### `tinybots/bitbucket/client.py`

```python
"""Bitbucket API client with MCP-style responses."""

from typing import Any

from aweave.http import HTTPClient, HTTPClientError
from aweave.mcp import (
    ContentType,
    MCPContent,
    MCPError,
    MCPResponse,
    create_paginated_response,
)

from .models import PRComment, PRTask, PullRequest


class BitbucketClient:
    """Bitbucket API client with MCP-style responses."""

    BASE_URL = "https://api.bitbucket.org/2.0"

    def __init__(self, workspace: str, username: str, app_password: str):
        self._workspace = workspace
        self._http = HTTPClient(
            base_url=self.BASE_URL,
            auth=(username, app_password),
            headers={"Accept": "application/json"},
        )

    def _repo_path(self, repo_slug: str) -> str:
        return f"/repositories/{self._workspace}/{repo_slug}"

    def _fetch_all_pages(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        max_items: int = 500,
    ) -> tuple[list[dict[str, Any]], int | None]:
        """Fetch all pages from a Bitbucket paginated endpoint."""
        all_items: list[dict[str, Any]] = []
        total_count: int | None = None
        params = params or {}
        params["pagelen"] = 100

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

    def get_pr(self, repo_slug: str, pr_id: int) -> MCPResponse:
        try:
            path = f"{self._repo_path(repo_slug)}/pullrequests/{pr_id}"
            data = self._http.get(path)
            pr = PullRequest.from_api(data)

            return MCPResponse(
                success=True,
                content=[MCPContent(type=ContentType.JSON, data=pr.to_dict())],
                metadata={
                    "workspace": self._workspace,
                    "repo_slug": repo_slug,
                    "resource_type": "pull_request",
                },
            )
        except HTTPClientError as e:
            return MCPResponse(
                success=False,
                error=MCPError(code=e.code, message=e.message, suggestion=e.suggestion),
            )

    def list_pr_comments(
        self,
        repo_slug: str,
        pr_id: int,
        max_items: int = 500,
    ) -> MCPResponse:
        try:
            path = f"{self._repo_path(repo_slug)}/pullrequests/{pr_id}/comments"

            all_comments_data, total_count = self._fetch_all_pages(
                path, max_items=max_items
            )

            comments = [PRComment.from_api(c) for c in all_comments_data]

            return create_paginated_response(
                items=comments,
                total=total_count or len(comments),
                has_more=False,
                next_offset=None,
                formatter=lambda c: MCPContent(type=ContentType.JSON, data=c.to_dict()),
                metadata={
                    "workspace": self._workspace,
                    "repo_slug": repo_slug,
                    "pr_id": pr_id,
                    "resource_type": "pr_comments",
                },
            )
        except HTTPClientError as e:
            return MCPResponse(
                success=False,
                error=MCPError(code=e.code, message=e.message, suggestion=e.suggestion),
            )
```

### `tinybots/bitbucket/cli.py`

```python
"""TinyBots Bitbucket CLI commands."""

import os
from enum import Enum
from typing import Annotated

import typer

from .client import BitbucketClient

app = typer.Typer(help="TinyBots Bitbucket tools")


class OutputFormat(str, Enum):
    json = "json"
    markdown = "markdown"


def _get_client(workspace: str) -> BitbucketClient:
    username = os.environ.get("BITBUCKET_USER")
    password = os.environ.get("BITBUCKET_APP_PASSWORD")

    if not username or not password:
        typer.echo(
            "Error: BITBUCKET_USER and BITBUCKET_APP_PASSWORD environment variables required.",
            err=True,
        )
        raise typer.Exit(code=1)

    return BitbucketClient(workspace, username, password)


def _output(response, fmt: OutputFormat) -> None:
    if fmt == OutputFormat.json:
        typer.echo(response.to_json())
    else:
        typer.echo(response.to_markdown())


@app.command("pr")
def get_pr(
    repo: Annotated[str, typer.Argument(help="Repository slug")],
    pr_id: Annotated[int, typer.Argument(help="Pull request ID")],
    workspace: Annotated[
        str, typer.Option("--workspace", "-w", help="Bitbucket workspace")
    ] = "tinybots",
    fmt: Annotated[
        OutputFormat, typer.Option("--format", "-f", help="Output format")
    ] = OutputFormat.json,
) -> None:
    """Get pull request details."""
    client = _get_client(workspace)
    response = client.get_pr(repo, pr_id)
    _output(response, fmt)


@app.command("comments")
def list_comments(
    repo: Annotated[str, typer.Argument(help="Repository slug")],
    pr_id: Annotated[int, typer.Argument(help="Pull request ID")],
    workspace: Annotated[
        str, typer.Option("--workspace", "-w", help="Bitbucket workspace")
    ] = "tinybots",
    fmt: Annotated[
        OutputFormat, typer.Option("--format", "-f", help="Output format")
    ] = OutputFormat.json,
    max_items: Annotated[
        int, typer.Option("--max", "-m", help="Maximum items to fetch")
    ] = 500,
) -> None:
    """List all PR comments (auto-fetches all pages)."""
    client = _get_client(workspace)
    response = client.list_pr_comments(repo, pr_id, max_items=max_items)
    _output(response, fmt)
```

---

## Package Configuration

### `tinybots/cli/bitbucket/pyproject.toml`

```toml
[project]
name = "tinybots-bitbucket"
version = "0.1.0"
description = "TinyBots Bitbucket CLI tools"
requires-python = ">=3.11"
dependencies = [
    "aweave",
    "typer>=0.9.0",
]

[project.entry-points."aw.plugins"]
tinybots-bitbucket = "tinybots.bitbucket.cli:app"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["tinybots"]

[tool.uv.sources]
aweave = { workspace = true }
```

### Root `pyproject.toml` Changes

```toml
[tool.uv.workspace]
members = [
    "common/cli/devtool",
    "tinybots/cli/bitbucket",
]

[tool.uv.sources]
aweave = { workspace = true }
tinybots-bitbucket = { workspace = true }

[project]
dependencies = [
    "aweave",
    "tinybots-bitbucket",
]
```

---

## Usage Examples

```bash
# Get PR info
aw tinybots-bitbucket pr micro-manager 126

# Get PR info in markdown format
aw tinybots-bitbucket pr micro-manager 126 -f markdown

# List all comments
aw tinybots-bitbucket comments micro-manager 126

# List comments with max limit
aw tinybots-bitbucket comments micro-manager 126 --max 50

# Pipe to jq for processing
aw tinybots-bitbucket pr micro-manager 126 | jq '.content[0].data.title'
```

---

## Output Examples

### Success Response

```json
{
  "success": true,
  "content": [
    {
      "type": "json",
      "data": {
        "id": 126,
        "title": "feat: implement API for listing triggered script executions",
        "author": {
          "uuid": "{uuid}",
          "display_name": "Kai",
          "account_id": "712020:xxx"
        },
        "source_branch": "task/PROD-1067-TASK1-api-list",
        "destination_branch": "feature/PROD-1067-expose-trigger-script",
        "state": "OPEN",
        "created_on": "2026-01-15T07:48:17.142448+00:00"
      }
    }
  ],
  "metadata": {
    "workspace": "tinybots",
    "repo_slug": "micro-manager",
    "resource_type": "pull_request"
  }
}
```

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
