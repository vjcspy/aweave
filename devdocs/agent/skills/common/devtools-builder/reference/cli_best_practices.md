# CLI Best Practices for AI Agent Compatibility

## Response Design Principles

### 1. Always Return Complete Data

AI agents should never need to make follow-up queries. Return all relevant data in one response.

**Bad Pattern (requires follow-up):**

```python
# Don't do this - returns partial data
def list_items(self, limit: int = 10, offset: int = 0) -> MCPResponse:
    data = self._http.get(path, params={"limit": limit, "offset": offset})
    return create_paginated_response(
        items=data["values"],
        has_more=data.get("next") is not None,  # ❌ Forces AI to fetch more
        next_offset=offset + limit,
        ...
    )
```

**Good Pattern (complete data):**

```python
# Do this - returns all data
def list_items(self, max_items: int = 500) -> MCPResponse:
    all_data, total = self._fetch_all_pages(path, max_items=max_items)
    return create_paginated_response(
        items=all_data,
        has_more=False,      # ✅ AI knows data is complete
        next_offset=None,
        total=total or len(all_data),
        ...
    )
```

### 2. Safety Limits

Always include `max_items` parameter to prevent runaway fetching.

```python
def _fetch_all_pages(
    self,
    path: str,
    params: dict | None = None,
    max_items: int = 500,  # Safety limit
) -> tuple[list[dict], int | None]:
    all_items = []
    while True:
        data = self._http.get(...)
        all_items.extend(data.get("values", []))
        
        # Stop conditions
        if not data.get("next") or len(all_items) >= max_items:
            break
    
    return all_items[:max_items], data.get("size")
```

### 3. Rich Metadata

Include contextual metadata to help AI agents understand the response.

```python
return MCPResponse(
    success=True,
    content=[...],
    metadata={
        "workspace": self._workspace,
        "repo_slug": repo_slug,
        "pr_id": pr_id,
        "resource_type": "pr_comments",  # Helps AI identify data type
        "fetched_at": datetime.utcnow().isoformat(),  # Freshness indicator
    },
)
```

---

## Error Handling

### 1. Actionable Suggestions

Every error should tell the AI agent how to fix it.

```python
# HTTP error mapping with suggestions
ERROR_MAP = {
    401: HTTPClientError(
        code="AUTH_FAILED",
        message="Authentication failed",
        suggestion="Check your credentials (username/password or token)",
    ),
    403: HTTPClientError(
        code="FORBIDDEN",
        message="Access denied",
        suggestion="Check if you have the required permissions",
    ),
    404: HTTPClientError(
        code="NOT_FOUND",
        message="Resource not found",
        suggestion="Verify the resource ID/path is correct",
    ),
    429: HTTPClientError(
        code="RATE_LIMITED",
        message="Too many requests",
        suggestion="Wait a few seconds before retrying",
    ),
}
```

### 2. Never Raise Exceptions to Caller

Client methods should always return `MCPResponse`, never raise.

```python
def get_resource(self, resource_id: int) -> MCPResponse:
    try:
        data = self._http.get(f"/resources/{resource_id}")
        return MCPResponse(success=True, content=[...])
    except HTTPClientError as e:
        # Convert exception to response
        return MCPResponse(
            success=False,
            error=MCPError(
                code=e.code,
                message=e.message,
                suggestion=e.suggestion,
            ),
        )
```

### 3. Graceful Degradation in Models

Handle missing optional fields without crashing.

```python
@classmethod
def from_api(cls, data: dict[str, Any]) -> "Comment":
    # Use .get() with defaults for optional fields
    inline = data.get("inline", {})
    creator = data.get("creator")
    
    return cls(
        id=data.get("id", 0),
        content=data.get("content", {}).get("raw", ""),  # Nested access
        file_path=inline.get("path"),  # Optional, may be None
        creator=User.from_api(creator) if creator else None,  # Conditional
    )
```

---

## Data Model Patterns

### 1. Two-Way Serialization

Every model needs `from_api()` (deserialize) and `to_dict()` (serialize).

```python
@dataclass
class Resource:
    id: int
    title: str
    created_on: datetime | None = None

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "Resource":
        """Deserialize from API response."""
        created_on = None
        if data.get("created_on"):
            # Handle ISO format with Z suffix
            created_on = datetime.fromisoformat(
                data["created_on"].replace("Z", "+00:00")
            )
        
        return cls(
            id=data.get("id", 0),
            title=data.get("title", ""),
            created_on=created_on,
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "created_on": self.created_on.isoformat() if self.created_on else None,
        }
```

### 2. Enum for State Values

Use Enums for fixed state values.

