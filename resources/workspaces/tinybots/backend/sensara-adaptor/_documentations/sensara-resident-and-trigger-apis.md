---
confluence_sync:
  page:
    id: "4589780994"
    url: "https://tinybots.atlassian.net/wiki/spaces/~712020e960f9fdcdbd471a860cb5e759b69588/pages/4589780994"
    space_key: "~712020e960f9fdcdbd471a860cb5e759b69588"
    title: "Sensara Resident & Trigger APIs"
  sync:
    direction_default: "up"
    include_only_listed_sections: false
    preserve_unmanaged_remote_content: true
  approval:
    require_for_down: false
  sections:
    - key: "all_document"
      local_heading: "# Sensara Resident & Trigger APIs"
      remote_heading: "# Sensara Resident & Trigger APIs"
      direction: "up"
      status: "approved"
      transform: "none"
      last_sync:
        page_version: 6
        synced_at: "2026-02-26T14:51:12+07:00"
        local_hash: "synced"
        remote_hash: "synced"
description: "Technical documentation of the Sensara API integration, covering internal resident management and external trigger subscription endpoints, including authentication requirements and request/response specifications."
---

# Sensara Resident & Trigger APIs

Endpoints are split into two groups:

| Group | Base Path | Authentication |
|-------|-----------|---------------|
| 🔒 Internal (Rosa admin) | `/v1/sensara` | Kong headers + `SENSARA_RESIDENT_WRITE_ALL` permission |
| 🌐 External (Sensara) | `/ext/v1/sensara` | `x-relation-id` header (org token via gateway) |

---

## Authentication

### Internal Endpoints (Rosa admin)

Requires Kong gateway headers and the `SENSARA_RESIDENT_WRITE_ALL` permission:

### External Endpoints (Sensara)

Sensara authenticates via an **org token**. The gateway injects the `x-relation-id` header which identifies the calling organization. All external endpoints require this header:

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `x-relation-id` | `string` (numeric, positive integer) | yes | Organization relation ID, injected by gateway from org token |

No Kong auth headers or permissions are needed for external endpoints.

---

## Internal Resident Endpoints

### 1. PUT /v1/sensara/residents

Register or reactivate a resident-robot mapping with hearable locations. If the resident was previously soft-deleted, this endpoint reactivates the record instead of creating a duplicate.

#### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `residentId` | `string` | yes | Unique Sensara resident identifier (min 1 char) |
| `robotId` | `number` | yes | Internal robot ID to link with the resident |
| `hearableLocations` | `string[]` | yes | List of location identifiers where the robot can listen |

#### Response (200)

```json
{
  "id": 42,
  "residentId": "resident-abc-123",
  "robotId": 101,
  "hearableLocations": ["living_room", "bedroom"]
}
```

#### Test

```bash
curl -X PUT "$BASE_URL/v1/sensara/residents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "residentId": "resident-abc-123",
    "robotId": 101,
    "hearableLocations": ["living_room", "bedroom"]
  }'
```

---

### 2. DELETE /v1/sensara/residents/{residentId}

Soft-delete a resident. The resident will no longer appear in any GET or trigger endpoint. The record can be reactivated by calling PUT with the same resident/robot combination.

#### Request

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `residentId` | path | `string` | yes | Sensara resident identifier (min 1 char) |

#### Response (204)

No content.

#### Error Responses

| Status | Condition |
|--------|-----------|
| 404 | Resident not found |
| 403 | Missing permission |

#### Test

```bash
curl -X DELETE "$BASE_URL/v1/sensara/residents/resident-abc-123" \
  -H "Authorization: Bearer $TOKEN"
```

---

## External Resident Endpoints

All external endpoints require the `x-relation-id` header.

### 3. GET /ext/v1/sensara/residents

List all active residents and their linked robots for a given organization. The `x-relation-id` header scopes results to the organization's robots.

#### Request

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `x-relation-id` | `string` (numeric) | yes | Organization relation ID |

#### Response (200)

```json
[
  {
    "id": 42,
    "residentId": "resident-abc-123",
    "robotId": 101,
    "hearableLocations": ["living_room", "bedroom"],
    "robotSerial": "TBOT-0042"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Internal record ID |
| `residentId` | `string` | Sensara resident identifier |
| `robotId` | `number` | Internal robot ID |
| `hearableLocations` | `string[]` | Configured listening locations |
| `robotSerial` | `string \| null` | Robot serial number (null if unavailable) |

#### Test

```bash
curl -X GET "$BASE_URL/ext/v1/sensara/residents" \
  -H "x-relation-id: 5"
```

---

### 4. GET /ext/v1/sensara/residents/{residentId}

Retrieve a single active resident by their Sensara resident ID, including robot serial and hearable locations. Returns 404 if the resident does not exist or has been soft-deleted.

#### Request

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `residentId` | path | `string` | yes | Sensara resident identifier (min 1 char) |

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `x-relation-id` | `string` (numeric) | yes | Organization relation ID |

#### Response (200)

```json
{
  "id": 42,
  "residentId": "resident-abc-123",
  "robotId": 101,
  "hearableLocations": ["living_room", "bedroom"],
  "robotSerial": "TBOT-0042"
}
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid `x-relation-id` header |
| 404 | Resident not found or soft-deleted |