```python
from enum import Enum

class TaskState(str, Enum):
    RESOLVED = "RESOLVED"
    UNRESOLVED = "UNRESOLVED"

@dataclass
class Task:
    id: int
    state: TaskState

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "Task":
        return cls(
            id=data.get("id", 0),
            state=TaskState(data.get("state", "UNRESOLVED")),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "state": self.state.value,  # Serialize enum as string
        }
```

### 3. Nested Objects

Handle nested objects with composition.

```python
@dataclass
class User:
    uuid: str
    display_name: str

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "User":
        return cls(
            uuid=data.get("uuid", ""),
            display_name=data.get("display_name", "Unknown"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {"uuid": self.uuid, "display_name": self.display_name}


@dataclass
class Comment:
    id: int
    author: User  # Nested object

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "Comment":
        return cls(
            id=data.get("id", 0),
            author=User.from_api(data.get("user", {})),  # Parse nested
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "author": self.author.to_dict(),  # Serialize nested
        }
```

---

## CLI Patterns

### 1. Environment Variable Validation

Check credentials early and provide clear error message.

```python
def _get_client(workspace: str) -> MyClient:
    """Create client from environment variables."""
    username = os.environ.get("API_USER")
    password = os.environ.get("API_PASSWORD")

    if not username or not password:
        typer.echo(
            "Error: API_USER and API_PASSWORD environment variables required.",
            err=True,
        )
        raise typer.Exit(code=1)

    return MyClient(workspace, username, password)
```

### 2. Consistent Output Handling

Use a single output function for all commands.

```python
class OutputFormat(str, Enum):
    json = "json"
    markdown = "markdown"


def _output(response: MCPResponse, fmt: OutputFormat) -> None:
    """Output response in specified format."""
    if fmt == OutputFormat.json:
        typer.echo(response.to_json())
    else:
        typer.echo(response.to_markdown())
```

### 3. Annotated Arguments

Use `Annotated` for clear help text.

```python
from typing import Annotated

@app.command("get")
def get_resource(
    resource_id: Annotated[int, typer.Argument(help="Resource ID")],
    workspace: Annotated[
        str,
        typer.Option("--workspace", "-w", help="Workspace name")
    ] = "default",
    fmt: Annotated[
        OutputFormat,
        typer.Option("--format", "-f", help="Output format")
    ] = OutputFormat.json,
    max_items: Annotated[
        int,
        typer.Option("--max", "-m", help="Maximum items to fetch")
    ] = 500,
) -> None:
    """Get resource details."""
    ...
```

---

## Pagination Strategies

### 1. Page-Based Pagination

Common in APIs that return `page` and `size`.

```python
def _fetch_all_pages(self, path: str, max_items: int = 500) -> list[dict]:
    all_items = []
    page = 1
    
    while True:
        data = self._http.get(path, params={"page": page, "pagelen": 100})
        all_items.extend(data.get("values", []))
        
        if not data.get("next") or len(all_items) >= max_items:
            break
        page += 1
    
    return all_items[:max_items]
```

### 2. Cursor-Based Pagination

For APIs that return `next` URL.

```python
def _fetch_all_pages(self, path: str, max_items: int = 500) -> list[dict]:
    all_items = []
    current_url = None
    first = True
    
    while True:
        if first:
            data = self._http.get(path, params={"pagelen": 100})
            first = False
        else:
            data = self._http.get_url(current_url)  # Use full URL
        
        all_items.extend(data.get("values", []))
        current_url = data.get("next")
        
        if not current_url or len(all_items) >= max_items:
            break
    
    return all_items[:max_items]
```

### 3. Offset-Based Pagination

For APIs that use `offset` and `limit`.

```python
def _fetch_all_pages(self, path: str, max_items: int = 500) -> list[dict]:
    all_items = []
    offset = 0
    limit = 100
    
    while True:
        data = self._http.get(path, params={"offset": offset, "limit": limit})
        items = data.get("items", [])
        all_items.extend(items)
        
        if len(items) < limit or len(all_items) >= max_items:
            break
        offset += limit
    
    return all_items[:max_items]
```

---

## Testing Checklist

### Unit Tests

- [ ] Models parse API responses correctly
- [ ] Models handle missing optional fields
- [ ] Client returns success response on valid data
- [ ] Client returns error response on API errors
- [ ] Pagination fetches all pages

### Integration Tests

- [ ] CLI outputs valid JSON
- [ ] CLI outputs valid Markdown
- [ ] CLI shows error for missing credentials
- [ ] CLI handles 404/401/403 gracefully

### Manual Tests

```bash
# Test help
aw my-tool --help

# Test JSON output
aw my-tool get 123 -f json | jq .

# Test markdown output
aw my-tool get 123 -f markdown

# Test missing credentials
unset API_USER && aw my-tool get 123

# Test invalid ID
aw my-tool get 99999999
```