#### Test

```bash
curl -X GET "$BASE_URL/ext/v1/sensara/residents/resident-abc-123" \
  -H "x-relation-id: 5"
```

---

### 5. PATCH /ext/v1/sensara/residents/{residentId}

Update the hearable locations for an existing resident. Replaces all current locations with the provided list. Returns 404 if the resident does not exist or has been soft-deleted.

#### Request

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `residentId` | path | `string` | yes | Sensara resident identifier (min 1 char) |

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `x-relation-id` | `string` (numeric) | yes | Organization relation ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hearableLocations` | `string[]` | yes | New list of location identifiers |

#### Response (200)

```json
{
  "id": 42,
  "residentId": "resident-abc-123",
  "robotId": 101,
  "hearableLocations": ["kitchen", "hallway"]
}
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Invalid body (missing or wrong type for `hearableLocations`) or invalid `x-relation-id` |
| 404 | Resident not found or soft-deleted |

#### Test

```bash
curl -X PATCH "$BASE_URL/ext/v1/sensara/residents/resident-abc-123" \
  -H "x-relation-id: 5" \
  -H "Content-Type: application/json" \
  -d '{
    "hearableLocations": ["kitchen", "hallway"]
  }'
```

---

## External Trigger Subscription Endpoints

Trigger subscriptions allow Sensara to receive notifications when a robot detects a specific event type. Each subscription is scoped to an event name per robot.

The `residentId` path parameter is resolved to a `robotId` internally — the caller does not need to know the robot ID.

All trigger endpoints require the `x-relation-id` header.

### 6. POST /ext/v1/sensara/residents/{residentId}/events/subscriptions/triggers

Create a trigger subscription for a specific event on the resident's robot. Only one subscription per event name is allowed — duplicates return 409 Conflict.

#### Request

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `residentId` | path | `string` | yes | Sensara resident identifier |

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `x-relation-id` | `string` (numeric) | yes | Organization relation ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventName` | `string` | yes | Event type to subscribe to (e.g. `"fall_detected"`, `"alarm"`) |

#### Response (201)

```json
{
  "id": 7,
  "robotId": 101,
  "eventName": "fall_detected",
  "isActive": true,
  "subscriptionType": "TRIGGER",
  "createdAt": "2026-02-20T10:30:00.000Z",
  "updatedAt": "2026-02-20T10:30:00.000Z"
}
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid `x-relation-id` header |
| 404 | Resident not found or soft-deleted |
| 409 | Subscription for this event already exists |

#### Test

```bash
curl -X POST "$BASE_URL/ext/v1/sensara/residents/resident-abc-123/events/subscriptions/triggers" \
  -H "x-relation-id: 5" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "fall_detected"
  }'
```

---

### 7. GET /ext/v1/sensara/residents/{residentId}/events/subscriptions/triggers

Retrieve all trigger subscriptions for a resident's robot.

#### Request

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `residentId` | path | `string` | yes | Sensara resident identifier |

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `x-relation-id` | `string` (numeric) | yes | Organization relation ID |

#### Response (200)

```json
[
  {
    "id": 7,
    "robotId": 101,
    "eventName": "fall_detected",
    "isActive": true,
    "subscriptionType": "TRIGGER",
    "createdAt": "2026-02-20T10:30:00.000Z",
    "updatedAt": "2026-02-20T10:30:00.000Z"
  },
  {
    "id": 7,
    "robotId": 101,
    "eventName": "alarm",
    "isActive": true,
    "subscriptionType": "TRIGGER",
    "createdAt": "2026-02-20T10:30:00.000Z",
    "updatedAt": "2026-02-20T10:30:00.000Z"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Subscription group ID |
| `robotId` | `number` | Internal robot ID |
| `eventName` | `string` | Subscribed event type |
| `isActive` | `boolean` | Whether the subscription is active |
| `subscriptionType` | `string` | Always `"TRIGGER"` |
| `createdAt` | `string` | ISO 8601 creation timestamp |
| `updatedAt` | `string` | ISO 8601 last update timestamp |

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid `x-relation-id` header |
| 404 | Resident not found, soft-deleted, or no subscriptions exist |

#### Test

```bash
curl -X GET "$BASE_URL/ext/v1/sensara/residents/resident-abc-123/events/subscriptions/triggers" \
  -H "x-relation-id: 5"
```

---

### 8. DELETE /ext/v1/sensara/residents/{residentId}/events/subscriptions/triggers/{subscriptionId}

Delete a specific trigger subscription by its numeric ID.

#### Request

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `residentId` | path | `string` | yes | Sensara resident identifier |
| `subscriptionId` | path | `string` (numeric) | yes | Subscription ID to delete |

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `x-relation-id` | `string` (numeric) | yes | Organization relation ID |

#### Response (204)

No content.

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | `subscriptionId` is not a valid number, or invalid `x-relation-id` |
| 404 | Resident not found or soft-deleted |

#### Test

```bash
curl -X DELETE "$BASE_URL/ext/v1/sensara/residents/resident-abc-123/events/subscriptions/triggers/7" \
  -H "x-relation-id: 5"
```
